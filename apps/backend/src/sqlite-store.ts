import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BackendStore } from './services.js';
import { IncidentReducer } from '@dsm/incident';

export interface ResponderRecord {
  readonly responderRef: string;
  readonly name: string;
  readonly district: string;
  readonly capabilities: readonly string[];
  readonly available: boolean;
  readonly provisionedByDemo: true;
  readonly assignmentId?: string;
  readonly incidentId?: string;
  readonly status: 'available' | 'assigned' | 'en-route' | 'arrived';
  readonly lastUpdatedAtMs: number;
}

export interface RegionalRecord {
  readonly objectId: string;
  readonly kind: 'shelter' | 'medical' | 'food-water' | 'safe-zone' | 'hazard' | 'route';
  readonly name: string;
  readonly district: string;
  readonly latE7: number;
  readonly lonE7: number;
  readonly state: string;
  readonly version: number;
  readonly updatedAtMs: number;
  readonly synthetic: true;
}

export interface CampaignRecord {
  readonly campaignId: string;
  readonly campaignVersion: number;
  readonly title: string;
  readonly summary: string;
  readonly dataType?: 'official-alert' | 'check-in' | 'regional-record';
  readonly objectId?: string;
  readonly regionCode: string;
  readonly state: import('@dsm/contracts').CampaignState;
  readonly profile: 'audible-fast' | 'audible-normal' | 'ultrasound-normal';
  readonly contentRevision: number;
  readonly validatedRevision?: number;
  readonly approvalDigest?: string;
  readonly packetId: string;
  readonly packetBytesBase64: string;
  readonly messageType: number;
  readonly priority: number;
  readonly severity: number;
  readonly category: number;
  readonly instruction: number;
  readonly broadcastProgram?: BroadcastProgramRecord;
  readonly decodeResult?: BroadcastDecodeResult;
  readonly preview: {
    readonly totalTier2Bytes: number;
    readonly totalDurationS: number;
    readonly budgetS: number;
    readonly overBudget: boolean;
    readonly items: readonly {
      readonly packetId: string;
      readonly tier1Bytes: number;
      readonly tier2Bytes: number;
      readonly frameCount: number;
      readonly repeats: number;
      readonly estimatedAudioMs: number;
    }[];
    readonly burstSchedule: readonly { readonly packetId: string; readonly repeatIndex: number }[];
  };
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface BroadcastProgramRecord {
  readonly programId: string;
  readonly campaignId: string;
  readonly campaignVersion: number;
  readonly profile: 'audible-fast' | 'audible-normal' | 'ultrasound-normal';
  readonly sampleRate: 48000;
  readonly artifactDigest: string;
  readonly uniqueFramesBase64: readonly string[];
  readonly playbackFramesBase64: readonly string[];
  readonly createdAtMs: number;
}

export interface BroadcastDecodeResult {
  readonly passed: boolean;
  readonly expectedFrames: number;
  readonly recoveredFrames: number;
  readonly corruptFrames: number;
  readonly unexpectedFrames: number;
  readonly missingFrames: number;
  readonly receiverLabel: string;
  readonly receptionTransport: 'tier2-mic' | 'tier2-direct';
  readonly decodedMessage?: {
    readonly packetId: string;
    readonly messageType: number;
    readonly alertId: string;
    readonly campaignId: string;
    readonly regionCode: string;
    readonly category: number;
    readonly instruction: number;
    readonly severity: number;
    readonly language: string;
    readonly text: string;
    readonly typeName?: string;
    readonly payload?: Record<string, unknown>;
  };
  readonly testedAtMs: number;
}

export interface AuditRecord {
  readonly id: string;
  readonly atMs: number;
  readonly action: string;
  readonly subject: string;
  readonly detail: string;
}

interface OperationsSnapshot {
  readonly responders: readonly ResponderRecord[];
  readonly regionalRecords: readonly RegionalRecord[];
  readonly campaigns: readonly CampaignRecord[];
  readonly audit: readonly AuditRecord[];
}

export class SqliteBackendStore extends BackendStore {
  readonly responders = new Map<string, ResponderRecord>();
  readonly regionalRecords = new Map<string, RegionalRecord>();
  readonly campaigns = new Map<string, CampaignRecord>();
  readonly audit: AuditRecord[] = [];
  private readonly database: DatabaseSync;
  private restoring = true;

  constructor(readonly databasePath: string) {
    super();
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS app_snapshot (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
    `);
    this.restore();
    this.restoring = false;
  }

  private readSnapshot<T>(key: string): T | undefined {
    const row = this.database.prepare('SELECT value FROM app_snapshot WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? (JSON.parse(row.value) as T) : undefined;
  }

  private restore(): void {
    const core = this.readSnapshot<ReturnType<BackendStore['snapshotCore']>>('core');
    if (core) this.restoreCore(core);
    const operations = this.readSnapshot<OperationsSnapshot>('operations');
    if (!operations) return;
    for (const responder of operations.responders) this.responders.set(responder.responderRef, responder);
    for (const record of operations.regionalRecords) {
      const fallback = legacyCoordinate(record.objectId);
      this.regionalRecords.set(record.objectId, {
        ...record,
        latE7: record.latE7 ?? fallback.latE7,
        lonE7: record.lonE7 ?? fallback.lonE7,
      });
    }
    for (const campaign of operations.campaigns) this.campaigns.set(campaign.campaignId, campaign);
    this.audit.push(...operations.audit);
  }

  protected override changed(): void {
    if (this.restoring) return;
    this.writeSnapshot('core', this.snapshotCore());
  }

  saveOperations(): void {
    this.writeSnapshot('operations', {
      responders: [...this.responders.values()],
      regionalRecords: [...this.regionalRecords.values()],
      campaigns: [...this.campaigns.values()],
      audit: this.audit,
    } satisfies OperationsSnapshot);
  }

  recordAudit(record: AuditRecord): void {
    this.audit.unshift(record);
    if (this.audit.length > 250) this.audit.length = 250;
    this.saveOperations();
  }

  resetAll(): void {
    this.database.exec('DELETE FROM app_snapshot');
    this.packets.clear();
    this.observations.splice(0);
    this.seenBatches.clear();
    this.outbound.clear();
    this.gatewayTokens.clear();
    this.outboundSeq = 0;
    this.incidents = new IncidentReducer();
    this.responders.clear();
    this.regionalRecords.clear();
    this.campaigns.clear();
    this.audit.splice(0);
    this.changed();
    this.saveOperations();
  }

  closeDatabase(): void {
    this.database.close();
  }

  private writeSnapshot(key: string, value: unknown): void {
    this.database
      .prepare(`
        INSERT INTO app_snapshot(key, value, updated_at_ms)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at_ms = excluded.updated_at_ms
      `)
      .run(key, JSON.stringify(value), Date.now());
  }
}

function legacyCoordinate(objectId: string): { latE7: number; lonE7: number } {
  const coordinates: Record<string, readonly [number, number]> = {
    'SHL-AS-001': [26.1445, 91.7362],
    'SHL-AS-002': [26.3509, 92.6922],
    'MED-AS-001': [27.4728, 94.912],
    'FWD-AS-001': [26.2529, 92.3424],
    'SFZ-AS-001': [26.1158, 91.7086],
    'HZD-AS-001': [26.415, 92.73],
    'RTE-AS-001': [26.18, 91.78],
  };
  const [lat, lon] = coordinates[objectId] ?? [26.2, 92.2];
  return { latE7: Math.round(lat * 1e7), lonE7: Math.round(lon * 1e7) };
}
