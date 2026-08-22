/**
 * AMOLED Dark Theme tokens.
 *
 * Pure #000000 backgrounds let OLED pixels turn off completely for lowest
 * possible battery drain. Every pixel that isn't content is OFF.
 *
 * Designed for zero-light readability and disaster-scenario usability.
 */

export const colors = {
  bg: {
    primary: '#000000',
    card: '#0D0D0D',
    elevated: '#1A1A1A',
    input: '#111111',
  },
  border: {
    default: '#262626',
    active: '#404040',
  },
  text: {
    primary: '#E8E8E8',
    secondary: '#808080',
    muted: '#555555',
    inverse: '#000000',
  },
  accent: {
    emergency: '#FF4D4D',
    warning: '#E8A317',
    success: '#22C55E',
    info: '#3B82F6',
    neutral: '#6B7280',
  },
  severity: {
    critical: '#FF4D4D',   // Level 3
    urgent: '#E8A317',     // Level 2
    moderate: '#3B82F6',   // Level 1
    info: '#6B7280',       // Level 0
  },
  status: {
    online: '#22C55E',
    offline: '#555555',
    stale: '#E8A317',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
  hero: 36,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

export type SeverityLevel = 0 | 1 | 2 | 3;

export function severityColor(level: SeverityLevel): string {
  switch (level) {
    case 3: return colors.severity.critical;
    case 2: return colors.severity.urgent;
    case 1: return colors.severity.moderate;
    case 0:
    default: return colors.severity.info;
  }
}

export function severityLabel(level: SeverityLevel): string {
  switch (level) {
    case 3: return 'CRITICAL';
    case 2: return 'URGENT';
    case 1: return 'MODERATE';
    case 0:
    default: return 'INFORMATIONAL';
  }
}
