import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        ink: token("ink"),
        muted: token("muted"),
        line: token("line"),
        brand: { DEFAULT: token("brand"), deep: token("brand-deep"), soft: token("brand-soft"), ink: token("brand-ink") },
        accent: { DEFAULT: token("accent"), soft: token("accent-soft"), ink: token("accent-ink"), text: token("accent-text") },
        ok: { DEFAULT: token("ok"), soft: token("ok-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
        court: { DEFAULT: token("court"), line: token("court-line") },
      },
      fontFamily: {
        sans: ["Anuphan", "Noto Sans Thai", "system-ui", "sans-serif"],
        display: ["Chakra Petch", "Anuphan", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "14px", "2xl": "18px" },
      boxShadow: { card: "0 1px 2px rgb(20 34 27 / .05), 0 4px 16px rgb(20 34 27 / .05)" },
    },
  },
  plugins: [],
} satisfies Config;
