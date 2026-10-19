/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        jikklo: {
          navy: "#071A2B",
          blue: "#0F3A5C",
          accent: "#2FA1D6",
        },
      },
    },
  },
  plugins: [],
};
