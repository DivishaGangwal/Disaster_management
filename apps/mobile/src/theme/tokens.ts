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
    primary: '#050811',
    card: '#0D1424',
    elevated: '#141E33',
    input: '#090E1A',
    glass: 'rgba(13, 20, 36, 0.85)',
  },
  border: {
    default: 'rgba(0, 242, 254, 0.15)',
    active: '#00F2FE',
    neonPink: '#FF007A',
    subtle: '#1E293B',
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
    inverse: '#000000',
    cyan: '#00F2FE',
    pink: '#FF2E93',
  },
  accent: {
    emergency: '#FF0055',
    pink: '#FF007A',
    cyan: '#00F2FE',
    warning: '#FFB300',
    success: '#00E676',
    info: '#00C6FF',
    neutral: '#64748B',
  },
  severity: {
    critical: '#FF0055',   // Level 3
    urgent: '#FF9500',     // Level 2
    moderate: '#00F2FE',   // Level 1
    info: '#64748B',       // Level 0
  },
  status: {
    online: '#00E676',
    offline: '#64748B',
    stale: '#FFB300',
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
