/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0D1B3E', light: '#162350', dark: '#080F22' },
        gold: { DEFAULT: '#F5A623', light: '#F7B94A', dark: '#D4891C' },
        coop: {
          green: '#16A34A', 'green-light': '#DCFCE7',
          red: '#DC2626', 'red-light': '#FEE2E2',
          orange: '#EA580C', 'orange-light': '#FED7AA',
          blue: '#2563EB', 'blue-light': '#DBEAFE',
          purple: '#7C3AED', 'purple-light': '#EDE9FE',
          teal: '#0D9488', 'teal-light': '#CCFBF1',
        }
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
        'card-hover': '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)'
      }
    }
  },
  plugins: []
}
