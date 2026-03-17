import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "felicio-bg": "rgb(var(--felicio-bg) / <alpha-value>)",
        "felicio-ink": "rgb(var(--felicio-ink) / <alpha-value>)",
        "felicio-pink": "rgb(var(--felicio-pink) / <alpha-value>)",
        "felicio-lilac": "rgb(var(--felicio-lilac) / <alpha-value>)",
        "felicio-mint": "rgb(var(--felicio-mint) / <alpha-value>)",
        "felicio-sun": "rgb(var(--felicio-sun) / <alpha-value>)",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.06)",
      },
      borderRadius: {
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
