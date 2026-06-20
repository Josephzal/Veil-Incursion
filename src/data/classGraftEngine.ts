import type { ClassType } from '../types/game';
import type {
  ClassGraftCastPlan,
  ClassGraftDefinition,
  EnvoyAbilityGraftMap,
  EnvoyGraftId,
  HexShotAbilityGraftMap,
  HexShotGraftId,
  OperativeClassGraftId,
} from '../types/classGraft';
import { defaultClassGraftCastPlan } from '../types/classGraft';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import { resolveClassAbilityCost } from './classAbilityResolver';
import { ENVOY_GRAFT_DATABASE, getEnvoyGraftDefinition, pickRandomEnvoyGraftOffers } from './envoyGrafts';
import { HEX_SHOT_GRAFT_DATABASE, getHexShotGraftDefinition, pickRandomHexShotGraftOffers } from './hexShotGrafts';
import { canGraftAbility, rollVeilGraftOffers } from './veilGraftEngine';
import { getVeilGraftDefinition } from './veilGraftDatabase';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { VeilGraftId } from '../types/veilGraft';

const HEX_ANCHORS: readonly HexShotAbilityId[] = ['SILVER_CORE_SIDEARM', 'ZERO_PROTOCOL'];
const ENVOY_ANCHORS: readonly EnvoyAbilityId[] = ['VEIL_SPLINTER', 'CATACLYSM_SIGIL'];

export function getClassGraftDefinition(
  classId: ClassType,
  graftId: string,
): ClassGraftDefinition | import('../types/veilGraft').VeilGraftDefinition {
  if (classId === 'HEX_SHOT') {
    return getHexShotGraftDefinition(graftId as HexShotGraftId);
  }
  if (classId === 'ENVOY') {
    return getEnvoyGraftDefinition(graftId as EnvoyGraftId);
  }
  return getVeilGraftDefinition(graftId as VeilGraftId);
}

export function rollClassGraftOffers(
  classId: ClassType,
  count = 3,
): (OperativeClassGraftId | VeilGraftId)[] {
  if (classId === 'HEX_SHOT') return pickRandomHexShotGraftOffers(count);
  if (classId === 'ENVOY') return pickRandomEnvoyGraftOffers(count);
  return rollVeilGraftOffers(count);
}

export function canGraftClassAbility(classId: ClassType, abilityId: string): boolean {
  if (classId === 'HEX_SHOT') {
    return !HEX_ANCHORS.includes(abilityId as HexShotAbilityId);
  }
  if (classId === 'ENVOY') {
    return !ENVOY_ANCHORS.includes(abilityId as EnvoyAbilityId)
      && abilityId !== 'RIFT_WARD';
  }
  return canGraftAbility(abilityId as AegisAbilityId);
}

function applyTagMods(
  tags: readonly string[],
  graft: ClassGraftDefinition,
): readonly string[] {
  let effective = [...tags];
  if (graft.removeTags?.length) {
    effective = effective.filter((tag) => !graft.removeTags!.includes(tag));
  }
  if (graft.modifyTagFrom && graft.modifyTagTo) {
    effective = effective.map((tag) =>
      tag === graft.modifyTagFrom ? graft.modifyTagTo! : tag,
    );
    if (!effective.includes(graft.modifyTagTo)) {
      effective.push(graft.modifyTagTo);
    }
  }
  if (graft.addTag && !effective.includes(graft.addTag)) {
    effective.push(graft.addTag);
  }
  return effective;
}

