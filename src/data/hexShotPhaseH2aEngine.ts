/**
 * Hex Shot Phase H.2a — fixed-basic scaling provenance, heavy-shot eligibility,
 * and ammo-result delivery helpers.
 *
 * Pure/data-only. Combat hub remains the applier; this module is the testable
 * authority surface for H.2a regressions.
 */
import type { HexAmmoEffectResult } from './hexAmmoEffectEngine';
import type { HexShotAbilityId } from '../types/operativeClass';

/** Provenance: family ballisticDamagePct already incorporated into this packet. */
export const HEX_FIXED_BASIC_BALLISTIC_PRESCALED = true;

/**
 * Fixed-basic heavy-shot eligibility for the ammo contract.
 * Catalog authority is ARMOR_BREAK on SILVER_CORE_SIDEARM — not ARMOR_PIERCE.
 * ARMOR_PIERCE remains valid for flex abilities that author it (e.g. Singularity Slug).
 */
export function isHexAmmoHeavyShot(input: {
  abilityId: string | null | undefined;
  abilityTags: readonly string[];
}): boolean {
  if (input.abilityTags.includes('ARMOR_PIERCE')) return true;
  if (
    (
      input.abilityId === 'SILVER_CORE_SIDEARM'
      || input.abilityId === 'QUICKDRAW'
      || input.abilityId === 'CENTER_MASS'
      || input.abilityId === 'DOOR_KNOCKER'
    )
    && input.abilityTags.includes('ARMOR_BREAK')
  ) {
    return true;
  }
  // Black Door heavy WAs are HEAVY ballistic — treat as heavy-shot for ammo contract.
  if (
    (
      input.abilityId === 'DOOR_KNOCKER'
      || input.abilityId === 'FATAL_FUNNEL'
      || input.abilityId === 'THRESHOLD'
      || input.abilityId === 'DEADBOLT'
    )
    && input.abilityTags.includes('HEAVY')
  ) {
    return true;
  }
  return false;
}

/** True when this cast is the shared Hex fixed basic (legacy / Quickdraw / Center Mass / Door Knocker). */
export function isHexFixedBasicAbilityId(
  abilityId: string | null | undefined,
): boolean {
  return abilityId === 'SILVER_CORE_SIDEARM'
    || abilityId === 'QUICKDRAW'
    || abilityId === 'CENTER_MASS'
    || abilityId === 'DOOR_KNOCKER';
}

/**
 * Apply Silver-Core fracture riders from an ammo result onto a plan fracture value.
 * Order: percentage then flat (engine-authored values; no new formulas).
 */
export function applyHexAmmoFractureBonus(
  baseFracture: number,
  ammo: Pick<HexAmmoEffectResult, 'fractureBonusPct' | 'flatFractureBonus'> | null,
): number {
  if (!ammo) return baseFracture;
  let next = Math.max(0, baseFracture);
  if (ammo.fractureBonusPct > 0 && next > 0) {
    next = Math.floor(next * (1 + ammo.fractureBonusPct / 100));
  }
  next += Math.max(0, ammo.flatFractureBonus);
  return Math.max(0, next);
}

export interface HexAmmoDamageSplit {
  /** Remaining kinetic / primary-channel damage after conversion. */
  primaryDamage: number;
  /** Occult portion from conversion + flat Occult rider. */
  occultDamage: number;
}

/**
 * Split post-multiplier damage into primary + occult delivery packets.
 * Conversion retypes a fraction; flat Occult is additive occult.
 */
export function splitHexAmmoDamageChannels(
  damageAfterAmmoMultiplier: number,
  ammo: Pick<HexAmmoEffectResult, 'occultConversionPct' | 'flatOccultBonus'> | null,
): HexAmmoDamageSplit {
  if (!ammo) {
    return { primaryDamage: damageAfterAmmoMultiplier, occultDamage: 0 };
  }
  const converted = ammo.occultConversionPct > 0
    ? Math.floor(damageAfterAmmoMultiplier * (ammo.occultConversionPct / 100))
    : 0;
  const primaryDamage = Math.max(0, damageAfterAmmoMultiplier - converted);
  const occultDamage = Math.max(0, converted + Math.max(0, ammo.flatOccultBonus));
  return { primaryDamage, occultDamage };
}

export function mergeDurationTurns(
  current: number | undefined,
  incoming: number,
): number {
  return Math.max(0, current ?? 0, incoming);
}

export function tickDurationMap(
  map: Record<string, number>,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [id, turns] of Object.entries(map)) {
    const t = turns - 1;
    if (t > 0) next[id] = t;
  }
  return next;
}

export function isUnitMarked(
  voidMarkedUnits: Record<string, boolean>,
  voidMarkTurnsRemaining: Record<string, number>,
  unitId: string,
): boolean {
  if ((voidMarkTurnsRemaining[unitId] ?? 0) > 0) return true;
  return voidMarkedUnits[unitId] === true;
}

export type HexFixedBasicAbilityId = Extract<HexShotAbilityId, 'SILVER_CORE_SIDEARM'>;
