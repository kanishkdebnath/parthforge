import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      fontFamily: {
        // Single font family — Inter via Tailwind's default sans stack.
        // `font-display` remains as a class to ease the transition; existing
        // usages keep working and render Inter (matches the new design).
        display: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // New Stripe/Apple palette — primary brand is sky, done is emerald,
        // overdue is red. All three replace the amber/lime/rose set.
        brand: {
          DEFAULT: '#0ea5e9', // sky-500
          hover: '#0284c7',   // sky-600
          subtle: '#e0f2fe',  // sky-100
          ring: '#bae6fd',    // sky-200
          foreground: '#f0f9ff', // sky-50
        },
        done: {
          DEFAULT: '#10b981', // emerald-500
          subtle: '#d1fae5',  // emerald-100
          foreground: '#ecfdf5', // emerald-50
        },
        overdue: {
          DEFAULT: '#dc2626', // red-600
          subtle: '#fee2e2',  // red-100
          foreground: '#fef2f2', // red-50
        },
        // KEPT (for now) — `active` is the old amber token. Old components
        // still reference it. Removed in Task 7 once all references are gone.
        active: {
          DEFAULT: '#b45309', // amber-700
          foreground: '#fffbeb',
          subtle: '#fef3c7',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
