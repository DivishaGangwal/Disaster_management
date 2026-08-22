export type SeverityLevel = 0 | 1 | 2 | 3;

export interface Severity {
  level: SeverityLevel;
  label: string;
  color: string;
}

export const severities: Severity[] = [
  { level: 0, label: 'INFORMATIONAL', color: '#6B7280' },
  { level: 1, label: 'MODERATE', color: '#3B82F6' },
  { level: 2, label: 'URGENT', color: '#E8A317' },
  { level: 3, label: 'CRITICAL', color: '#FF4D4D' },
];

export function getSeverity(level: SeverityLevel): Severity {
  return severities[level] ?? severities[0];
}
