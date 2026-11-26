export const presets = {
  direct_flash: {
    name: "Direct Flash Editorial",
    description: "Crisp frontal flash character, controlled highlights, deep but readable shadows.",
    recipe: { brightness: 1.025, saturation: 1.015, warmth: 1, contrast: 1.10, lightPower: 0.22, lightColor: "#fff1dc", direction: "center", softness: 0.58 }
  },
  film_flash: {
    name: "Film Flash",
    description: "Compact-camera flash character, warm highlight bias and gently lifted contrast.",
    recipe: { brightness: 1.025, saturation: 0.98, warmth: 4, contrast: 1.04, lightPower: 0.14, lightColor: "#ffe8cf", direction: "center", softness: 0.72 }
  },
  golden_hour: {
    name: "Golden Hour",
    description: "Warm directional late-afternoon light with a soft falloff.",
    recipe: { brightness: 1.035, saturation: 1.025, warmth: 8, contrast: 1.035, lightPower: 0.24, lightColor: "#ffc77d", direction: "top-left", softness: 0.78 }
  },
  softbox: {
    name: "Softbox Studio",
    description: "Broad soft neutral key light and gentle fill character.",
    recipe: { brightness: 1.035, saturation: 1.0, warmth: 1, contrast: 0.98, lightPower: 0.20, lightColor: "#fff4e6", direction: "top-left", softness: 0.92 }
  },
  moody_low_key: {
    name: "Moody Low-Key",
    description: "Controlled low-key tonality with directional warm key light.",
    recipe: { brightness: 0.975, saturation: 0.97, warmth: 2, contrast: 1.13, lightPower: 0.16, lightColor: "#f3d9b6", direction: "top-left", softness: 0.48 }
  },
  hard_sun: {
    name: "Hard Sun Editorial",
    description: "Crisp daylight contrast with a defined directional highlight bias.",
    recipe: { brightness: 1.04, saturation: 1.025, warmth: 3, contrast: 1.16, lightPower: 0.20, lightColor: "#fff0cf", direction: "top-right", softness: 0.30 }
  },
  neon_gel: {
    name: "Neon Gel",
    description: "Creative colored-light wash. This local approximation is not semantic AI relighting.",
    recipe: { brightness: 0.99, saturation: 1.06, warmth: -2, contrast: 1.06, lightPower: 0.20, lightColor: "#8e9fff", direction: "right", softness: 0.56 }
  },
  backlit_rim: {
    name: "Backlit Rim",
    description: "Subtle edge-oriented backlight impression; not a true subject-aware rim reconstruction.",
    recipe: { brightness: 1.015, saturation: 1.0, warmth: 2, contrast: 1.04, lightPower: 0.18, lightColor: "#ffe4bd", direction: "top", softness: 0.50 }
  }
} as const;

export type PresetId = keyof typeof presets;
