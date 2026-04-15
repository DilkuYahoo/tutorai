/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    extend: {
      colors: {
        'slate-950': '#020617',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 60%, #1e1b4b 100%)',
      },
      keyframes: {
        'slide-in-right': {
          '0%':   { transform: 'translateX(60px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
        'slide-in-left': {
          '0%':   { transform: 'translateX(-60px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',      opacity: '1' },
        },
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.35s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-left':  'slide-in-left 0.35s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':        'fade-in 0.3s ease-out',
        'fade-up':        'fade-up 0.5s cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
}
