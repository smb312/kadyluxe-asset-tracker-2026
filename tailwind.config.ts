import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette (ported from the prototype's CSS variables)
        ink: "#1A1714",
        paper: "#F5F2EC",
        line: "#E0DACE",
        muted: "#8A8175",
        gold: "#C6A06D",
        // status palette: green / amber / red / neutral, each with a bg tint
        ok: "#2FA36B",
        okbg: "#D7F0E2",
        warn: "#C98A1A",
        warnbg: "#FBEBC8",
        bad: "#C0506A",
        badbg: "#F7DEE4",
        neutral: "#9A9182",
        neutralbg: "#ECE7DD",
      },
      fontFamily: {
        disp: ["var(--font-disp)", "Barlow Condensed", "sans-serif"],
        body: ["var(--font-body)", "Barlow", "sans-serif"],
        mono: ["var(--font-mono)", "Inconsolata", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
