export type PlanId = "monthly" | "yearly";

export type Plan = {
  id: PlanId;
  label: string;
  price: string;
  period: string;
  note?: string;
};

export const PLANS: Plan[] = [
  { id: "monthly", label: "Aylık", price: "₺49,99", period: "/ ay" },
  { id: "yearly", label: "Yıllık", price: "₺299,99", period: "/ yıl", note: "%50 avantajlı" },
];

export const PREMIUM_NAME = "ARCANA Kadim";
