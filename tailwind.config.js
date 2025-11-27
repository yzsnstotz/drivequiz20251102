/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // iOS暗色模式配色
        'ios-dark': {
          bg: '#000000',
          'bg-secondary': '#1C1C1E',
          'bg-tertiary': '#2C2C2E',
          'bg-elevated': '#1C1C1E',
          text: '#FFFFFF',
          'text-secondary': '#EBEBF5',
          'text-tertiary': '#EBEBF599',
          border: '#38383A',
          'border-secondary': '#48484A',
        },
      },
      transitionTimingFunction: {
        'ios': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'ios-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ios-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      boxShadow: {
        'ios-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(0, 0, 0, 0.02)',
        'ios': '0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 4px 8px 0 rgba(0, 0, 0, 0.06), 0 0 0 0.5px rgba(0, 0, 0, 0.02)',
        'ios-md': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 8px 12px -2px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(0, 0, 0, 0.02)',
        'ios-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 0 0 0.5px rgba(0, 0, 0, 0.02)',
        'ios-dark-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 1px 3px 0 rgba(0, 0, 0, 0.4)',
        'ios-dark': '0 2px 4px 0 rgba(0, 0, 0, 0.4), 0 4px 8px 0 rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'ios-pulse': 'ios-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ios-bounce': 'ios-bounce 1.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'ios-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'ios-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-25%)' },
        },
      },
    },
  },
  plugins: [],
};
