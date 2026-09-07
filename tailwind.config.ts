import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#062B52",
          dark: "#002749",
          hover: "#0A3B69",
        },
        ink: "#09264A",
        ink2: "#33445B",
        muted: "#718096",
        cream: {
          DEFAULT: "#FAF7F1",
          warm: "#F6EFE5",
          beige: "#F3ECE2",
        },
        paper: "#FFFDFC",
        line: "#DDD7CF",
        field: "#D8D2C9",
        gold: {
          DEFAULT: "#D3921D",
          hover: "#B9790C",
          light: "#FFF4DB",
        },
        good: { DEFAULT: "#24833B", light: "#E6F2E5" },
        warn: { DEFAULT: "#E99924", light: "#FFF0D9" },
        bad: { DEFAULT: "#C9473D", light: "#FBE8E5" },
        whatsapp: "#128C4A",

        // Aliases from the previous dark theme, mapped onto the new palette
        // so the admin keeps working while it's restyled separately.
        char: "#FAF7F1",
        pan: "#FFFDFC",
        ash: "#DDD7CF",
        custard: "#09264A",
        caramel: "#D3921D",
        ember: "#C9473D",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "Arial", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        btn: "14px",
      },
      boxShadow: {
        card: "0 10px 30px rgba(26, 38, 52, 0.10)",
        soft: "0 2px 10px rgba(26, 38, 52, 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
