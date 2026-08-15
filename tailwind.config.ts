import type { Config } from 'tailwindcss';

/**
 * Colours come from CSS custom properties defined in globals.css, ported 1:1
 * from the source project's workflow_builder.css :root block. Tailwind reads
 * them, so the palette has exactly one definition.
 */
const channel = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // `rgb(var(--x-rgb) / <alpha-value>)` is what lets utilities take an
        // opacity modifier — `bg-accent/15`, `border-danger/40` and so on.
        bg: channel('--bg-dark-rgb'),
        panel: channel('--bg-panel-rgb'),
        card: channel('--bg-card-rgb'),
        border: channel('--border-rgb'),
        accent: channel('--accent-rgb'),
        'accent-2': channel('--accent-2-rgb'),
        'text-primary': channel('--text-primary-rgb'),
        'text-muted': channel('--text-muted-rgb'),
        'text-dark': channel('--text-dark-rgb'),
        'node-select': channel('--node-select-rgb'),
        danger: channel('--danger-rgb'),
        warning: channel('--warning-rgb'),
        success: channel('--success-rgb'),
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      fontSize: { base: '13px' },
    },
  },
  plugins: [],
};

export default config;
