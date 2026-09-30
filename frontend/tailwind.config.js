/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aerospace: {
          slate: '#0A0F1D',
          dark: '#050810',
          cyan: '#00F0FF',
          amber: '#FFB000'
        }
      }
    },
  },
  plugins: [],
}
