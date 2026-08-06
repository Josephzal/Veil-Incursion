/**
 * Phase D — graft cast plans + hit transforms for Aegis weapon actions.
 */
import type { AegisWeaponActionId, AbilityTag } from '../types/aegisCombat';
import type { GraftCastPlan, VeilGraftId } from '../types/veilGraft';
import {
  aegisWeaponActionApCost,
  aegisWeaponActionTags,
} from './aegisWeaponActionCatalog';
import { getVeilGraftDefinition } from './veilGraftDatabase';
import type { AegisWeaponActionPlan, WeaponHitPlan } from './aegisWeaponActionResolveEngine';

export type GraftTaggedWeaponHit = WeaponHitPlan & {
  /** Graft-added echo/splinter hit — not mastery / Crimson / Riposte / Brand-eligible. */
  graftAdded?: boolean;
};

export function buildWeaponActionGraftCastPlan(
  actionId: AegisWeaponActionId,
  graftId: VeilGraftId | undefined,
  opts?: { doomfallReleaseAvailable?: boolean },
): GraftCastPlan {
  const baseTags = [...aegisWeaponActionTags(actionId, {
    doomfallReleaseAvailable: opts?.doomfallReleaseAvailable === true,
  })] as AbilityTag[];
  const apCost = aegisWeaponActionApCost(actionId, {
    doomfallReleaseAvailable: opts?.doomfallReleaseAvailable === true,
  });

  if (!graftId) {
    return {
      apCost,
      hpCostPct: 0,
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
  }

  const graft = getVeilGraftDefinition(graftId);
  let effectiveTags = [...baseTags];
  if (graft.removeTags?.length) {
    effectiveTags = effectiveTags.filter((tag) => !graft.removeTags!.includes(tag));
  }
  if (graft.addTag && !effectiveTags.includes(graft.addTag)) {
    effectiveTags.push(graft.addTag);
  }

  let nextAp = apCost;
  if (graft.setApCost != null) nextAp = graft.setApCost;
  if (graft.addApCost != null) nextAp += graft.addApCost;

  return {
    apCost: Math.max(0, nextAp),
    hpCostPct: graft.addHpCost != null ? graft.addHpCost * 100 : 0,
    reservePenalty: graft.reservePenalty ?? 0,
    consumeAllReserve: graft.consumeAllReserve === true,
    brandTax: graft.brandTax ?? 0,
    damageMultiplier: graft.damageMultiplier ?? 1,
    bossDamageMultiplier: graft.bossDamageMultiplier ?? 1,
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
    dropLootOnKill: graft.dropLootOnKill ?? null,
    graftName: graft.name,
  };
}

function scaleHit(hit: WeaponHitPlan, mult: number, occultFlat: number): WeaponHitPlan {
  return {
    ...hit,
    kineticDamage: Math.max(0, Math.floor(hit.kineticDamage * mult)),
    occultDamage: Math.max(0, Math.floor(hit.occultDamage * mult) + (occultFlat > 0 ? occultFlat : 0)),
  };
}

/**
 * Apply Echo / Splinter / damage grafts to an authored weapon-action plan.
 * Graft-added hits never copy secondary action state (mastery / Brand / Tempo consume).
 */
export function applyGraftTransformToWeaponPlan(
  plan: AegisWeaponActionPlan,
  graftPlan: GraftCastPlan,
): Omit<AegisWeaponActionPlan, 'hits'> & { hits: GraftTaggedWeaponHit[] } {
  if (!graftPlan.graftName) {
    return { ...plan, hits: plan.hits.map((h) => ({ ...h })) };
  }

  // Echo (and any graft that removes FRACTURE from effective tags) zeroes Fracture contrib.
  const stripFracture = plan.hits.some((h) => h.fractureGain > 0)
    && !graftPlan.effectiveTags.includes('FRACTURE');

  let hits: GraftTaggedWeaponHit[] = plan.hits.map((h) => {
    const scaled = scaleHit(h, graftPlan.damageMultiplier, 0);
    return {
      ...scaled,
      fractureGain: stripFracture ? 0 : scaled.fractureGain,
      graftAdded: false,
    };
  });

  // Occult flat once on the first authored hit only.
  if (graftPlan.occultFlatBonus > 0 && hits[0]) {
    hits[0] = {
      ...hits[0],
      occultDamage: hits[0].occultDamage + graftPlan.occultFlatBonus,
    };
  }

  // Splinter: expand single-target authored pattern to N hits (no dual/row explosion).
  if (
    graftPlan.hitCount > 1
    && !plan.dualTarget
    && !plan.rowTarget
    && plan.stage !== 'CHARGE'
  ) {
    const template = hits[0] ?? {
      kineticDamage: 0,
      occultDamage: 0,
      fractureGain: 0,
      armorStrip: 0,
      reserveGain: 0,
      accuracyBonusPct: 0,
      channel: 'KINETIC' as const,
    };
    const expanded: GraftTaggedWeaponHit[] = [];
    for (let i = 0; i < graftPlan.hitCount; i += 1) {
      expanded.push({
        ...template,
        // Reserve / armor strip only on first authored hit.
        armorStrip: i === 0 ? template.armorStrip : 0,
        reserveGain: i === 0 ? template.reserveGain : 0,
        graftAdded: i > 0,
      });
    }
    hits = expanded;
  }

  // Echo: append 50% graft-added copies of each non-graft-added hit (no secondary state).
  if (graftPlan.duplicateCastRatio > 0 && plan.stage !== 'CHARGE') {
    const authored = hits.filter((h) => !h.graftAdded);
    const echoes: GraftTaggedWeaponHit[] = authored.map((h) => ({
      ...scaleHit(h, graftPlan.duplicateCastRatio, 0),
      fractureGain: 0,
      armorStrip: 0,
      reserveGain: 0,
      graftAdded: true,
    }));
    hits = [...hits, ...echoes];
  }

  return {
    ...plan,
    apCost: graftPlan.apCost,
    hits,
  };
}

export function weaponActionGraftApCost(
  actionId: AegisWeaponActionId,
  graftPlan: GraftCastPlan,
  opts?: { doomfallReleaseAvailable?: boolean },
): number {
  if (graftPlan.graftName) return graftPlan.apCost;
  return aegisWeaponActionApCost(actionId, opts);
}

/** Sum kinetic + occult for a plan hit (preview / regression). */
export function weaponHitPlanDamage(hit: Pick<WeaponHitPlan, 'kineticDamage' | 'occultDamage'>): number {
  return hit.kineticDamage + hit.occultDamage;
}

/**
 * Phase E.1a — final Aegis weapon-action hit damages after graft transform.
 * This is the sole damageMultiplier owner for WA hits; hub must not re-apply.
 * Charge plans are returned unexpanded (executor skips transform on Charge).
 */
export function previewWeaponActionGraftHitDamages(
  plan: AegisWeaponActionPlan,
  graftPlan: GraftCastPlan,
): number[] {
  if (!graftPlan.graftName || plan.stage === 'CHARGE') {
    return plan.hits.map(weaponHitPlanDamage);
  }
  return applyGraftTransformToWeaponPlan(plan, graftPlan).hits.map(weaponHitPlanDamage);
}
