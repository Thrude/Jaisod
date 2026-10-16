/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Prompt', 'Noto Sans Thai', 'sans-serif'] },
    },
  },
  plugins: [],
};
