/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        basalt: {
          900: '#0D0B08',
          800: '#161310',
          700: '#1C1815',
          600: '#2E2820',
          500: '#3A332A',
          400: '#4A4238',
          300: '#5A5248',
        },
        signal: {
          critical: '#FF5A2B',
          warning: '#D9A441',
          safe: '#4FA37A',
          info: '#6E93B5',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Courier New', 'monospace'],
      },
      animation: {
        'pulse-live': 'pulse-live 1.4s ease-in-out infinite',
        'sweep': 'sweep 3s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-live': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        sweep: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
