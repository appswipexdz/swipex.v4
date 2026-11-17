/** @type {import('tailwindcss').Config} */
module.exports = {
  // نفس إعداد نسخة Tailwind التي كانت تعمل داخل المتصفح (Play CDN)
  darkMode: "class",
  content: [
    "./*.html",
    "./assets/js/**/*.js",
    "./assets/i18n/**/*.js"
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
