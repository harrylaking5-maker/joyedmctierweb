export const TIER_COLORS: Record<string, string> = {
  HT1: "bg-amber-400/20 text-amber-300 border border-amber-400/40",
  LT1: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40",
  HT2: "bg-purple-600/20 text-purple-300 border border-purple-500/40",
  LT2: "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40",
  HT3: "bg-blue-600/20 text-blue-300 border border-blue-500/40",
  LT3: "bg-cyan-600/20 text-cyan-300 border border-cyan-500/40",
  HT4: "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40",
  LT4: "bg-lime-600/20 text-lime-300 border border-lime-500/40",
  HT5: "bg-orange-600/20 text-orange-300 border border-orange-500/40",
  LT5: "bg-zinc-700/40 text-zinc-400 border border-zinc-600/40",
  Unranked: "bg-zinc-800/40 text-zinc-500 border border-zinc-700/40",
};

export const TIER_GLOW: Record<string, string> = {
  HT1: "shadow-[0_0_20px_rgba(251,191,36,0.25)]",
  LT1: "shadow-[0_0_12px_rgba(234,179,8,0.18)]",
  HT2: "shadow-[0_0_12px_rgba(168,85,247,0.18)]",
  LT2: "shadow-[0_0_10px_rgba(99,102,241,0.15)]",
  HT3: "shadow-[0_0_10px_rgba(59,130,246,0.15)]",
  LT3: "shadow-[0_0_8px_rgba(6,182,212,0.12)]",
  HT4: "", LT4: "", HT5: "", LT5: "", Unranked: "",
};

export const TIER_BORDER_GLOW: Record<string, string> = {
  HT1: "border-amber-400/30",
  LT1: "border-yellow-400/20",
  HT2: "border-purple-500/20",
  LT2: "border-indigo-500/15",
  HT3: "border-blue-500/15",
  LT3: "border-cyan-500/10",
  HT4: "border-white/5", LT4: "border-white/5",
  HT5: "border-white/5", LT5: "border-white/5",
  Unranked: "border-white/5",
};

export const MODES = [
  { key: "sword", label: "Sword" },
  { key: "axe", label: "Axe" },
  { key: "dpot", label: "Diamond Pot" },
  { key: "nethpot", label: "Netherite Pot" },
  { key: "smp", label: "SMP" },
  { key: "crystal", label: "CrystalPVP" },
  { key: "mace", label: "Mace" },
  { key: "uhc", label: "UHC" },
] as const;

export const SUB_MODES = [
  { key: "cartpvp", label: "Cart PvP" },
  { key: "speed", label: "Speed" },
  { key: "bow", label: "Bow" },
  { key: "creeper", label: "Creeper" },
  { key: "trident", label: "Trident" },
  { key: "elytra", label: "Elytra" },
  { key: "diamondsmp", label: "Diamond SMP" },
  { key: "diamondvanilla", label: "Diamond Vanilla" },
] as const;

export type ModeKey = (typeof MODES)[number]["key"];
export type SubModeKey = (typeof SUB_MODES)[number]["key"];

export const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
  "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES",
  "SE","GB","NO","CH","IS","NL","LI","AL","BA","ME","MK","RS","XK",
]);

export function crafatarUrl(uuid: string, size = 40): string {
  return `https://crafatar.com/avatars/${uuid}?size=${size}&overlay=true&default=MHF_Steve`;
}

export function crafatarHeadUrl(uuid: string, size = 48): string {
  return `https://crafatar.com/renders/head/${uuid}?size=${size}&overlay=true&default=MHF_Steve`;
}

export function pointsFromTier(tier: string): number {
  const map: Record<string, number> = {
    HT1: 60, LT1: 45, HT2: 30, LT2: 20,
    HT3: 10, LT3: 6,  HT4: 4,  LT4: 3,
    HT5: 2,  LT5: 1,  Unranked: 0,
  };
  return map[tier] ?? 0;
}
