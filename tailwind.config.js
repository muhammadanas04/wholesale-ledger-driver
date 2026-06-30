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
          darkest: '#0F1516',
          darker: '#162224',
          dark: '#1b282b',
          primary: '#234C58',
          light: '#7F8C94',
          lightest: '#C9C2C2',
        },
        brand: {
          darkest: '#0F1516',
          deep: '#162224',
          petrol: '#234C58',
          steel: '#7F8C94',
          silver: '#C9C2C2',
          brown: '#5E524B',
        },
      },
    },
  },
  plugins: [],
};
