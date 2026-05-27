/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pf: {
          bgStart: "#0F172A",
          bgEnd: "#1E293B",
          card: "rgba(51, 65, 85, 0.6)",
          border: "rgba(71, 85, 105, 0.5)",
          emerald: "#10B981",
          blue: "#3B82F6",
          red: "#F87171",
          amber: "#FBBF24",
          slate: "#94A3B8",
          muted: "#64748B",
        },
      },
      borderRadius: {
        pf: "14px",
      },
    },
  },
  plugins: [],
};

