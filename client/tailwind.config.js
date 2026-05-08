/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F6F6F8',
        surface: {
          DEFAULT: '#FFFFFF',
          raised: '#F7F7FA',
        },
        border: {
          DEFAULT: '#E8E8EC',
          subtle: '#ECECF0',
        },
        text: {
          primary: '#2D2D35',
          secondary: '#6B6B78',
          muted: '#9CA3AF',
        },
        accent: {
          DEFAULT: '#5B6AD7',
          hover: '#4A58C0',
          dim: 'rgba(91, 106, 215, 0.08)',
        },
        blue: {
          50: '#F0F1FE',
          100: '#E0E3FA',
          500: '#6B7FD7',
          600: '#5B6AD7',
          700: '#4A58C0',
        },
        gray: {
          50: '#F6F7FA',
          100: '#F0F0F4',
          200: '#E0E0E6',
          300: '#C5C9D3',
          400: '#9CA3AF',
          500: '#6B6B78',
          600: '#5A5A68',
          700: '#4A4A55',
          800: '#2D2D35',
          900: '#1E1E24',
        },
        green: {
          50: '#EDF7F3',
          100: '#D8EDE4',
          500: '#5FA88F',
          600: '#4E917A',
          700: '#3D6B5A',
        },
        red: {
          50: '#FDF0F0',
          100: '#F5DEDE',
          500: '#C97A7A',
          600: '#B86565',
          700: '#8A5555',
        },
        amber: {
          50: '#FDF5EC',
          100: '#F0E0CC',
          500: '#C9965E',
          600: '#A87D4A',
          700: '#8A6A3E',
        },
        purple: {
          50: '#F5F0FA',
          100: '#E5D5F0',
          500: '#A67EC5',
          600: '#8A6AA8',
          700: '#7A5A9C',
        },
        teal: {
          50: '#EFF7F8',
          100: '#D5E8EA',
          500: '#5BA8B0',
          600: '#4A8F96',
        },
      },
      backgroundColor: {
        'bg': '#F6F6F8',
        'surface': '#FFFFFF',
        'surface-raised': '#F7F7FA',
      },
      borderColor: {
        'border': '#E8E8EC',
        'border-subtle': '#ECECF0',
      },
      textColor: {
        'text-primary': '#2D2D35',
        'text-secondary': '#6B6B78',
        'text-muted': '#9CA3AF',
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(0,0,0,0.04)',
        'sm': '0 1px 3px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        'sm': '4px',
        DEFAULT: '6px',
        'md': '8px',
        'lg': '10px',
        'xl': '12px',
      },
    },
  },
  plugins: [],
}
