/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        md: {
          background: '#FFFBFE',
          'on-surface': '#1C1B1F',
          primary: '#6750A4',
          'on-primary': '#FFFFFF',
          'secondary-container': '#E8DEF8',
          'on-secondary-container': '#1D192B',
          tertiary: '#7D5260',
          'on-tertiary': '#FFFFFF',
          'surface-container': '#F3EDF7',
          'surface-container-low': '#E7E0EC',
          outline: '#79747E',
          'on-surface-variant': '#49454F'
        }
      },
      fontFamily: {
        sans: ['Roboto', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        'md-sm': '12px',
        'md-md': '16px',
        'md-lg': '24px',
        'md-xl': '28px',
        'md-2xl': '32px',
        'md-3xl': '48px'
      },
      transitionTimingFunction: {
        md: 'cubic-bezier(0.2, 0, 0, 1)'
      },
      boxShadow: {
        'md-1': '0 1px 3px rgba(28, 27, 31, 0.08)',
        'md-2': '0 4px 12px rgba(28, 27, 31, 0.1)',
        'md-3': '0 8px 24px rgba(28, 27, 31, 0.12)'
      }
    }
  },
  plugins: []
}
