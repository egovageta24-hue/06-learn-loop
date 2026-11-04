export const levelLabel = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

export const COVER_THEME_KEYS = ["violet", "sky", "amber", "emerald", "rose"] as const;
export const LEVEL_KEYS = ["beginner", "intermediate", "advanced"] as const;

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
