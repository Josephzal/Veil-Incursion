import { RUNIC_BRAND_CAP } from '../types/aegisCombat';

export type BrandConsumeMode = 'ALL' | number;

export function clampRunicBrands(count: number, cap = RUNIC_BRAND_CAP): number {
  return Math.max(0, Math.min(cap, count));
}

export function imprintRunicBrands(
  current: number,
  count: number,
  cap = RUNIC_BRAND_CAP,
): number {
  if (count <= 0) return current;
  return clampRunicBrands(current + count, cap);
}

export function consumeRunicBrands(
  current: number,
  mode: BrandConsumeMode,
): { next: number; consumed: number } {
  const consumed = mode === 'ALL' ? current : Math.min(current, mode);
  return { next: current - consumed, consumed };
}

/** @deprecated Phase C uses fixed ASHEN_MANTLE_DURATION_TURNS (=1). */
export function ashenMantleDuration(_consumedBrands: number): number {
  return 1;
}

export function ruinFracturePerBrand(consumedBrands: number, baseFracture = 20): number {
  return baseFracture + consumedBrands * 30;
}

export function bloodTitheHealAmount(
  maxSoulAnchor: number,
  reserveConsumed: number,
  healPctPer10Ar: number,
): number {
  if (reserveConsumed <= 0) return 0;
  return Math.floor(
    maxSoulAnchor * (healPctPer10Ar / 100) * Math.floor(reserveConsumed / 10),
  );
}

export function bloodTitheOccultDamage(
  reserveConsumed: number,
  brandsConsumed: number,
): number {
  const base = Math.max(10, Math.floor(reserveConsumed * 0.4));
  if (brandsConsumed <= 0) return base;
  return Math.floor(base * (1 + brandsConsumed * 0.5));
}

export interface ReserveCostFields {
  reserveCost?: number;
  reserveCostPct?: number;
}

/** Reserve % required to pay a flat or percent tithe. */
export function requiredReserveAmount(
  def: ReserveCostFields,
  currentReserve: number,
): number {
  if (def.reserveCost != null && def.reserveCost > 0) return def.reserveCost;
  if (def.reserveCostPct != null && def.reserveCostPct > 0) {
    return Math.max(1, Math.floor(currentReserve * def.reserveCostPct / 100));
  }
  return 0;
}

export function canAffordReserveCost(
  def: ReserveCostFields,
  currentReserve: number,
): boolean {
  const required = requiredReserveAmount(def, currentReserve);
  return required <= 0 || currentReserve >= required;
}
