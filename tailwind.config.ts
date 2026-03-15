import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        mac: {
          bg: '#1a1a1a',
          card: '#252525',
          accent: '#007aff',
          muted: '#8e8e93',
          border: '#3a3a3c',
          input: '#1e1e1e',
          hover: '#4a4a4c',
          danger: '#ef4444',
          success: '#22c55e',
        },
      },
      borderRadius: {
        mac: '12px',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config
