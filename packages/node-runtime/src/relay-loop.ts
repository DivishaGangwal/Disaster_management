/**
 * RELAY LOOP -- drives a TransportAdapter through the eight session phases.
 *
 * Spec: 02-... "Session phases"; REL-001..REL-010.
 *
 * This runs identically over the simulated adapter (Expo Go / CI) and the
 * native Android adapter (dev build). Workstream B implements the adapter;
 * it does NOT re-implement this loop.
 */

import {
  EventCategory,
  LINK,
  PROTOCOL_VERSION,
  SESSION,
  MessageType,
  SourceClass,
  type Packet,
  type TransportAdapter,
  type TransportEvent,
} from '@dsm/contracts';
import {
  buildHello,
  buildInventory,
  buildLinkReceipt,
  decodePacket,
  incrementHopInPlace,
  packInventoryIds,
  packetIdPrefixKey,
  toEpochS,
  unpackInventoryIds,
} from '@dsm/codec';
import { backoffMs, SessionStateMachine, shouldInitiate } from '@dsm/routing';
import { buildDiscoverySummary, CapabilityBit } from '@dsm/transport-core';
import type { NodeEngine } from './node-engine.js';

export interface RelayLoopOptions {
  readonly engine: NodeEngine;
  readonly adapter: TransportAdapter;
  readonly now: () => number;
  /** Reported by the gateway tracker; advertised as a freshness class, not a tick. */
  readonly gatewayProven?: () => boolean;
}

export class RelayLoop {
  private readonly sessions = new Map<string, SessionStateMachine>();
  /**
   * What each peer announced holding, as 8-byte ID PREFIX KEYS (see
   * inventory-ids.ts). Never full packet IDs -- membership is tested against
   * `packetIdPrefixKey(...)` and a mismatch here fails silently rather than
   * loudly, re-sending every packet every session.
   */
  private readonly peerInventories = new Map<string, Set<string>>();
  /** Peers whose last announcement did not fit one record. */
  private readonly peerInventoryTruncated = new Set<string>();
  /**
   * Capability learned at the hello phase, per peer.
   *
   * `recordBytes` is the smaller of the two ends' usable record size, so a
   * record we build always fits what the peer can receive. Today both ends
   * report LINK.MAX_RECORD_BYTES and the negotiation lands on the same 180-byte
   * payload it always used -- the value of doing it now is that the phase is
   * real, so plumbing the natively negotiated ATT MTU through later changes one
   * number rather than adding a protocol step.
   */
  private readonly peerCapabilities = new Map<string, { recordBytes: number; batteryBand: number }>();
  private readonly consecutiveFailures = new Map<string, number>();
  /** One hello, one inventory announcement, and one filtered push per session. */
  private readonly helloSent = new Set<string>();
  private readonly announced = new Set<string>();
  private readonly pushed = new Set<string>();
  /** REL-007: earliest next connection attempt per peer, from backoffMs(). */
  private readonly nextAttemptAtMs = new Map<string, number>();
  /**
   * REL-003 optimisation: the (their epoch, our epoch) pair at the last
   * completed reconciliation with a peer. If neither side's queue has changed
   * since, there is nothing to exchange and the whole session is skipped.
   */
  private readonly lastReconciled = new Map<string, { theirs: number; ours: number }>();
  /**
   * Peers with an openSession() still in flight.
   *
   * `sessions` cannot serve this: the entry is only added AFTER openSession
   * RESOLVES, and that takes until the GATT handshake completes -- up to the
   * 15s setup timeout. Advertisements arrive every 1-8s, so without this set
   * every advertisement during that window started ANOTHER connectGatt to the
   * same peer.
   *
   * That is fatal rather than merely wasteful: ATT MTU is negotiated per ACL
   * LINK, not per GATT client. The first interface negotiates it, and every
   * later one's configureMTU() is swallowed with no onMtuChanged callback, so
   * the handshake stalls and every stacked attempt times out. Observed on a
   * Samsung M53 as three interfaces (134/135/136) holding one link while
   * `configureMTU() mtu: 247` never returned.
   */
  private readonly connecting = new Set<string>();
  private unsubscribe?: () => void;
  private running = false;

