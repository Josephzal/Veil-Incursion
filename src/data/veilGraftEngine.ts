import { abilityHasTag, getAbilityDefinition, getAbilityTags } from './aegisAbilities';
import type { AegisAbilityId, AbilityTag } from '../types/aegisCombat';
import type { AbilityGraftMap, GraftCastPlan, VeilGraftId } from '../types/veilGraft';
import { ALL_VEIL_GRAFT_IDS, getVeilGraftDefinition } from './veilGraftDatabase';

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

  if (!graftId) {
    return {
      apCost: def.apCost,
      hpCostPct: def.hpCostPct ?? 0,
      extraStaminaCost: 0,
      consumeAllStamina: false,
      damageMultiplier: 1,
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
      graftName: '',
    };
  }

  const graft = getVeilGraftDefinition(graftId);
  let effectiveTags = [...baseTags];
  if (graft.removeTags?.length) {
    effectiveTags = effectiveTags.filter((tag) => !graft.removeTags!.includes(tag));
  }
  if (graft.addTag && !effectiveTags.includes(graft.addTag)) {
    effectiveTags.push(graft.addTag);
  }

  let apCost = def.apCost;
  if (graft.setApCost != null) apCost = graft.setApCost;
  if (graft.addApCost != null) apCost += graft.addApCost;

  let hpCostPct = def.hpCostPct ?? 0;
  if (graft.addHpCost != null) hpCostPct += graft.addHpCost;

  return {
    apCost: Math.max(0, apCost),
    hpCostPct,
    extraStaminaCost: graft.staminaPenalty ?? graft.addStaminaCost ?? 0,
    consumeAllStamina: graft.consumeAllStamina === true,
    damageMultiplier: graft.damageMultiplier ?? 1,
    hitCount: graft.hitCount ?? 1,
    duplicateCastRatio: graft.duplicateCast ?? 0,
    forceTrueDamage: graft.convertToTrueDamage === true,
    effectiveTags,
    reserveGenerationBonus: graft.addReserveGeneration ?? 0,
    cooldownTurns: graft.addCooldown ?? 0,
    healOnDamagePct: graft.healPercentageOfDamage ?? 0,
    grantShieldHits: graft.grantShieldHits ?? 0,
    reserveGenerationMultiplier: graft.reduceReserveGeneration != null
      ? 1 - graft.reduceReserveGeneration
      : 1,
    refundApOnKill: graft.refundApOnKill === true,
    failDebuff: graft.selfDebuffOnFail ?? null,
    executeThreshold: graft.executeThreshold ?? null,
    occultFlatBonus: graft.addOccultDamage ?? 0,
    targetDebuff: graft.applyDebuffToTarget ?? null,
    selfDebuff: graft.applySelfDebuff ?? null,
    evadeBuffPct: graft.addBuff === 'EVADE_30' ? 30 : 0,
    graftName: graft.name,
  };
}

export function scaleGraftDamage(baseDamage: number, plan: GraftCastPlan, staminaSpent = 0): number {
  let damage = Math.floor(baseDamage * plan.damageMultiplier);
  if (staminaSpent > 0 && plan.consumeAllStamina) {
    damage += Math.floor(staminaSpent * 0.8);
  }
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
  abilityGrafts: AbilityGraftMap,
  encounterUltimateDisabled: boolean,
): boolean {
  if (encounterUltimateDisabled) return true;
  return Object.values(abilityGrafts).some(
    (graftId) => graftId != null && getVeilGraftDefinition(graftId).disableUltimate === true,
  );
}

export function formatGraftOfferLine(graftId: VeilGraftId, residueBalance: number): string {
  const graft = getVeilGraftDefinition(graftId);
  const affordable = residueBalance >= graft.cost ? 'OK' : 'LOCKED';
  return `[ ${graft.name.toUpperCase()} ] — ${graft.cost} RESIDUE // ${affordable}\n${graft.description}`;
}

export function effectiveAbilityTags(
  abilityId: AegisAbilityId,
  graftId: VeilGraftId | undefined,
): readonly AbilityTag[] {
  return buildGraftCastPlan(abilityId, graftId).effectiveTags;
}
