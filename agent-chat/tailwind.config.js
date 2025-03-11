/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#333333", // Dark gray
        secondary: "#555555", // Medium gray
        tertiary: "#777777", // Light-medium gray
        dark: {
          DEFAULT: "#111111", // Almost black
          900: "#111111",
          800: "#222222", // Dark gray
          700: "#333333"  // Medium-dark gray
        },
        light: {
          DEFAULT: "#FFFFFF", // White
          900: "#FFFFFF",
          800: "#F5F5F5", // Off-white
          700: "#EEEEEE"  // Light gray
        },
        accent: "#E5E5E5", // Light gray
        success: "#444444", // Dark gray (minimalist)
        warning: "#777777", // Medium gray
        error: "#111111",   // Almost black 
        info: "#555555"     // Medium gray
      },
      boxShadow: {
        card: "0 4px 12px rgba(0, 0, 0, 0.06)",
        soft: "0 2px 8px rgba(0, 0, 0, 0.04)",
        inner: "inset 0 1px 3px rgba(0, 0, 0, 0.04)",
        highlight: "0 0 0 1px rgba(60, 90, 190, 0.15)",
        glow: "0 2px 10px rgba(60, 90, 190, 0.15)"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"]
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    },
  },
  plugins: [],
};