  constructor(private readonly options: RelayLoopOptions) {}

  async start(): Promise<void> {
    const { adapter, engine } = this.options;

    // Starting an already-running relay must be a no-op that only refreshes
    // the advertisement. Without this guard every call leaked another event
    // listener (the old `unsubscribe` handle was overwritten, so each native
    // event was delivered N times) AND re-entered the native startRelay, which
    // re-registers the GATT service and re-advertises -- producing
    // ADVERTISE_FAILED_ALREADY_STARTED / SCAN_FAILED_ALREADY_STARTED and
    // leaving a second, orphaned GATT server behind.
    //
    // Two callers hit this routinely: creating an SOS starts relay (REL-001),
    // and so does the Relay toggle, so any SOS raised while relaying was
    // already re-entrant.
    if (this.running) {
      await this.refreshAdvertisement();
      return;
    }

    this.unsubscribe = adapter.addEventListener((event) => {
      void this.handle(event);
    });
    await adapter.startRelay(this.summary());
    this.running = true;
    engine.events.emit({
      category: EventCategory.RELAY_LIFECYCLE,
      name: 'started',
      severity: 'info',
      atMs: this.options.now(),
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.unsubscribe?.();
    // Drop the handle too, so a later start() cannot double-unsubscribe and
    // so the leak above cannot reappear through a stop/start cycle.
    this.unsubscribe = undefined;
    // Stopping tears every native session down, so nothing may stay marked as
    // in-flight or open across a restart.
    this.connecting.clear();
    this.sessions.clear();
    this.helloSent.clear();
    this.peerCapabilities.clear();
    await this.options.adapter.stopRelay();
    this.options.engine.events.emit({
      category: EventCategory.RELAY_LIFECYCLE,
      name: 'stopped',
      severity: 'info',
      atMs: this.options.now(),
    });
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Republishes the advertisement when the queue epoch changes. */
  async refreshAdvertisement(): Promise<void> {
    if (!this.running) return;
    await this.options.adapter.updateDiscoverySummary(this.summary());
  }

  private summary() {
    const { engine } = this.options;
    return buildDiscoverySummary({
      nodeToken: engine.nodeToken,
      queueEpoch: engine.currentQueueEpoch,
      // Both used to be wrong: the priority was hardcoded to 0 (EMERGENCY, so
      // every node always claimed life-critical traffic) and the hint was a
      // copy of queueEpoch, carrying no information the field beside it did
      // not already have.
      highestWaitingPriority: engine.currentHighestWaitingPriority,
      inventoryHint: engine.currentInventoryHint,
      gatewayProven: this.options.gatewayProven?.() ?? false,
      gatewayFreshnessClass: this.options.gatewayProven?.() ? 0 : 2,
      acceptingConnections: this.sessions.size < 2,
      capabilityBits:
        CapabilityBit.GATT_SERVER |
        CapabilityBit.GATT_CLIENT |
        CapabilityBit.FRAGMENTS |
        (engine.profile.role === 'responder' ? CapabilityBit.RESPONDER_MODE : 0),
    });
  }

  private async handle(event: TransportEvent): Promise<void> {
    const { engine, adapter, now } = this.options;

    switch (event.kind) {
      case 'peer-observed': {
        // Carry forward the session history. Writing 0/0 here would erase the
        // link-reliability record every time the peer re-advertised, which is
        // why the routing score's reliability term never moved off its prior.
        const known = await engine.peers.get(event.nodeToken);
        await engine.peers.observe({
          // Spread FIRST so this advertisement updates what it observed and
          // nothing else. Listing fields individually here is what erased the
          // reliability counters before; the capability fields learned at the
          // hello phase are on the same record and an advertisement carries
          // none of them, so rebuilding the object wiped those too -- one
          // advertisement (every 1-8s) undid every hello.
          ...known,
          peerToken: event.nodeToken,
          lastSeenAtMs: event.observedAtMs,
          ...(event.rssi !== undefined ? { rssi: event.rssi } : {}),
          gatewayProven: event.summary.gatewayProven,
          queueEpoch: event.summary.queueEpoch,
          sessionsCompleted: known?.sessionsCompleted ?? 0,
          sessionsFailed: known?.sessionsFailed ?? 0,
        });
        engine.events.emit({
          category: EventCategory.PEER_DISCOVERY,
          name: 'observed',
          severity: 'debug',
          atMs: event.observedAtMs,
          peerToken: event.nodeToken,
        });

        // Deterministic arbitration: only one side normally initiates.
        // REL-007: a peer that keeps failing is retried on a bounded,
        // jittered backoff rather than at full advertisement rate.
        const retryAt = this.nextAttemptAtMs.get(event.nodeToken) ?? 0;
        const backoffElapsed = event.observedAtMs >= retryAt;

        // 02-...: "Do not connect when compact inventory and epochs indicate no
        // useful difference." A session costs two inventory records plus a
        // connection even when it moves nothing, and peers re-advertise
        // constantly -- so this is the difference between a fixed per-contact
        // tax and near-silence once a neighbourhood has converged.
        const reconciled = this.lastReconciled.get(event.nodeToken);
        const nothingChanged =
          reconciled !== undefined &&
          reconciled.theirs === event.summary.queueEpoch &&
          reconciled.ours === engine.currentQueueEpoch &&
          // A truncated peer never finished telling us what it holds, so
          // "neither epoch moved" does NOT mean there is nothing to exchange --
          // it means the rest of its queue is static and was never named. This
          // pair of conditions used to compound into a permanent blind spot:
          // the inventory cut at four entries and the skip then guaranteed the
          // fifth was never mentioned again.
          !this.peerInventoryTruncated.has(event.nodeToken);

        if (nothingChanged) {
          engine.events.emit({
            category: EventCategory.INVENTORY,
            name: 'session-skipped',
            severity: 'debug',
            atMs: event.observedAtMs,
            peerToken: event.nodeToken,
            reason: 'no useful difference',
            metrics: { queueEpoch: event.summary.queueEpoch },
          });
          break;
        }

        if (this.running && backoffElapsed && shouldInitiate(engine.nodeToken, event.nodeToken)) {
          if (
            !this.hasSessionWith(event.nodeToken) &&
            !this.connecting.has(event.nodeToken) &&
            event.summary.acceptingConnections
          ) {
            this.connecting.add(event.nodeToken);
            try {
              const sessionId = await adapter.openSession(event.nodeToken);
              this.sessions.set(
                sessionId,
                new SessionStateMachine(sessionId, event.nodeToken, true, now()),
              );
              await this.runSession(sessionId, event.nodeToken);
            } catch (error) {
              // Out of range or refused. Record it: repeatedly unreachable
              // peers must lose reliability weight in the routing score.
              engine.events.emit({
                category: EventCategory.SESSION,
                name: 'open-failed',
                severity: 'warn',
                atMs: now(),
                peerToken: event.nodeToken,
                reason: error instanceof Error ? error.message : String(error),
              });
              await this.recordPeerOutcome(event.nodeToken, false, now());
            } finally {
              // Cleared only once the attempt has fully settled, so the next
              // advertisement cannot stack a second GATT client on the link.
              this.connecting.delete(event.nodeToken);
            }
          }
        }
        break;
      }

      case 'session': {
        if (event.phase !== 'establish') break;
        if (event.initiatedLocally) break;
        // A session is BIDIRECTIONAL. The accepting side must also offer what
        // the initiator is missing, otherwise responder state and backend
        // acknowledgements could never travel back down the chain
        // (02-... "Mesh-to-mesh flow": each node requests missing items).
        if (!this.sessions.has(event.sessionId)) {
          this.sessions.set(
            event.sessionId,
            new SessionStateMachine(event.sessionId, event.peerToken, false, event.atMs),
          );
          // No push yet: wait for the peer's INVENTORY so the offer can be
          // filtered. Pushing here would send packets the peer already holds.
        }
        break;
      }

      case 'record-received': {
        // INVENTORY is session-scoped: the policy engine discards it, so it is
        // read HERE before ingest. This is what makes REL-004 work -- without
        // it every session re-sent packets the peer already had.
        const peek = decodePacket(event.bytes);
        if (peek.ok && peek.packet.header.type === MessageType.HELLO_CAPABILITY) {
          await this.absorbHello(event.sessionId, event.peerToken, peek.packet, event.atMs);
          break;
        }
        if (peek.ok && peek.packet.header.type === MessageType.INVENTORY) {
          await this.absorbInventory(event.sessionId, event.peerToken, peek.packet, event.atMs);
          break;
        }

        const result = await engine.ingest(event.bytes, event.transport, {
          previousHopToken: event.peerToken,
          atMs: event.atMs,
        });

        // A receipt is issued ONLY after durable acceptance (02-...).
        if (result.accepted && result.packetId) {
          const decoded = decodePacket(event.bytes);
          if (decoded.ok && decoded.packet.header.type !== MessageType.LINK_RECEIPT) {
            const receipt = buildLinkReceipt(
              {
                sourceId: engine.localSourceId,
                sourceClass:
                  engine.profile.role === 'responder'
                    ? SourceClass.RESPONDER_PROVISIONED
                    : SourceClass.GENERAL_PUBLIC,
                nowS: toEpochS(event.atMs),
              },
              result.packetId,
              decoded.packet.header.digestPrefix,
              engine.nodeToken,
              0,
            );
            try {
              await adapter.sendRecord(event.sessionId, receipt);
            } catch (error) {
              // The peer may already have closed; the receipt is best-effort.
              engine.events.emit({
                category: EventCategory.TRANSFER,
                name: 'receipt-send-failed',
                severity: 'warn',
                atMs: event.atMs,
                sessionId: event.sessionId,
                peerToken: event.peerToken,
                packetId: result.packetId,
                reason: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }

        this.sessions.get(event.sessionId)?.recordAcknowledged(event.atMs);
        break;
      }

      case 'session-closed': {
        this.sessions.delete(event.sessionId);
        this.peerInventories.delete(event.peerToken);
        this.helloSent.delete(event.sessionId);
        this.announced.delete(event.sessionId);
        this.pushed.delete(event.sessionId);

        // Feed the routing score's link-reliability term (02-... "link
        // reliability from recent sessions"). A clean close or a peer-initiated
        // close is a success; every other reason is a failed contact.
        const succeeded = event.reason === 'complete' || event.reason === 'peer-closed';
        await this.recordPeerOutcome(event.peerToken, succeeded, event.atMs);

        engine.events.emit({
          category: EventCategory.SESSION,
          name: 'closed',
          severity: 'debug',
          atMs: event.atMs,
          sessionId: event.sessionId,
          peerToken: event.peerToken,
          result: event.reason,
          metrics: { records: event.recordsAccepted, bytes: event.bytesTransferred },
        });
        break;
      }

      case 'relay-state-changed':
        engine.events.emit({
          category: EventCategory.RELAY_LIFECYCLE,
          name: event.state,
          severity: 'info',
          atMs: event.atMs,
        });
        break;

      case 'error':
        engine.events.emit({
          category: EventCategory.SESSION,
          name: 'error',
          severity: 'error',
          atMs: event.atMs,
          reason: event.code,
          result: event.recoverable ? 'recoverable' : 'fatal',
        });
        break;

      default:
        break;
    }
  }

  /**
   * Opens the exchange: hello, then inventory, then stop.
   *
   * It deliberately does NOT push or close here: it has not yet seen what the
   * peer holds. Both the push and the close happen in absorbInventory() once
   * the peer answers, so every transfer is filtered (REL-003/REL-004).
   */
  private async runSession(sessionId: string, peerToken: string): Promise<void> {
    const machine = this.sessions.get(sessionId);
    if (!machine) return;

    const atMs = this.options.now();
    machine.advance(atMs); // hello
    // Previously this advanced straight past `hello` without emitting anything,
    // which is why SessionStateMachine.negotiate() had zero callers and the
    // 'incompatible' close reason could never fire. The phase now puts a record
    // on the wire (02-... "Session phases").
    await this.announceHello(sessionId, peerToken);
    machine.advance(atMs); // inventory

    // Sized to what we know NOW, which for the initiator is the local budget:
    // the peer's hello has not arrived yet. Waiting for it would need a
    // blocking primitive inside the session -- the same cost HD-001 rejected --
    // and buys nothing while both ends report the same record size. The
    // ACCEPTING side answers after absorbing this hello, so its inventory is
    // negotiated, and by the time either side reaches pushOffers it has the
    // peer's capability for the routing score.
    await this.announceInventory(sessionId, peerToken);

    machine.advance(atMs); // request
  }

  /** Build context for the session-control records this node emits. */
  private buildContext() {
    const { engine, now } = this.options;
    return {
      sourceId: engine.localSourceId,
      sourceClass:
        engine.profile.role === 'responder' ? SourceClass.RESPONDER_PROVISIONED : SourceClass.GENERAL_PUBLIC,
      nowS: toEpochS(now()),
    };
  }

  /**
   * Announces this node's capability, once per session.
   *
   * Carries the four things the 12-byte advertisement has no room for:
   * the protocol range this build accepts, the usable record size, and the
   * battery and storage bands. The bands are what let the PEER's forwarding
   * score refuse to push non-critical traffic into a node that is nearly flat
   * -- before this record existed that term could only read the sender's own
   * battery, so it never described the node it was scoring.
   */
  private async announceHello(sessionId: string, peerToken: string): Promise<void> {
    if (this.helloSent.has(sessionId)) return;
    this.helloSent.add(sessionId);

    const { engine, adapter, now } = this.options;
    const record = buildHello(this.buildContext(), {
      nodeToken: engine.nodeToken,
      protocolMin: PROTOCOL_VERSION,
      protocolMax: PROTOCOL_VERSION,
      batteryBand: engine.batteryBandValue,
      storageBand: engine.storageBandValue,
      maxRecordBytes: LINK.MAX_RECORD_BYTES,
      maxFragmentBytes: LINK.MAX_PAYLOAD_BYTES,
      queueEpoch: engine.currentQueueEpoch,
      highestWaitingPriority: engine.highestWaitingPriority,
    });

    engine.events.emit({
      category: EventCategory.SESSION,
      name: 'hello-announced',
      severity: 'debug',
      atMs: now(),
      sessionId,
      peerToken,
      bytes: record.totalBytes,
      metrics: { maxRecordBytes: LINK.MAX_RECORD_BYTES, batteryBand: engine.batteryBandValue },
    });

    await adapter.sendRecord(sessionId, record);
  }

  /**
   * Records the peer's capability and runs the protocol version check.
   *
   * This is the call site SessionStateMachine.negotiate() was written for and
   * never had, which is why an incompatible peer used to be discovered one
   * layer down as a run of validator rejections instead of a clean close.
   */
  private async absorbHello(
    sessionId: string,
    peerToken: string,
    packet: Packet,
    atMs: number,
  ): Promise<void> {
    const { engine, adapter } = this.options;
    const payload = packet.payload as Record<string, unknown>;
    const machine = this.sessions.get(sessionId);

    const protocolMin = Number(payload['protocolMin'] ?? PROTOCOL_VERSION);
    const protocolMax = Number(payload['protocolMax'] ?? PROTOCOL_VERSION);

    if (machine && !machine.negotiate(protocolMin, protocolMax, PROTOCOL_VERSION)) {
      engine.events.emit({
        category: EventCategory.SESSION,
        name: 'incompatible',
        severity: 'warn',
        atMs,
        sessionId,
        peerToken,
        reason: `peer accepts ${protocolMin}..${protocolMax}, this build speaks ${PROTOCOL_VERSION}`,
      });
      // negotiate() has already marked the machine closed, so nothing further
      // will be offered on it. Tear the link down rather than idling it out.
      await adapter.closeSession(sessionId).catch(() => undefined);
      return;
    }

    // Our records must fit what the PEER can receive, so the smaller end wins.
    const peerRecordBytes = Number(payload['maxRecordBytes'] ?? LINK.MAX_RECORD_BYTES);
    const batteryBand = Number(payload['batteryBand'] ?? 3);
    const storageBand = Number(payload['storageBand'] ?? 3);
    const recordBytes = Math.max(
      64,
      Math.min(LINK.MAX_RECORD_BYTES, Number.isFinite(peerRecordBytes) ? peerRecordBytes : LINK.MAX_RECORD_BYTES),
    );
    this.peerCapabilities.set(peerToken, { recordBytes, batteryBand });

    // Persist onto the peer record so the forwarding score can read it, and so
    // it survives the session that learned it.
    const known = await engine.peers.get(peerToken);
    if (known) {
      await engine.peers.observe({
        ...known,
        lastSeenAtMs: Math.max(known.lastSeenAtMs, atMs),
        batteryBand,
        storageBand,
        maxRecordBytes: recordBytes,
        capabilitiesAtMs: atMs,
      });
    }

    engine.events.emit({
      category: EventCategory.SESSION,
      name: 'hello-received',
      severity: 'debug',
      atMs,
      sessionId,
      peerToken,
      metrics: { recordBytes, batteryBand, storageBand },
    });

    // The accepting side has not said hello yet; answer before the inventory
    // arrives so its own announcement can be sized against ours.
    if (!this.helloSent.has(sessionId)) {
      try {
        await this.announceHello(sessionId, peerToken);
      } catch (error) {
        engine.events.emit({
          category: EventCategory.SESSION,
          name: 'hello-failed',
          severity: 'error',
          atMs,
          sessionId,
          peerToken,
          reason: String(error),
        });
      }
    }
  }

  /**
   * Sends the packets this node holds that the peer is missing.
   *
   * `peerInventories` is populated from the peer's INVENTORY packet, so the
   * plan can skip anything they already hold. Both sides run this, which is
   * what makes the session bidirectional.
   */
  private async pushOffers(sessionId: string, peerToken: string): Promise<void> {
    const { engine, adapter, now } = this.options;
    const machine = this.sessions.get(sessionId);
    if (!machine) return;

    const peerInventory = this.peerInventories.get(peerToken) ?? new Set<string>();
    const plan = await engine.planSessionTransfer(peerToken, peerInventory, now(), {
      peerInventoryTruncated: this.peerInventoryTruncated.has(peerToken),
    });

    engine.events.emit({
      category: EventCategory.INVENTORY,
      name: 'planned',
      severity: 'debug',
      atMs: now(),
      sessionId,
      peerToken,
      metrics: {
        offered: plan.offers.length,
        skipped: plan.skipped.length,
        bytes: plan.totalBytes,
        peerAlreadyHolds: peerInventory.size,
      },
    });

    for (const offer of plan.offers) {
      const stored = await engine.packets.get(offer.candidate.packetId);
      if (!stored) continue;
      if (!machine.canSend(stored.encoded.totalBytes)) break;
      // 02-...: "hop count increments at each application-level relay". This
      // was the one loop control that never ran -- incrementHopInPlace() existed
      // in the codec but nothing called it, so every packet travelled at
      // hopCount 0 forever and validation gate 8 (hopCount >= hopLimit) could
      // never fire. Replication stayed bounded by copy budgets, TTL,
      // knownHolders and cooldown, but the hop limit itself was inert.
      //
      // Safe to rewrite here: the payload digest is taken over
      // [type byte || payload] (see payloadDigest), NOT the header, so bumping
      // hop and repairing the header CRC changes neither packet identity nor
      // conflict detection. incrementHopInPlace copies rather than mutating, so
      // our own stored copy keeps its own hop count (04-BLUEPRINT 7.4: a relay
      // adds bounded observations, it does not rewrite source meaning).
      const relayed = { ...stored.encoded, bytes: incrementHopInPlace(stored.encoded.bytes) };
      try {
        await adapter.sendRecord(sessionId, relayed);
      } catch (error) {
        engine.events.emit({
          category: EventCategory.TRANSFER,
          name: 'record-send-failed',
          severity: 'warn',
          atMs: now(),
          sessionId,
          peerToken,
          packetId: offer.candidate.packetId,
          reason: error instanceof Error ? error.message : String(error),
        });
        break; // peer closed or moved out of range; custody is unchanged
      }
      machine.recordSent(stored.encoded.totalBytes, now());
      await engine.recordTransfer(offer.candidate.packetId, peerToken, now());
    }
  }

  /**
   * Records the peer's inventory, answers with our own if we have not yet,
   * then pushes only what the peer is missing.
   *
   * Each side pushes exactly once per session, and both pushes are filtered.
   * No blocking primitive is needed: the exchange is purely event-driven.
   */
  private async absorbInventory(
    sessionId: string,
    peerToken: string,
    packet: Packet,
    atMs: number,
  ): Promise<void> {
    const { engine, adapter } = this.options;
    const payload = packet.payload as Record<string, unknown>;

    // Everything lands in ONE prefix-keyed set. The compact blob is what this
    // build announces; the three string fields are read so a peer running an
    // older build is still understood, and every path goes through
    // packetIdPrefixKey so membership tests cannot silently mismatch.
    const held = new Set<string>();
    const blob = payload['idPrefixes'];
    if (blob instanceof Uint8Array) {
      for (const key of unpackInventoryIds(blob)) held.add(key);
    }
    for (const id of (payload['criticalIds'] as string[] | undefined) ?? []) held.add(packetIdPrefixKey(id));
    for (const id of (payload['terminalIds'] as string[] | undefined) ?? []) held.add(packetIdPrefixKey(id));
    for (const entry of (payload['entries'] as { packetId?: string }[] | undefined) ?? []) {
      if (entry?.packetId) held.add(packetIdPrefixKey(entry.packetId));
    }
    this.peerInventories.set(peerToken, held);

    // `truncated` was written honestly and read by nothing, so a partial list
    // was indistinguishable from a complete one. It has to be recorded here
    // because it is what disqualifies this contact from the HD-013 skip below:
    // the peer's remaining packets were never named, and neither queue epoch
    // will move on its own to prove they exist.
    const truncated = payload['truncated'] === true;
    if (truncated) this.peerInventoryTruncated.add(peerToken);
    else this.peerInventoryTruncated.delete(peerToken);

    engine.events.emit({
      category: EventCategory.INVENTORY,
      name: 'received',
      severity: 'debug',
      atMs,
      sessionId,
      peerToken,
      metrics: { peerHolds: held.size, truncated: truncated ? 1 : 0 },
    });

    // The accepting side has not announced yet; do it now so the initiator can
    // filter too.
    if (!this.announced.has(sessionId)) {
      try {
        await this.announceInventory(sessionId, peerToken);
      } catch (error) {
        // This used to be swallowed. An inventory that fails to send stops the
        // whole exchange, so it must be visible.
        engine.events.emit({
          category: EventCategory.INVENTORY,
          name: 'announce-failed',
          severity: 'error',
          atMs,
          sessionId,
          peerToken,
          reason: String(error),
        });
      }
    }

    if (this.pushed.has(sessionId)) return;
    this.pushed.add(sessionId);
    await this.pushOffers(sessionId, peerToken);

    // Both sides have now announced and pushed. Remember the epoch pair so a
    // repeat contact with no change on either side is skipped entirely.
    this.lastReconciled.set(peerToken, {
      theirs: Number(payload['queueEpoch'] ?? 0),
      ours: engine.currentQueueEpoch,
    });

    // ONLY the initiator closes. If the accepting side closed here it would
    // tear the session down before the initiator had seen this inventory and
    // pushed its own packets -- which silently killed multi-hop relay.
    const machine = this.sessions.get(sessionId);
    if (machine?.initiatedLocally) {
      machine.advance(atMs); // receipt
      machine.advance(atMs); // reconciliation
      machine.advance(atMs); // close
      await adapter.closeSession(sessionId).catch(() => undefined);
    }
  }

  /**
   * Sends this node's inventory once per session.
   *
   * The list is TRUNCATED TO FIT, and an inventory that overflows does not
   * merely lose entries -- it throws and takes the whole exchange down with it
   * (HD-012), so the list is grown by MEASURING rather than by guessing a count.
   *
   * What changed: entries now travel as one blob of 8-byte ID prefixes rather
   * than 32-CHARACTER hex strings, which is the same information at 8 bytes
   * instead of 34 and raises the capacity of one record from 4 IDs to ~19.
   * `available` arrives priority-ordered, so the entries that survive
   * truncation are the urgent ones -- previously the cut kept whichever four
   * happened to be oldest, which on the device meant a fresh SOS could be left
   * out of the announcement by four stale hazard records.
   */
  private async announceInventory(sessionId: string, peerToken: string): Promise<void> {
    if (this.announced.has(sessionId)) return;
    this.announced.add(sessionId);

    const { engine, adapter, now } = this.options;
    const buildCtx = this.buildContext();

    // The peer's hello, when we have it, caps the record at what it can
    // receive; the local limit applies until then and is never exceeded.
    const recordBudget = this.peerCapabilities.get(peerToken)?.recordBytes ?? LINK.MAX_RECORD_BYTES;

    const available = await engine.inventoryIds();
    const carried: string[] = [];

    for (const id of available.slice(0, SESSION.MAX_INVENTORY_ENTRIES)) {
      const attempt = [...carried, id];
      try {
        const probe = buildInventory(buildCtx, {
          idPrefixes: packInventoryIds(attempt),
          queueEpoch: engine.currentQueueEpoch,
          truncated: true,
        });
        // Two separate ceilings: the codec's per-class payload cap (which
        // throws) and the negotiated record size (which does not).
        if (probe.totalBytes > recordBudget) break;
      } catch {
        break; // this ID would overflow the payload budget
      }
      carried.push(id);
    }

    const truncated = carried.length < available.length;
    const record = buildInventory(buildCtx, {
      idPrefixes: packInventoryIds(carried),
      queueEpoch: engine.currentQueueEpoch,
      truncated,
    });

    engine.events.emit({
      category: EventCategory.INVENTORY,
      name: 'announced',
      severity: 'debug',
      atMs: now(),
      sessionId,
      peerToken,
      bytes: record.totalBytes,
      metrics: { carried: carried.length, held: available.length, truncated: truncated ? 1 : 0 },
    });

    await adapter.sendRecord(sessionId, record);
  }

  /**
   * Records one contact outcome against a peer.
   *
   * Feeds two things: the `reliability` term of the forwarding utility, and
   * the consecutive-failure count that `backoffMs()` needs.
   */
  private async recordPeerOutcome(peerToken: string, succeeded: boolean, atMs: number): Promise<void> {
    const { engine } = this.options;
    const known = await engine.peers.get(peerToken);
    if (!known) return;

    await engine.peers.observe({
      ...known,
      lastSeenAtMs: Math.max(known.lastSeenAtMs, atMs),
      sessionsCompleted: known.sessionsCompleted + (succeeded ? 1 : 0),
      sessionsFailed: known.sessionsFailed + (succeeded ? 0 : 1),
    });

    const consecutive = succeeded ? 0 : (this.consecutiveFailures.get(peerToken) ?? 0) + 1;
    if (succeeded) {
      this.consecutiveFailures.delete(peerToken);
      this.nextAttemptAtMs.delete(peerToken);
    } else {
      this.consecutiveFailures.set(peerToken, consecutive);
      // Bounded exponential backoff with jitter, so two phones that fail
      // together do not retry in lockstep (02-... connection arbitration).
      this.nextAttemptAtMs.set(peerToken, atMs + backoffMs(consecutive));
    }

    engine.events.emit({
      category: EventCategory.PEER_DISCOVERY,
      name: succeeded ? 'contact-succeeded' : 'contact-failed',
      severity: 'debug',
      atMs,
      peerToken,
      metrics: { consecutiveFailures: consecutive },
    });
  }

  /** Consecutive failed contacts per peer, for `backoffMs()`. */
  consecutiveFailuresFor(peerToken: string): number {
    return this.consecutiveFailures.get(peerToken) ?? 0;
  }

  private hasSessionWith(peerToken: string): boolean {
    const now = this.options.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.peerToken !== peerToken) continue;
      // A half-finished session (peer never answered) must not block this peer
      // forever. Its own duration/idle budget retires it.
      if (session.isClosed || session.checkBudgets(now)) {
        this.sessions.delete(sessionId);
        this.announced.delete(sessionId);
        this.pushed.delete(sessionId);
        continue;
      }
      return true;
    }
    return false;
  }
}
