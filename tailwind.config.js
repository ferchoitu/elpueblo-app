/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tema oscuro alto contraste
        base: {
          900: '#0b0f14',
          800: '#121821',
          700: '#1b2430',
          600: '#26313f',
          500: '#38465a',
        },
        acento: {
          DEFAULT: '#22c55e',
          hover: '#16a34a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
