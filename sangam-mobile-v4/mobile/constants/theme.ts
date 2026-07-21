// constants/theme.ts
// Same professional blue/slate palette as the web app (frontend/css/variables.css)

export const colors = {
  // Brand / accent
  purple:      "#1D4ED8",   // kept the name "purple" to match web variable names, it's blue now
  purple2:     "#2563EB",
  purple3:     "#3B82F6",
  purpleDark:  "#1E40AF",

  // Dark surfaces (dashboard-style screens: feed, chat, profile)
  ink:    "#0C0C0F",
  ink2:   "#13131A",
  ink3:   "#1A1A24",
  ink4:   "#22222E",

  // Light surfaces (auth screens)
  bg:     "#F1F5F9",
  white:  "#FFFFFF",
  border: "#CBD5E1",
  borderDark: "#2C2C3A",

  // Text
  text:    "#1E293B",
  text2:   "#475569",
  text3:   "#64748B",
  textOnDark:   "rgba(255,255,255,0.92)",
  textOnDark2:  "rgba(255,255,255,0.55)",
  textOnDark3:  "rgba(255,255,255,0.35)",

  // Status
  green:  "#16A34A",
  red:    "#DC2626",
  orange: "#EA580C",
  gold:   "#B45309",

  // Avatar palette (same 8 colors as web AV_COLORS)
  avatarColors: ["#1D4ED8","#2563EB","#16A34A","#0288D1","#E91E63","#FF5722","#00796B","#5C6BC0"],
};

export function getAvatarColor(seed: string) {
  const c = (seed || "A").charCodeAt(0) % colors.avatarColors.length;
  return colors.avatarColors[c];
}

export const radius = { sm: 6, md: 10, lg: 16, xl: 22 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
