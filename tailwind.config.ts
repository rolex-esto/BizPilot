import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#eef8ff",
          100: "#d8eeff",
          200: "#b9e1fe",
          300: "#89cffe",
          400: "#52b2fc",
          500: "#2a92f7",
          600: "#1374eb",
          700: "#0e5dcd",
          800: "#114ca6",
          900: "#144283",
          950: "#0d2953",
        },
      },
    },
  },
  plugins: [],
};
export default config;
