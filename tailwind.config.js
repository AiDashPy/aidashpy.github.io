/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gbgraydark': '#1d2021',
        'gbgrayback': '#080909',
        'gbgraylight': '#1b2123',
        'gbgraytb': '#3c3836',
      },
    },
  },
  plugins: [],
}

