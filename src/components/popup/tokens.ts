export type PopupState = "active-zero" | "active-threats" | "disconnected" | "paused";

export type Platform = "ChatGPT" | "Claude";

export const colors = {
  background: {
    start: "#0F172A",
    end: "#1E293B",
  },
  card: "rgba(51, 65, 85, 0.6)",
  border: "rgba(71, 85, 105, 0.5)",
  emerald: "#10B981",
  blue: "#3B82F6",
  red: "#F87171",
  amber: "#FBBF24",
  slate: "#94A3B8",
  muted: "#64748B",
} as const;

export const spacing = {
  grid: 8,
  padding: 16,
  gap: 16,
} as const;

export const typography = {
  hero: 60,
  platform: 24,
  header: 14,
  label: 10,
  footer: 11,
} as const;

export const dimensions = {
  width: 320,
  height: 420,
} as const;

