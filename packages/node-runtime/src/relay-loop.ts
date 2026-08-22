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
  MessageType,
  SourceClass,
  type TransportAdapter,
  type TransportEvent,
} from '@dsm/contracts';
import { buildInventory, buildLinkReceipt, decodePacket, toEpochS } from '@dsm/codec';
import { SessionStateMachine, shouldInitiate } from '@dsm/routing';
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
  private readonly peerInventories = new Map<string, Set<string>>();
  private unsubscribe?: () => void;
  private running = false;

  constructor(private readonly options: RelayLoopOptions) {}

  async start(): Promise<void> {
    const { adapter, engine } = this.options;
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
      highestWaitingPriority: 0,
      inventoryHint: engine.currentQueueEpoch,
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
        await engine.peers.observe({
          peerToken: event.nodeToken,
          lastSeenAtMs: event.observedAtMs,
          ...(event.rssi !== undefined ? { rssi: event.rssi } : {}),
          gatewayProven: event.summary.gatewayProven,
          queueEpoch: event.summary.queueEpoch,
          sessionsCompleted: 0,
          sessionsFailed: 0,
        });
        engine.events.emit({
          category: EventCategory.PEER_DISCOVERY,
          name: 'observed',
          severity: 'debug',
          atMs: event.observedAtMs,
          peerToken: event.nodeToken,
        });

        // Deterministic arbitration: only one side normally initiates.
        if (this.running && shouldInitiate(engine.nodeToken, event.nodeToken)) {
          if (!this.hasSessionWith(event.nodeToken) && event.summary.acceptingConnections) {
            try {
              const sessionId = await adapter.openSession(event.nodeToken);
              this.sessions.set(
                sessionId,
                new SessionStateMachine(sessionId, event.nodeToken, true, now()),
              );
              await this.runSession(sessionId, event.nodeToken);
            } catch {
              // Out of range or refused: bounded backoff handles the retry.
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
          await this.pushOffers(event.sessionId, event.peerToken);
        }
        break;
      }

      case 'record-received': {
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
            } catch {
              // The peer may already have closed; the receipt is best-effort.
            }
          }
        }

        this.sessions.get(event.sessionId)?.recordAcknowledged(event.atMs);
        break;
      }

      case 'session-closed': {
        this.sessions.delete(event.sessionId);
        this.peerInventories.delete(event.peerToken);
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

  /** Hello -> inventory -> request -> transfer -> receipt -> close. */
  private async runSession(sessionId: string, peerToken: string): Promise<void> {
    const { engine, adapter, now } = this.options;
    const machine = this.sessions.get(sessionId);
    if (!machine) return;

    const atMs = now();
    const buildCtx = {
      sourceId: engine.localSourceId,
      sourceClass:
        engine.profile.role === 'responder' ? SourceClass.RESPONDER_PROVISIONED : SourceClass.GENERAL_PUBLIC,
      nowS: toEpochS(atMs),
    };

    machine.advance(atMs); // hello
    machine.advance(atMs); // inventory

    const ids = await engine.inventoryIds();
    await adapter.sendRecord(
      sessionId,
      buildInventory(buildCtx, {
        criticalIds: ids.slice(0, 16),
        entries: [],
        terminalIds: [],
        queueEpoch: engine.currentQueueEpoch,
        truncated: ids.length > 16,
      }),
    );

    machine.advance(atMs); // request
    machine.advance(atMs); // transfer

    await this.pushOffers(sessionId, peerToken);

    machine.advance(now()); // receipt
    machine.advance(now()); // reconciliation
    machine.advance(now()); // close
    await adapter.closeSession(sessionId);
  }

  /**
   * Sends the packets this node holds that the peer appears to be missing.
   * Both the initiating and the accepting side run this -- that is what makes
   * the session bidirectional.
   */
  private async pushOffers(sessionId: string, peerToken: string): Promise<void> {
    const { engine, adapter, now } = this.options;
    const machine = this.sessions.get(sessionId);
    if (!machine) return;

    const peerInventory = this.peerInventories.get(peerToken) ?? new Set<string>();
    const plan = await engine.planSessionTransfer(peerToken, peerInventory, now());

    engine.events.emit({
      category: EventCategory.INVENTORY,
      name: 'planned',
      severity: 'debug',
      atMs: now(),
      sessionId,
      peerToken,
      metrics: { offered: plan.offers.length, skipped: plan.skipped.length, bytes: plan.totalBytes },
    });

    for (const offer of plan.offers) {
      const stored = await engine.packets.get(offer.candidate.packetId);
      if (!stored) continue;
      if (!machine.canSend(stored.encoded.totalBytes)) break;
      try {
        await adapter.sendRecord(sessionId, stored.encoded);
      } catch {
        break; // the peer closed or moved out of range; custody is unchanged
      }
      machine.recordSent(stored.encoded.totalBytes, now());
      await engine.recordTransfer(offer.candidate.packetId, peerToken, now());
    }
  }

  private hasSessionWith(peerToken: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.peerToken === peerToken && !session.isClosed) return true;
    }
    return false;
  }
}
