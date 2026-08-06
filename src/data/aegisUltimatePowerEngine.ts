/**
 * Phase E.1d.1 — explicit Aegis ultimate strike-power scaling (REND_THE_VEIL / GRAVEFALL).
 * Independent of canonical weapon-action kinetic damage and technique power.
 */
import { COMBAT_ACTION } from '../types/run';
import type { WeaponStatModifiers } from '../types/weapon';

/** Base for Aegis ultimate formulas — same numeric root historically used via strikeStats. */
export const AEGIS_ULTIMATE_STRIKE_POWER_BASE = COMBAT_ACTION.ABYSSAL_STRIKE_DAMAGE;

/**
 * Resolve ultimate-owned strike power from weapon tier modifiers.
 * Authored authority: `aegisUltimatePowerPct`.
 * Migration fallback: legacy `strikeDamagePct` when the ultimate field is absent.
 * Does not read `aegisTechniquePowerPct`.
 */
export function resolveAegisUltimateStrikePower(mods: WeaponStatModifiers): number {
  const pct = mods.aegisUltimatePowerPct ?? mods.strikeDamagePct ?? 0;
  return Math.max(1, Math.floor(AEGIS_ULTIMATE_STRIKE_POWER_BASE * (1 + pct / 100)));
}

/** REND_THE_VEIL plan base — floor preserved from hub max(10, power). */
export function rendTheVeilBaseStrike(ultimateStrikePower: number): number {
  return Math.max(10, ultimateStrikePower);
}

/** GRAVEFALL plan base — floor preserved from hub max(12, power). */
export function gravefallBaseStrike(ultimateStrikePower: number): number {
  return Math.max(12, ultimateStrikePower);
}
