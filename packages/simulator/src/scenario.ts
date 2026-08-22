/**
 * DETERMINISTIC MULTI-NODE SIMULATOR
 *
 * Spec: 03-... Workstream C, "deterministic simulation of contacts, loss,
 * movement, expiry, and gateway appearance"; "Simulator tests".
 *
 * This is how every workstream proves behaviour BEFORE the Android devices are
 * ready, and how CI keeps proving it afterwards. Same engine, same validator,
 * same policy, same routing -- only the transport is simulated.
 */

import {
  SourceClass,
  type LocalProfile,
} from '@dsm/contracts';
import { NodeEngine, RelayLoop } from '@dsm/node-runtime';
import { RadioMedium, SimulatedTransportAdapter } from '@dsm/transport-core';

export interface SimNodeSpec {
  readonly name: string;
  readonly nodeToken: string;
  readonly sourceId: string;
  readonly role: LocalProfile['role'];
  readonly latE7?: number;
  readonly lonE7?: number;
}

export class SimNode {
  readonly engine: NodeEngine;
  readonly adapter: SimulatedTransportAdapter;
  readonly relay: RelayLoop;

  constructor(
    readonly spec: SimNodeSpec,
    medium: RadioMedium,
    regionCode: string,
  ) {
    this.adapter = new SimulatedTransportAdapter(spec.nodeToken, medium);
    this.engine = new NodeEngine({
      profile: {
        localUserId: spec.name,
        role: spec.role,
        language: 'en',
        responderProvisionedByDemo: spec.role === 'responder',
      },
      localSourceId: spec.sourceId,
      nodeToken: spec.nodeToken,
      regionCode,
      now: () => medium.clockMs,
    });
    if (spec.latE7 !== undefined && spec.lonE7 !== undefined) {
      this.engine.setCoarseLocation(spec.latE7, spec.lonE7);
    }
    this.relay = new RelayLoop({
      engine: this.engine,
      adapter: this.adapter,
      now: () => medium.clockMs,
      gatewayProven: () => this.engine.isGatewayProven(medium.clockMs),
    });
  }

  get sourceClass(): number {
    return this.spec.role === 'responder' ? SourceClass.RESPONDER_PROVISIONED : SourceClass.GENERAL_PUBLIC;
  }
}

export class Scenario {
  readonly medium: RadioMedium;
  readonly nodes = new Map<string, SimNode>();

  constructor(
    readonly regionCode: string,
    options: { readonly lossRate?: number; readonly latencyMs?: number; readonly seed?: number } = {},
  ) {
    this.medium = new RadioMedium({
      ...(options.lossRate !== undefined ? { lossRate: options.lossRate } : {}),
      ...(options.latencyMs !== undefined ? { latencyMs: options.latencyMs } : {}),
      random: seededRandom(options.seed ?? 1),
    });
  }

  addNode(spec: SimNodeSpec): SimNode {
    const node = new SimNode(spec, this.medium, this.regionCode);
    this.nodes.set(spec.name, node);
    return node;
  }

  node(name: string): SimNode {
    const node = this.nodes.get(name);
    if (!node) throw new Error(`unknown sim node "${name}"`);
    return node;
  }

  /** Puts two nodes in radio range of each other. */
  link(a: string, b: string): void {
    this.medium.connect(this.node(a).spec.nodeToken, this.node(b).spec.nodeToken);
  }

  /** Moves them apart: the store-carry-forward scenario. */
  unlink(a: string, b: string): void {
    this.medium.disconnect(this.node(a).spec.nodeToken, this.node(b).spec.nodeToken);
  }

  async startAll(): Promise<void> {
    for (const node of this.nodes.values()) await node.relay.start();
  }

  async stopAll(): Promise<void> {
    for (const node of this.nodes.values()) await node.relay.stop();
  }

  /** Advances simulated time. Everything is deterministic. */
  async advance(ms: number): Promise<void> {
    await this.medium.advance(ms);
  }

  /** Re-announces every node, which is what triggers new sessions. */
  async gossip(rounds = 3, stepMs = 200): Promise<void> {
    for (let i = 0; i < rounds; i += 1) {
      for (const node of this.nodes.values()) {
        if (node.relay.isRunning) await node.relay.refreshAdvertisement();
      }
      await this.advance(stepMs);
    }
  }

  /** Which nodes hold a given packet. The multi-hop assertion. */
  async holdersOf(packetId: string): Promise<readonly string[]> {
    const holders: string[] = [];
    for (const [name, node] of this.nodes) {
      if (await node.engine.packets.hasSeen(packetId)) holders.push(name);
    }
    return holders;
  }
}

/** Mulberry32: small, fast, deterministic. Runs reproduce exactly. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
