/**
 * Phase E.1c.1 — explicit Aegis technique strike-power scaling (VEIL_PIERCER / REAVE).
 * Independent of canonical weapon-action kinetic damage (which ignores strikeDamagePct).
 */
import { COMBAT_ACTION } from '../types/run';
import type { WeaponStatModifiers } from '../types/weapon';

/** Base for Aegis technique formulas — same numeric root historically used via strikeStats. */
export const AEGIS_TECHNIQUE_STRIKE_POWER_BASE = COMBAT_ACTION.ABYSSAL_STRIKE_DAMAGE;

/**
 * Resolve technique-owned strike power from weapon tier modifiers.
 * Authored authority: `aegisTechniquePowerPct`.
 * Migration fallback: legacy `strikeDamagePct` when the technique field is absent.
 */
export function resolveAegisTechniqueStrikePower(mods: WeaponStatModifiers): number {
  const pct = mods.aegisTechniquePowerPct ?? mods.strikeDamagePct ?? 0;
  return Math.max(1, Math.floor(AEGIS_TECHNIQUE_STRIKE_POWER_BASE * (1 + pct / 100)));
}

/** VEIL_PIERCER — Occult pierce. */
export function veilPiercerOccultDamage(techniqueStrikePower: number): number {
  return Math.max(8, Math.floor(techniqueStrikePower * 0.85));
}

/** REAVE — per-target Kinetic. */
export function reaveKineticDamage(techniqueStrikePower: number): number {
  return Math.max(14, Math.floor(techniqueStrikePower * 1.15));
}
