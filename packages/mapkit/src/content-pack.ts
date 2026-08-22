/**
 * Content-pack loading and typed object resolution.
 *
 * Spec: 02-... "Object resolution" -- "The resolver checks object type, pack
 * compatibility, version, and expected constraints. It never treats packet
 * text as a filesystem path, URL, query, or executable command."
 */

import type { ContentPack, ObjectId, ObjectResolver, PackObject, PackObjectType, RouteEdge, CachedForm } from '@dsm/contracts';

export class PackResolver implements ObjectResolver {
  private readonly byId = new Map<ObjectId, PackObject>();
  private readonly routesById = new Map<ObjectId, RouteEdge>();
  private readonly formsById = new Map<ObjectId, CachedForm>();

  constructor(private readonly pack: ContentPack) {
    for (const object of pack.objects) this.byId.set(object.objectId, object);
    for (const route of pack.routes) this.routesById.set(route.objectId, route);
    for (const form of pack.forms) this.formsById.set(form.objectId, form);
  }

  get manifest() {
    return this.pack.manifest;
  }

  resolve(objectId: ObjectId, expectedType?: PackObjectType): PackObject | undefined {
    const object = this.byId.get(objectId);
    if (!object) return undefined;
    // Type mismatch is a miss, not a silent substitution (MAP-008).
    if (expectedType && object.type !== expectedType) return undefined;
    return object;
  }

  resolveRoute(objectId: ObjectId): RouteEdge | undefined {
    return this.routesById.get(objectId);
  }

  resolveForm(objectId: ObjectId): CachedForm | undefined {
    return this.formsById.get(objectId);
  }

  phrase(phraseId: number, language: string): string | undefined {
    const entry = this.pack.phrases.find((p) => p.phraseId === phraseId);
    return entry?.text[language] ?? entry?.text['en'];
  }

  /** True when a coordinate falls inside the pack's declared bounds. */
  withinBounds(latE7: number, lonE7: number): boolean {
    const b = this.pack.manifest.bounds;
    return latE7 >= b.minLatE7 && latE7 <= b.maxLatE7 && lonE7 >= b.minLonE7 && lonE7 <= b.maxLonE7;
  }

  /** OFF-006: readiness is reported, never assumed. */
  isReady(): boolean {
    return this.pack.manifest.readiness === 'ready';
  }
}

/** Parses a JSON content pack with bounded, defensive checks. */
export function loadContentPack(raw: unknown): ContentPack {
  if (typeof raw !== 'object' || raw === null) throw new Error('content pack must be an object');
  const pack = raw as Partial<ContentPack>;
  if (!pack.manifest) throw new Error('content pack is missing its manifest');
  if (!Array.isArray(pack.objects)) throw new Error('content pack is missing its object registry');
  return {
    manifest: pack.manifest,
    objects: pack.objects,
    routes: pack.routes ?? [],
    forms: pack.forms ?? [],
    phrases: pack.phrases ?? [],
  };
}
