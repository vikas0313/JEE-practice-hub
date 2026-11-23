/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nta: {
          header: '#1a237e',
          'header-light': '#3949ab',
          'not-visited': '#9e9e9e',
          'not-answered': '#e53935',
          answered: '#43a047',
          'marked-review': '#8e24aa',
          'answered-marked': '#8e24aa',
        },
      },
    },
  },
  plugins: [],
}

