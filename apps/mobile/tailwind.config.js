/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter'],
        'inter-bold': ['Inter_700Bold'],
        'inter-semibold': ['Inter_600SemiBold'],
        'inter-medium': ['Inter_500Medium'],
      },
      colors: {
        // Tactical Response — Elevation Levels
        surface: {
          base: '#000000',         // L0 — pure black
          l1: '#1C1C1E',           // L1 — cards, containers
          l2: '#2C2C2E',           // L2 — inputs, active states
          dim: '#111410',
          container: '#1d201c',
          'container-high': '#282b26',
        },
        // Text
        txt: {
          primary: '#FFFFFF',
          secondary: '#AEAEB2',
          muted: '#8c9387',
          accent: '#a1d494',       // primary green text
        },
        // Borders
        border: {
          muted: '#3A3A3C',
          active: '#2D5A27',       // primary green border
        },
        // Functional
        primary: '#2D5A27',             // deep forest green — buttons
        'primary-accent': '#a1d494',    // light green — text / active accents
        'primary-container': '#2D5A27',
        sos: '#FF3B30',                 // SOS urgent red
        'status-critical': '#FF453A',
        'status-warning': '#FFD60A',
        'status-moderate': '#AEAEB2',
        error: '#ffb4ab',
        'error-container': '#93000a',
        // Severity chips
        'sev-critical': '#FF453A',
        'sev-urgent': '#FFD60A',
        'sev-moderate': '#6B7280',
        'sev-info': '#3A3A3C',
      },
      borderRadius: {
        none: '0px',
      },
      spacing: {
        'touch': '56',     // 56px minimum touch target
        'sos': '120',      // 120px SOS button
        'edge': '20',      // 20px edge margin
        'gutter': '12',
      },
      fontSize: {
        'display-sos': ['48px', { lineHeight: '52px', fontWeight: '800', letterSpacing: '-0.04em' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '700' }],
        'headline-mobile': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-bold': ['14px', { lineHeight: '20px', fontWeight: '700', letterSpacing: '0.05em' }],
        'mono-status': ['13px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.02em' }],
      },
    },
  },
  plugins: [],
};
