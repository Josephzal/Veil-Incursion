/**
 * Phase C — atomic AP / Brand / HP commitment for shared Aegis techniques.
 *
 * Target staging spends nothing. Commitment deducts costs as one transaction.
 * Pre-resolution rejection rolls back. Miss/Evade after resolution begins does not.
 */
import type { AegisTechniqueId } from '../types/aegisCombat';
import { isAegisTechniqueId } from './aegisTechniqueCatalog';
import { getAbilityDefinition } from './aegisAbilities';
import {
  consumeRunicBrands,
  type BrandConsumeMode,
} from './aegisResourceEngine';
import {
  FRACTURE_MAX_DEFAULT,
  isEnemyFractured,
} from './combatFractureEngine';
import type { EnemyCombatProfile } from '../types/run';

export const FINAL_MERCY_HP_THRESHOLD_PCT = 25;
export const FINAL_MERCY_BOSS_TRUE_DAMAGE = 36;
export const FINAL_MERCY_KILL_HEAL_PCT = 10;
export const RUNEBOUND_REFLECT_TRUE = 12;
export const RUNEBOUND_REFLECT_FRACTURE = 24;
export const ASHEN_MANTLE_DURATION_TURNS = 1;
/** Kinetic chip while Fractured (authored; unchanged by E.1c.1). */
export const DEVASTATE_KINETIC_DAMAGE = 4;
/** True-damage floor when Fracture threshold is below this value. */
export const DEVASTATE_TRUE_DAMAGE_FLOOR = 8;

export interface TechniqueResourceCosts {
  apCost: number;
  /** Exact brands deducted at commit (0 for AP-only utilities). */
  brandsToSpend: number;
  brandConsumeMode: BrandConsumeMode | null;
  hpCostPct: number;
  /** True when HP floor must remain ≥1 after sacrifice. */
  hpFloorOne: boolean;
}

export interface TechniqueCommitState {
  ap: number;
  brands: number;
  operativeHp: number;
  maxSoulAnchor: number;
}

export interface TechniqueCommitSnapshot {
  originActionId: string;
  techniqueId: AegisTechniqueId;
  apSpent: number;
  brandsSpent: number;
  brandsBefore: number;
  hpSpent: number;
  hpBefore: number;
}

export type TechniqueValidateResult =
  | { ok: true; costs: TechniqueResourceCosts }
  | { ok: false; reason: string };

export function isPlayableAegisTechniqueId(id: string): id is AegisTechniqueId {
  return isAegisTechniqueId(id);
}

export function resolveTechniqueResourceCosts(
  techniqueId: AegisTechniqueId,
  brands: number,
  options?: { hpCostPctOverride?: number },
): TechniqueResourceCosts {
  const def = getAbilityDefinition(techniqueId);
  let brandsToSpend = 0;
  let brandConsumeMode: BrandConsumeMode | null = null;
  if (def.brandsConsumed === 'ALL') {
    brandsToSpend = brands;
    brandConsumeMode = 'ALL';
  } else if (typeof def.brandsConsumed === 'number' && def.brandsConsumed > 0) {
    brandsToSpend = def.brandsConsumed;
    brandConsumeMode = def.brandsConsumed;
  } else if (def.requiredBrands != null && def.requiredBrands > 0 && def.brandsConsumed == null) {
    // requiredBrands without brandsConsumed should not happen for Phase C catalog.
    brandsToSpend = def.requiredBrands;
    brandConsumeMode = def.requiredBrands;
  }
  const hpCostPct = options?.hpCostPctOverride ?? def.hpCostPct ?? 0;
  return {
    apCost: def.apCost,
    brandsToSpend,
    brandConsumeMode,
    hpCostPct,
    hpFloorOne: hpCostPct > 0,
  };
}

export function computeHpSacrifice(
  maxSoulAnchor: number,
  hpCostPct: number,
): number {
  if (hpCostPct <= 0 || maxSoulAnchor <= 0) return 0;
  return Math.ceil(maxSoulAnchor * (hpCostPct / 100));
}

/** Can pay HP cost while remaining at least 1 HP. */
export function canPayHpFloorOne(
  operativeHp: number,
  maxSoulAnchor: number,
  hpCostPct: number,
): boolean {
  const cost = computeHpSacrifice(maxSoulAnchor, hpCostPct);
  if (cost <= 0) return true;
  return operativeHp - cost >= 1;
}

export function finalMercyThresholdHp(maxHp: number): number {
  return Math.floor(maxHp * (FINAL_MERCY_HP_THRESHOLD_PCT / 100));
}

export function isFinalMercyEligible(unit: EnemyCombatProfile): boolean {
  if (!unit || (unit.currentHp ?? 0) <= 0) return false;
  const maxHp = Math.max(1, unit.maxHp ?? unit.currentHp ?? 1);
  return (unit.currentHp ?? 0) <= finalMercyThresholdHp(maxHp);
}

