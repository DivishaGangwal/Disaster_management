/**
 * Bounded diagnostic event log.
 * Spec: 02-... "Observability vocabulary"; 01-... screen 13 (Diagnostics).
 * INT-007: never record personal payload content here.
 */

import { STORAGE, type DiagnosticEvent, type EventSink } from '@dsm/contracts';

export class MemoryEventSink implements EventSink {
  private readonly events: DiagnosticEvent[] = [];

  constructor(private readonly maxEntries: number = STORAGE.MAX_EVENT_LOG_ENTRIES) {}

  emit(event: DiagnosticEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEntries) {
      this.events.splice(0, this.events.length - this.maxEntries);
    }
  }

  recent(limit: number): readonly DiagnosticEvent[] {
    return this.events.slice(-limit).reverse();
  }

  clear(): void {
    this.events.length = 0;
  }

  /** Everything, oldest first. Used by the evidence exporter. */
  all(): readonly DiagnosticEvent[] {
    return [...this.events];
  }
}

/** A sink that discards everything. Handy in tests and hot loops. */
export const NULL_EVENT_SINK: EventSink = {
  emit() {},
  recent() {
    return [];
  },
  clear() {},
};
