export const RISK_PROFILES = [
  {
    id: "LOW",
    title: "LOW RISK",
    allocation: "Capital divided into 5 allocation parts",
    exposure: "5% – 10%",
    color: "bg-green-100 border-green-300 text-green-800",
  },
  {
    id: "MEDIUM",
    title: "MEDIUM RISK",
    allocation: "Capital divided into 4 allocation parts",
    exposure: "10% – 20%",
    color: "bg-yellow-100 border-yellow-300 text-yellow-800",
  },
  {
    id: "HIGH",
    title: "HIGH RISK",
    allocation: "Capital divided into 3 allocation parts",
    exposure: "20% – 50%",
    color: "bg-orange-100 border-orange-300 text-orange-800",
  },
  {
    id: "SUPER_HIGH",
    title: "SUPER HIGH RISK",
    allocation: "Capital divided into 2 allocation parts",
    exposure: "20% – 100%",
    color: "bg-red-100 border-red-300 text-red-800",
  },
] as const;

export const VALID_RISK_IDS = RISK_PROFILES.map((r) => r.id);
export type RiskId = (typeof RISK_PROFILES)[number]["id"];