export function validateTechniqueCommitment(args: {
  techniqueId: AegisTechniqueId;
  loadout: readonly string[];
  state: TechniqueCommitState;
  target: EnemyCombatProfile | null;
  demonLungCooldown: number;
  hpCostPctOverride?: number;
}): TechniqueValidateResult {
  const { techniqueId, loadout, state, target } = args;
  if (!loadout.includes(techniqueId)) {
    return { ok: false, reason: 'Technique is not in the snapshotted loadout.' };
  }
  const def = getAbilityDefinition(techniqueId);
  const costs = resolveTechniqueResourceCosts(techniqueId, state.brands, {
    hpCostPctOverride: args.hpCostPctOverride,
  });

  if (state.ap < costs.apCost) {
    return { ok: false, reason: `Requires ${costs.apCost} AP (have ${state.ap}).` };
  }

  const minBrands = def.requiredBrands ?? 0;
  if (minBrands > 0 && state.brands < minBrands) {
    return {
      ok: false,
      reason: `Requires ${minBrands} Runic Brand${minBrands === 1 ? '' : 's'} (have ${state.brands}).`,
    };
  }
  if (costs.brandsToSpend > 0 && state.brands < costs.brandsToSpend) {
    return {
      ok: false,
      reason: `Requires ${costs.brandsToSpend} Runic Brand${costs.brandsToSpend === 1 ? '' : 's'} (have ${state.brands}).`,
    };
  }

  if (costs.hpCostPct > 0) {
    if (!canPayHpFloorOne(state.operativeHp, state.maxSoulAnchor, costs.hpCostPct)) {
      const cost = computeHpSacrifice(state.maxSoulAnchor, costs.hpCostPct);
      return {
        ok: false,
        reason: `Requires ${cost} HP while remaining above 0 (have ${state.operativeHp}).`,
      };
    }
  }

  if (techniqueId === 'DEMONS_LUNG' && args.demonLungCooldown > 0) {
    return {
      ok: false,
      reason: `Demon's Lung cooling down (${args.demonLungCooldown} turn${args.demonLungCooldown === 1 ? '' : 's'}).`,
    };
  }

  if (techniqueId === 'DEVASTATE') {
    if (!target?.unitId) {
      return { ok: false, reason: 'Devastate requires a Fractured target.' };
    }
    if (!isEnemyFractured(target)) {
      return { ok: false, reason: 'Devastate requires a Fractured target.' };
    }
  }

  if (techniqueId === 'FINAL_MERCY') {
    if (!target?.unitId) {
      return { ok: false, reason: 'Final Mercy requires a living enemy at or below 25% HP.' };
    }
    if (!isFinalMercyEligible(target)) {
      return { ok: false, reason: 'Final Mercy requires the target at or below 25% maximum HP.' };
    }
  }

  if (techniqueId === 'RUIN' && state.brands < 1) {
    return { ok: false, reason: 'Ruin requires at least 1 Runic Brand.' };
  }

  return { ok: true, costs };
}

export function commitTechniqueResources(
  state: TechniqueCommitState,
  costs: TechniqueResourceCosts,
  originActionId: string,
  techniqueId: AegisTechniqueId,
): { next: TechniqueCommitState; snapshot: TechniqueCommitSnapshot } {
  const brandsBefore = state.brands;
  const brandResult = costs.brandConsumeMode != null
    ? consumeRunicBrands(state.brands, costs.brandConsumeMode)
    : { next: state.brands, consumed: 0 };
  const hpSpent = computeHpSacrifice(state.maxSoulAnchor, costs.hpCostPct);
  let nextHp = state.operativeHp;
  if (hpSpent > 0) {
    nextHp = Math.max(1, state.operativeHp - hpSpent);
  }
  const next: TechniqueCommitState = {
    ap: state.ap - costs.apCost,
    brands: brandResult.next,
    operativeHp: nextHp,
    maxSoulAnchor: state.maxSoulAnchor,
  };
  return {
    next,
    snapshot: {
      originActionId,
      techniqueId,
      apSpent: costs.apCost,
      brandsSpent: brandResult.consumed,
      brandsBefore,
      hpSpent,
      hpBefore: state.operativeHp,
    },
  };
}

export function rollbackTechniqueResources(
  snapshot: TechniqueCommitSnapshot,
): TechniqueCommitState {
  return {
    ap: snapshot.apSpent, // caller adds to current AP
    brands: snapshot.brandsBefore,
    operativeHp: snapshot.hpBefore,
    maxSoulAnchor: 0,
  };
}

export function finalMercyTrueDamage(unit: EnemyCombatProfile): number {
  if (unit.isBoss) return FINAL_MERCY_BOSS_TRUE_DAMAGE;
  return Math.max(1, unit.currentHp ?? 0);
}

/**
 * Canonical Fracture cashout value for DEVASTATE while Fractured.
 * Uses the target's stable Fracture threshold (`fractureMax`) — the quantity that
 * produces a gauge-fill break. Live `fractureGauge` is always 0 while Fractured
 * and must not be read for this cashout.
 */
export function devastateFractureCashoutValue(unit: EnemyCombatProfile): number {
  const max = unit.fractureMax ?? FRACTURE_MAX_DEFAULT;
  return Math.max(0, Math.floor(max));
}

/** True component: max(8, Fracture threshold). */
export function devastateTrueDamage(unit: EnemyCombatProfile): number {
  return Math.max(DEVASTATE_TRUE_DAMAGE_FLOOR, devastateFractureCashoutValue(unit));
}

export function devastateDamagePreview(unit: EnemyCombatProfile): {
  kinetic: number;
  trueDamage: number;
  fractureThreshold: number;
} {
  const fractureThreshold = devastateFractureCashoutValue(unit);
  return {
    kinetic: DEVASTATE_KINETIC_DAMAGE,
    trueDamage: Math.max(DEVASTATE_TRUE_DAMAGE_FLOOR, fractureThreshold),
    fractureThreshold,
  };
}
