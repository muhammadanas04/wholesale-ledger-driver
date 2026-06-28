/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        palette: {
          darkest: '#051F20',
          darker: '#0B2B26',
          dark: '#163832',
          primary: '#235347',
          light: '#8EB69B',
          lightest: '#DAF1DE',
        },
      },
    },
  },
  plugins: [],
};
