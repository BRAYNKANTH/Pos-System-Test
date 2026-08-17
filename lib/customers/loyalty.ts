/**
 * Customer Loyalty Helper Engine
 * Manages loyalty points earning, tier progression, and discount redemption logic.
 */

export const LOYALTY_TIERS = {
  BRONZE: { name: "Bronze", minPoints: 0, multiplier: 1.0, color: "text-amber-700 bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" },
  SILVER: { name: "Silver", minPoints: 500, multiplier: 1.25, color: "text-slate-700 bg-slate-100 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700" },
  GOLD: { name: "Gold", minPoints: 1500, multiplier: 1.5, color: "text-yellow-800 bg-yellow-100 border-yellow-300 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-700" },
};

// 1 point per Rs 100 spent
export const EARN_BASE_RATE = 0.01;

// 100 points = Rs 10 discount (0.1 currency unit per point)
export const POINT_VALUE = 0.1;

export function calculateLoyaltyTier(points: number): string {
  if (points >= LOYALTY_TIERS.GOLD.minPoints) return LOYALTY_TIERS.GOLD.name;
  if (points >= LOYALTY_TIERS.SILVER.minPoints) return LOYALTY_TIERS.SILVER.name;
  return LOYALTY_TIERS.BRONZE.name;
}

export function calculateEarnedPoints(amountSpent: number, tier: string = "Bronze"): number {
  let multiplier = 1.0;
  if (tier === "Gold") multiplier = LOYALTY_TIERS.GOLD.multiplier;
  else if (tier === "Silver") multiplier = LOYALTY_TIERS.SILVER.multiplier;

  const basePoints = Math.floor(amountSpent * EARN_BASE_RATE);
  return Math.floor(basePoints * multiplier);
}

export function pointsToDiscountValue(points: number): number {
  return Math.round(points * POINT_VALUE * 100) / 100;
}

export function discountValueToPointsNeeded(discountAmount: number): number {
  return Math.ceil(discountAmount / POINT_VALUE);
}
