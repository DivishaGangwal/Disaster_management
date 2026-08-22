/**
 * OFFLINE CONTENT PACK CONTRACT  --  FROZEN (Gate III)
 *
 * Spec: 02-... "Offline map/content-pack architecture"; DEC-011, DEC-012,
 * MAP-001, MAP-002, OFF-006.
 *
 * One region, predownloaded, readable with no internet. Compact object IDs
 * resolve ONLY through this typed registry -- never as a path, URL, or query.
 */

import type { ObjectId } from './envelope.js';

export interface PackManifest {
  readonly packId: string;
  readonly packVersion: number;
  readonly regionCode: string;
  readonly regionName: string;
  readonly bounds: {
    readonly minLatE7: number;
    readonly minLonE7: number;
    readonly maxLatE7: number;
    readonly maxLonE7: number;
  };
  readonly createdAtMs: number;
  /** App schema version this pack is compatible with. */
  readonly schemaVersion: number;
  readonly baseMapArtifact: string;
  readonly languages: readonly string[];
  readonly integrity: string;
  readonly sizeBytes: number;
  readonly readiness: 'ready' | 'partial' | 'missing';
  readonly counts: Readonly<Record<PackObjectType, number>>;
  /** Provenance/licence note for the seed data (Workstream D deliverable). */
  readonly sourceNote: string;
}

export type PackObjectType =
  | 'shelter'
  | 'medical'
  | 'food-water'
  | 'safe-zone'
  | 'help-centre'
  | 'route'
  | 'region'
  | 'guide'
  | 'form'
  | 'phrase';

export interface PackObject {
  readonly objectId: ObjectId;
  readonly type: PackObjectType;
  readonly name: string;
  readonly latE7?: number;
  readonly lonE7?: number;
  /** Baseline state before any packet applies a delta. */
  readonly baselineState?: number;
  readonly capabilityBits?: number;
  /** Short labels by language tag, for accessibility and low literacy. */
  readonly labels?: Readonly<Record<string, string>>;
}

export interface RouteEdge {
  readonly objectId: ObjectId;
  readonly name: string;
  readonly fromLatE7: number;
  readonly fromLonE7: number;
  readonly toLatE7: number;
  readonly toLonE7: number;
  readonly baselineState: number;
}

/** Cached check-in form. T2/Tier1 packets activate it by ID; schemas never fly. */
export interface CachedForm {
  readonly objectId: ObjectId;
  readonly title: string;
  readonly fields: readonly {
    readonly key: string;
    readonly kind: 'status' | 'count' | 'location' | 'text';
    readonly required: boolean;
    readonly options?: readonly number[];
  }[];
}

/** Prepared phrases keep the wire small and support low literacy (01-...). */
export interface PreparedPhrase {
  readonly phraseId: number;
  readonly text: Readonly<Record<string, string>>;
}

export interface ContentPack {
  readonly manifest: PackManifest;
  readonly objects: readonly PackObject[];
  readonly routes: readonly RouteEdge[];
  readonly forms: readonly CachedForm[];
  readonly phrases: readonly PreparedPhrase[];
}

/**
 * Typed resolution. Returns undefined for an unknown ID so callers can show
 * fallback text and log the missing object (MAP-008) instead of substituting.
 */
export interface ObjectResolver {
  resolve(objectId: ObjectId, expectedType?: PackObjectType): PackObject | undefined;
  resolveRoute(objectId: ObjectId): RouteEdge | undefined;
  resolveForm(objectId: ObjectId): CachedForm | undefined;
  readonly manifest: PackManifest;
}
