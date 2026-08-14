import { abilityHasTag, getAbilityDefinition, getAbilityTags } from './aegisAbilities';
import type { AegisAbilityId, AbilityTag } from '../types/aegisCombat';
import type { AbilityGraftMap, GraftCastPlan, VeilGraftId } from '../types/veilGraft';
import { ALL_VEIL_GRAFT_IDS, getVeilGraftDefinition } from './veilGraftDatabase';
import { emptyUniversalCastPlanOverlay } from '../types/universalGraft';
import {
  applyUniversalDamagePacketUpgrade,
  getUniversalGraftDefinition,
  universalGraftMatchesTarget,
} from './universalGraftRegistry';

export function canGraftAbility(abilityId: AegisAbilityId): boolean {
  return !abilityHasTag(abilityId, 'ULTIMATE');
}

export function rollVeilGraftOffers(
  count = 3,
  rng: () => number = Math.random,
): VeilGraftId[] {
  const pool = [...ALL_VEIL_GRAFT_IDS];
  const offers: VeilGraftId[] = [];
  while (offers.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    offers.push(pool.splice(index, 1)[0]);
  }
  return offers;
}

export function buildGraftCastPlan(
  abilityId: AegisAbilityId,
  graftId: VeilGraftId | undefined,
): GraftCastPlan {
  const def = getAbilityDefinition(abilityId);
  const baseTags = [...getAbilityTags(abilityId)];
  const plan: GraftCastPlan = {
    ...emptyUniversalCastPlanOverlay(),
    apCost: def.apCost,
    hpCostPct: def.hpCostPct ?? 0,
    reservePenalty: 0,
    consumeAllReserve: false,
    brandTax: 0,
    damageMultiplier: 1,
    bossDamageMultiplier: 1,
    hitCount: 1,
    duplicateCastRatio: 0,
    forceTrueDamage: false,
    effectiveTags: baseTags,
    reserveGenerationBonus: 0,
    cooldownTurns: 0,
    healOnDamagePct: 0,
    grantShieldHits: 0,
    reserveGenerationMultiplier: 1,
    refundApOnKill: false,
    failDebuff: null,
    executeThreshold: null,
    occultFlatBonus: 0,
    targetDebuff: null,
    selfDebuff: null,
    evadeBuffPct: 0,
    dropLootOnKill: null,
    graftName: '',
  };
  if (!graftId || !universalGraftMatchesTarget('AEGIS', abilityId, graftId)) return plan;
  const graft = getUniversalGraftDefinition(graftId);
  if (!graft) return plan;
  plan.graftId = graft.id;
  plan.upgradeAxis = graft.upgradeAxis;
  plan.currentAxisValue = graft.baseValue;
  plan.upgradedAxisValue = graft.upgradedValue;
  plan.graftName = graft.name;
  return plan;
}

export function canAffordGraftResources(
  plan: GraftCastPlan,
  abyssalReserve: number,
  runicBrands: number,
): { ok: true } | { ok: false; reason: string } {
  if (plan.brandTax > 0 && runicBrands < plan.brandTax) {
    return {
      ok: false,
      reason: `requires ${plan.brandTax} Runic Brand${plan.brandTax === 1 ? '' : 's'}`,
    };
  }
  if (plan.consumeAllReserve && abyssalReserve <= 0) {
    return { ok: false, reason: 'requires Abyssal Reserve to detonate' };
  }
  if (
    !plan.consumeAllReserve
    && plan.reservePenalty > 0
    && abyssalReserve < plan.reservePenalty
  ) {
    return {
      ok: false,
      reason: `requires ${plan.reservePenalty}% Reserve tax`,
    };
  }
  return { ok: true };
}

export type ScaleGraftDamageOptions = {
  /**
   * Phase E.1a — Aegis weapon-action hits already own `damageMultiplier` and
   * `occultFlatBonus` via `applyGraftTransformToWeaponPlan`. Skip those here.
   * Phase E.1e.1 — Apex boss ×2 is owned by WA delivery when pre-scaled; do not
   * re-apply here. Neutron reserve-add still resolves via `neutronOnce`.
   */
  damageAlreadyScaled?: boolean;
  /**
   * Phase E.1e.1 — Neutron floor(reserve×0.8) at most once per `playerActionId`.
   * Mutates the ledger when the addition is applied to an eligible packet.
   */
  neutronOnce?: {
    playerActionId: string;
    ledger: { consumedForPlayerActionId: string | null };
  };
};

function applyNeutronReserveAddOnce(
  damage: number,
  baseDamage: number,
  plan: GraftCastPlan,
  reserveSpent: number,
  options?: ScaleGraftDamageOptions,
): number {
  if (!(reserveSpent > 0 && plan.consumeAllReserve && baseDamage > 0)) {
    return damage;
  }
  const once = options?.neutronOnce;
  if (
    once
    && once.ledger.consumedForPlayerActionId === once.playerActionId
  ) {
    return damage;
  }
  const next = damage + Math.floor(reserveSpent * 0.8);
  if (once) {
    once.ledger.consumedForPlayerActionId = once.playerActionId;
  }
  return next;
}

export function scaleGraftDamage(
  baseDamage: number,
  plan: GraftCastPlan,
  reserveSpent = 0,
  isBoss = false,
  options?: ScaleGraftDamageOptions,
): number {
  if (plan.upgradeAxis === 'DIRECT_DAMAGE') {
    if (options?.damageAlreadyScaled) return Math.max(0, baseDamage);
    return applyUniversalDamagePacketUpgrade(
      { damage: baseDamage },
      getUniversalGraftDefinition(plan.graftId),
    ).damage;
  }
  if (options?.damageAlreadyScaled) {
    // Apex boss mult is applied at WA delivery before hurtEnemy — never again here.
    const withNeutron = applyNeutronReserveAddOnce(
      baseDamage,
      baseDamage,
      plan,
      reserveSpent,
      options,
    );
    return Math.max(0, withNeutron);
  }
  let multiplier = plan.damageMultiplier;
  if (isBoss && plan.bossDamageMultiplier > 1) {
    multiplier *= plan.bossDamageMultiplier;
  }
  let damage = Math.floor(baseDamage * multiplier);
  damage = applyNeutronReserveAddOnce(damage, baseDamage, plan, reserveSpent, options);
  damage += plan.occultFlatBonus;
  return Math.max(0, damage);
}

export function graftAppliesToAbility(
  abilityGrafts: AbilityGraftMap,
  abilityId: AegisAbilityId,
): VeilGraftId | undefined {
  return abilityGrafts[abilityId];
}

export function isUltimateDisabledForEncounter(
  _abilityGrafts: AbilityGraftMap,
  _encounterUltimateDisabled: boolean,
): boolean {
  return false;
}

export function formatGraftOfferLine(graftId: VeilGraftId, _residueBalance?: number): string {
  const graft = getVeilGraftDefinition(graftId);
  return `[ ${graft.name.toUpperCase()} ] — SANCTUARY ATTUNE\n${graft.description}`;
}

export function effectiveAbilityTags(
  abilityId: AegisAbilityId,
  graftId: VeilGraftId | undefined,
): readonly AbilityTag[] {
  return buildGraftCastPlan(abilityId, graftId).effectiveTags;
}
