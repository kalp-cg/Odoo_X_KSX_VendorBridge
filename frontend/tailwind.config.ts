import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9f4',
          100: '#dcf2e3',
          200: '#bce4cb',
          300: '#8ed0a8',
          400: '#5cb583',
          500: '#3a9b65',
          600: '#2a7d50',
          700: '#236442',
          800: '#1f5037',
          900: '#1b4230',
        },
        ink: {
          50: '#f7f8fa',
          100: '#eef0f3',
          200: '#dee2e8',
          300: '#bdc4cf',
          400: '#8b95a4',
          500: '#5b6573',
          600: '#404956',
          700: '#2c333d',
          800: '#1b2028',
          900: '#0f131a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 19, 26, 0.04), 0 1px 3px rgba(15, 19, 26, 0.06)',
        card: '0 1px 2px rgba(15, 19, 26, 0.05), 0 4px 12px rgba(15, 19, 26, 0.06)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
