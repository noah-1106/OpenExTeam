/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FAFAF8',
        surface: {
          DEFAULT: '#FFFFFF',
          raised: '#F5F4F0',
        },
        border: {
          DEFAULT: '#E8E6E1',
          subtle: '#F0EEE9',
        },
        text: {
          primary: '#1C1917',
          secondary: '#78716C',
          muted: '#A8A29E',
        },
        accent: {
          DEFAULT: '#E5702A',
          hover: '#C85A1E',
          dim: 'rgba(229,112,42,0.1)',
        },
        orange: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#E5702A',
          600: '#C85A1E',
          700: '#9A3412',
        },
        stone: {
          50: '#FAFAF8',
          100: '#F5F4F0',
          200: '#E8E6E1',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        },
      },
      backgroundColor: {
        'bg': '#FAFAF8',
        'surface': '#FFFFFF',
        'surface-raised': '#F5F4F0',
      },
      borderColor: {
        'border': '#E8E6E1',
        'border-subtle': '#F0EEE9',
      },
      textColor: {
        'text-primary': '#1C1917',
        'text-secondary': '#78716C',
        'text-muted': '#A8A29E',
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(0,0,0,0.05)',
        'sm': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'md': '0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)',
        'lg': '0 8px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        'sm': '6px',
        DEFAULT: '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
      },
    },
  },
  plugins: [],
}
