import type { RegionalRecord } from './types';

const CENTRE_KINDS = new Set(['shelter', 'medical', 'food-water', 'safe-zone']);

export function isCentre(record: RegionalRecord): boolean {
  return CENTRE_KINDS.has(record.kind);
}

export function isOperationallyUsable(record: RegionalRecord): boolean {
  if (record.kind === 'hazard') return record.state === 'cleared';
  return record.state === 'open';
}

export function operationalVerdict(record: RegionalRecord): string {
  if (record.kind === 'route') return record.state === 'open' ? 'Route available' : 'Do not route';
  if (record.kind === 'hazard') return record.state === 'cleared' ? 'Hazard cleared' : `${titleCase(record.state)} hazard`;
  return record.state === 'open' ? 'Available for routing' : 'Do not route without review';
}

function titleCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1).replaceAll('-', ' ')}`;
}