export function buildClassGraftCastPlan(
  classId: ClassType,
  abilityId: string,
  graftId: OperativeClassGraftId | undefined,
): ClassGraftCastPlan {
  const cost = resolveClassAbilityCost(classId, abilityId);
  const plan = defaultClassGraftCastPlan(
    cost.apCost,
    cost.ammoCost,
    cost.fluxGen,
    cost.fluxCost,
    cost.tags,
  );

  if (!graftId || classId === 'AEGIS') return plan;

  const graft = classId === 'HEX_SHOT'
    ? getHexShotGraftDefinition(graftId as HexShotGraftId)
    : getEnvoyGraftDefinition(graftId as EnvoyGraftId);

  plan.effectiveTags = applyTagMods(plan.effectiveTags, graft);
  plan.graftName = graft.name;

  if (graft.setApCost != null) plan.apCost = graft.setApCost;
  if (graft.addApCost != null) plan.apCost += graft.addApCost;

  if (graft.setAmmoCost != null) plan.ammoCost = graft.setAmmoCost;
  if (graft.addAmmoCost != null) plan.ammoCost += graft.addAmmoCost;
  if (graft.ammoCostMultiplier != null) plan.ammoCostMultiplier = graft.ammoCostMultiplier;

  if (graft.setFluxGen != null) plan.fluxGen = graft.setFluxGen;
  if (graft.setFluxCost != null) plan.fluxCost = graft.setFluxCost;
  if (graft.addFluxGeneration != null) plan.fluxGen += graft.addFluxGeneration;
  if (graft.modifyTagFrom === 'FLUX_GEN' && graft.modifyTagTo === 'FLUX_DUMP') {
    plan.fluxGen = 0;
    plan.fluxCost = graft.setFluxCost ?? plan.fluxCost;
  }

  if (graft.addHpCost != null) plan.hpCostPct += graft.addHpCost * 100;

  plan.extraStaminaCost = graft.staminaPenalty ?? 0;
  plan.damageMultiplier = graft.damageMultiplier ?? (graft.reduceDamage != null ? 1 - graft.reduceDamage : 1);
  plan.baseDamageMultiplier = graft.baseDamageMultiplier ?? 1;
  plan.hitCount = graft.hitCount ?? 1;
  plan.duplicateCastRatio = graft.duplicateCast ?? 0;
  plan.forceTrueDamage = graft.convertToTrueDamage === true;
  plan.healOnDamagePct = graft.healPercentageOfDamage ?? 0;
  plan.refundApOnKill = graft.refundApOnKill === true;
  plan.refundApOnCrit = graft.refundApOnCrit === true;
  plan.refundAmmoOnKill = graft.refundAmmoOnKill === true;
  plan.failDebuff = graft.selfDebuffOnFail ?? null;
  plan.executeThreshold = graft.executeThreshold ?? null;
  plan.guaranteedCrit = graft.setCritChance === 100;
  plan.randomTarget = graft.randomTarget === true;
  plan.consumeAllAmmo = graft.consumeAllAmmo === true;
  plan.damageScale = graft.damageScale ?? null;
  plan.convertToAoE = graft.convertToAoE === true;
  plan.dealSelfDamage = graft.dealSelfDamage ?? 0;
  plan.targetDebuff = graft.applyDebuffToTarget ?? null;
  plan.selfDebuff = graft.applySelfDebuff ?? null;
  plan.selfDebuffOnSurvive = graft.applySelfDebuffOnSurvive ?? null;
  plan.evadeBuffPct = graft.addBuff === 'EVADE_20' ? 20 : graft.addBuff === 'EVADE_30' ? 30 : 0;
  plan.untargetableBuff = graft.addBuff === 'UNTARGETABLE';
  plan.disableUltimate = graft.disableUltimate === true;

  plan.apCost = Math.max(0, plan.apCost);
  plan.ammoCost = Math.max(0, plan.ammoCost);

  return plan;
}

export function scaleClassGraftDamage(
  baseDamage: number,
  plan: ClassGraftCastPlan,
  ctx: { currentAmmo: number; maxAmmo: number; veilFlux: number },
): number {
  let damage = Math.floor(baseDamage * plan.damageMultiplier * plan.baseDamageMultiplier);
  if (plan.damageScale === 'MISSING_AMMO') {
    const missing = Math.max(0, ctx.maxAmmo - ctx.currentAmmo);
    damage += missing * 8;
  }
  if (plan.damageScale === 'CURRENT_FLUX') {
    damage += Math.floor(ctx.veilFlux * 0.35);
  }
  return Math.max(0, damage);
}

export function effectiveGraftAmmoCost(
  plan: ClassGraftCastPlan,
  currentAmmo: number,
): number {
  if (plan.consumeAllAmmo) return currentAmmo;
  return Math.max(0, Math.ceil(plan.ammoCost * plan.ammoCostMultiplier));
}

export function formatClassGraftOfferLine(
  classId: ClassType,
  graftId: string,
  residueBalance: number,
): string {
  const graft = getClassGraftDefinition(classId, graftId) as ClassGraftDefinition;
  const affordable = residueBalance >= graft.cost ? 'OK' : 'LOCKED';
  return `[ ${graft.name.toUpperCase()} ] — ${graft.cost} RESIDUE // ${affordable}\n${graft.description}`;
}

export function isClassUltimateDisabledForEncounter(
  classId: ClassType,
  hexShotAbilityGrafts: HexShotAbilityGraftMap,
  envoyAbilityGrafts: EnvoyAbilityGraftMap,
  encounterUltimateDisabled: boolean,
): boolean {
  if (encounterUltimateDisabled) return true;
  if (classId === 'HEX_SHOT') {
    return Object.values(hexShotAbilityGrafts).some(
      (id) => id != null && getHexShotGraftDefinition(id).disableUltimate === true,
    );
  }
  if (classId === 'ENVOY') {
    return Object.values(envoyAbilityGrafts).some(
      (id) => id != null && getEnvoyGraftDefinition(id).disableUltimate === true,
    );
  }
  return false;
}

export function getClassGraftCatalog(classId: ClassType) {
  if (classId === 'HEX_SHOT') return HEX_SHOT_GRAFT_DATABASE;
  if (classId === 'ENVOY') return ENVOY_GRAFT_DATABASE;
  return null;
}

export function getAbilityClassGraftId(
  classId: ClassType,
  abilityId: string,
  hexShotAbilityGrafts: HexShotAbilityGraftMap,
  envoyAbilityGrafts: EnvoyAbilityGraftMap,
  aegisAbilityGrafts: Partial<Record<AegisAbilityId, VeilGraftId>>,
): OperativeClassGraftId | VeilGraftId | undefined {
  if (classId === 'HEX_SHOT') {
    return hexShotAbilityGrafts[abilityId as HexShotAbilityId];
  }
  if (classId === 'ENVOY') {
    return envoyAbilityGrafts[abilityId as EnvoyAbilityId];
  }
  return aegisAbilityGrafts[abilityId as AegisAbilityId];
}
