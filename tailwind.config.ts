import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Zim Fantasy Football brand colors — green & gold, deliberately not
        // tied to any single club's colors (an independent platform covering
        // every Zimbabwean team shouldn't visually read as "belonging" to one).
        zff: {
          green: "#15803D",
          "green-dark": "#14532D",
          "green-light": "#22C55E",
          "green-glow": "#86EFAC",
          // Light-mode surface palette
          black: "#0F172A",           // dark text / headings
          "black-soft": "#1E293B",    // secondary dark text
          "black-card": "#FFFFFF",    // card backgrounds (white)
          "black-border": "#E2E8F0",  // borders (slate-200)
          gray: "#F1F5F9",            // muted backgrounds (slate-100)
          "gray-light": "#E2E8F0",    // subtle dividers (slate-200)
          white: "#FFFFFF",
          gold: "#CA8A04",
          "gold-dark": "#854D0E",
          red: "#EF4444",
          amber: "#F97316",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Bebas Neue'", "Impact", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      backgroundImage: {
        "pitch-pattern":
          "repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(21,128,61,0.04) 60px, rgba(21,128,61,0.04) 61px)",
        "hero-gradient":
          "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 50%, #ECFDF5 100%)",
        "card-gradient":
          "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 100%)",
        "green-glow-gradient":
          "radial-gradient(ellipse at center, rgba(21,128,61,0.08) 0%, transparent 70%)",
        "rank-gradient":
          "linear-gradient(90deg, #CA8A04, #F97316)",
      },
      boxShadow: {
        "green-glow": "0 0 12px rgba(21,128,61,0.18), 0 0 24px rgba(21,128,61,0.06)",
        "green-glow-lg": "0 0 20px rgba(21,128,61,0.22), 0 0 40px rgba(21,128,61,0.08)",
        "card-hover": "0 4px 16px rgba(15,23,42,0.08), 0 0 0 1px rgba(21,128,61,0.1)",
        glass: "0 2px 12px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)",
        "gold-glow": "0 0 12px rgba(202,138,4,0.2)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "pulse-green": "pulse-green 2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "fade-up": "fade-up 0.4s ease-out",
        "counter": "counter 1.5s ease-out",
        "shimmer": "shimmer 2s linear infinite",
        "live-pulse": "live-pulse 1.5s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      keyframes: {
        "pulse-green": {
          "0%, 100%": { boxShadow: "0 0 10px rgba(21,128,61,0.15)" },
          "50%": { boxShadow: "0 0 30px rgba(21,128,61,0.4)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "fade-up": {
          from: { transform: "translateY(20px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "live-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(0.95)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
    },
  },
  plugins: [animate],
};

export default config;
