export type ReferrerTierId =
  | "stone"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "crown";

export type ReferrerTier = {
  id: ReferrerTierId;
  label: string;
  min: number;
  max: number | null;
  badgeClass: string;
  dotClass: string;
};

export const REFERRER_TIERS: ReferrerTier[] = [
  {
    id: "stone",
    label: "Stone",
    min: 0,
    max: 99,
    badgeClass:
      "border-stone-300 bg-gradient-to-r from-stone-100 to-stone-200 text-stone-800 shadow-sm",
    dotClass: "bg-stone-400",
  },
  {
    id: "silver",
    label: "Silver",
    min: 100,
    max: 499,
    badgeClass:
      "border-slate-300 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-300 text-slate-800 shadow-sm",
    dotClass: "bg-slate-400",
  },
  {
    id: "gold",
    label: "Gold",
    min: 500,
    max: 1999,
    badgeClass:
      "border-yellow-400 bg-gradient-to-r from-[#FFF9E6] via-[#FFD700] to-amber-400 text-amber-950 shadow-sm",
    dotClass: "bg-[#FFD700]",
  },
  {
    id: "platinum",
    label: "Platinum",
    min: 2000,
    max: 4999,
    badgeClass:
      "border-sky-300 bg-gradient-to-r from-sky-50 via-slate-100 to-indigo-100 text-sky-950 shadow-sm",
    dotClass: "bg-sky-400",
  },
  {
    id: "diamond",
    label: "Diamond",
    min: 5000,
    max: 9999,
    badgeClass:
      "border-cyan-300 bg-gradient-to-r from-cyan-50 via-sky-100 to-cyan-200 text-cyan-950 shadow-sm",
    dotClass: "bg-cyan-400",
  },
  {
    id: "crown",
    label: "Crown",
    min: 10000,
    max: null,
    badgeClass:
      "border-violet-400 bg-gradient-to-r from-violet-600 via-purple-500 to-amber-400 text-white shadow-md",
    dotClass: "bg-amber-300",
  },
];

export function getReferrerTier(count: number): ReferrerTier {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  for (let i = REFERRER_TIERS.length - 1; i >= 0; i -= 1) {
    if (n >= REFERRER_TIERS[i].min) return REFERRER_TIERS[i];
  }
  return REFERRER_TIERS[0];
}

export function tierRangeLabel(tier: ReferrerTier): string {
  switch (tier.id) {
    case "stone":
      return "< 100 referrals";
    case "silver":
      return "100 – 500 referrals";
    case "gold":
      return "500 – 2,000 referrals";
    case "platinum":
      return "2,000 – 5,000 referrals";
    case "diamond":
      return "5,000 – 10,000 referrals";
    case "crown":
      return "10,000+ referrals";
    default:
      return "";
  }
}
