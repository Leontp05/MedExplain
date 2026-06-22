/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — clinical trust
        ink: {
          DEFAULT: '#0F2A4A', // deep navy, primary headings
          soft: '#1E3A5F', // secondary navy
          muted: '#3B506B', // tertiary text on light
        },
        canvas: {
          DEFAULT: '#FAF8F4', // warm off-white background
          card: '#FFFFFF',
          subtle: '#F4F1EA', // alt section background
          raised: '#FCFBF7', // hover/raised surface
        },
        // Accent — medical teal, retained from original brand
        teal: {
          50: '#F0FAF7',
          100: '#D7F1E9',
          200: '#B0E3D3',
          400: '#4FC9AE',
          500: '#0D9488', // primary teal
          600: '#0B7A6F',
          700: '#095F58',
        },
        // Supporting tones
        sage: {
          50: '#F4F7F3',
          100: '#E5EDE2',
          200: '#C8D8C2',
        },
        sand: {
          100: '#F5EFE3',
          200: '#EBE2CE',
        },
        clay: {
          400: '#C7714F',
          500: '#A85A3B',
        },
        // Semantic
        success: { 50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 600: '#047857', 700: '#065F46' },
        warning: { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 600: '#B45309', 700: '#92400E' },
        danger: { 50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 600: '#B91C1C', 700: '#991B1B' },
        // Backward-compat aliases (so any remaining references still compile)
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#0F2A4A',
        },
        medical: {
          teal: '#0D9488',
          navy: '#0F2A4A',
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'display-xl': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-lg': ['2.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-md': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '600' }],
        'display-sm': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        'soft-sm': '0 1px 2px 0 rgba(15, 42, 74, 0.04), 0 1px 1px 0 rgba(15, 42, 74, 0.03)',
        soft: '0 2px 8px -2px rgba(15, 42, 74, 0.06), 0 4px 16px -4px rgba(15, 42, 74, 0.05)',
        'soft-md': '0 4px 16px -4px rgba(15, 42, 74, 0.08), 0 12px 32px -8px rgba(15, 42, 74, 0.08)',
        'soft-lg': '0 8px 32px -8px rgba(15, 42, 74, 0.10), 0 24px 64px -16px rgba(15, 42, 74, 0.12)',
        ring: '0 0 0 4px rgba(13, 148, 136, 0.12)',
        'ring-danger': '0 0 0 4px rgba(185, 28, 28, 0.12)',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
