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
import { resolveHexShotAbilityGraftId } from './hexShotMigration';
import { canGraftAbility, rollVeilGraftOffers } from './veilGraftEngine';
import { GRAFT_DATABASE, getVeilGraftDefinition } from './veilGraftDatabase';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { VeilGraftId } from '../types/veilGraft';
import { resolveAegisAbilityGraftId } from './aegisGraftTarget';

const HEX_ANCHORS: readonly HexShotAbilityId[] = ['SILVER_CORE_SIDEARM'];
const ENVOY_ANCHORS: readonly EnvoyAbilityId[] = ['VEIL_SPLINTER'];

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

export function getMinimumClassGraftCost(classId: ClassType): number {
  if (classId === 'HEX_SHOT') {
    return Math.min(...Object.values(HEX_SHOT_GRAFT_DATABASE).map((graft) => graft.cost));
  }
  if (classId === 'ENVOY') {
    return Math.min(...Object.values(ENVOY_GRAFT_DATABASE).map((graft) => graft.cost));
  }
  return Math.min(...Object.values(GRAFT_DATABASE).map((graft) => graft.cost));
}

export function canAffordAnySanctuaryGraft(
  _classId: ClassType,
  _residueBalance?: number,
): boolean {
  // Stage II-B — run-scoped grafts no longer cost Veil Residue.
  return true;
}

/** Sanctuary graft application is the live grant path (no Residue charge). */
export function isSanctuaryGraftGrantEnabled(): boolean {
  return true;
}

export function isDeadMansSwitchReloadGraft(
  grafts: HexShotAbilityGraftMap,
): boolean {
  return grafts.PHASE_SHIFT_RELOAD === 'DEAD_MAN_SWITCH_GRAFT';
}

export function canGraftClassAbility(
  classId: ClassType,
  abilityId: string,
  access?: { allowFixedBasic?: boolean; allowUltimate?: boolean },
): boolean {
  const allowBasic = access?.allowFixedBasic === true;
  const allowUltimate = access?.allowUltimate === true;
  if (classId === 'HEX_SHOT') {
    if (abilityId === 'PHASE_SHIFT_RELOAD') return true;
    if (
      abilityId === 'SILVER_CORE_SIDEARM'
      || abilityId === 'QUICKDRAW'
      || abilityId === 'CENTER_MASS'
      || abilityId === 'DOOR_KNOCKER'
    ) {
      return allowBasic;
    }
    if (abilityId === 'ZERO_PROTOCOL') return allowUltimate;
    // WU-5: weapon ultimate IDs graft as ultimates (legacy ZERO_PROTOCOL path).
    if (abilityId === 'SIXTH_SEAL' || abilityId === 'LAST_KNOCK') return allowUltimate;
    return true;
  }
  if (classId === 'ENVOY') {
    if (abilityId === 'VEIL_SPLINTER') return allowBasic;
    if (abilityId === 'RIFT_WARD' || abilityId === 'CATACLYSM_SIGIL') return allowUltimate;
    if (abilityId === 'FUNERAL_KNOT' || abilityId === 'CRIMSON_REFRACTION' || abilityId === 'NULL_CIRCUIT') {
      return allowUltimate;
    }
    return true;
  }
  // Phase D — Aegis graftable surface is 4 family weapon actions + 3 techniques.
  // Parry / Ultimates / legacy STRIKE / EVISCERATE / THREEFOLD_BRAND are never graftable.
  const bare = abilityId.startsWith('WA:') || abilityId.startsWith('TECH:')
    ? abilityId.slice(abilityId.indexOf(':') + 1)
    : abilityId;
  if (
    bare === 'EVISCERATE'
    || bare === 'WRAITH_PARRY'
    || bare === 'ABYSSAL_VERDICT'
    || bare === 'REND_THE_VEIL'
    || bare === 'GRAVEFALL'
    || bare === 'THREEFOLD_BRAND'
    || bare === 'STRIKE'
  ) {
    return false;
  }
  if (
    bare === 'WARDENS_STRIKE'
    || bare === 'PAIRED_BLADES_STRIKE'
    || bare === 'UNMAKER_STRIKE'
  ) {
    return allowBasic;
  }
  // Weapon actions (non-strike) and techniques — graftable when not Ultimate-tagged.
  if (
    bare === 'RUPTURE'
    || bare === 'DREADBIND'
    || bare === 'NO_RESPITE'
    || bare === 'DIVERGENCE'
    || bare === 'ECLIPSE'
    || bare === 'SEVERANCE'
    || bare === 'DREAD_HORIZON'
    || bare === 'UNBOWED'
    || bare === 'DOOMFALL'
  ) {
    return true;
  }
  return canGraftAbility(bare as AegisAbilityId);
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
    cost.fluxRegen,
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

  if (graft.setFluxRegen != null) {
    plan.fluxRegen = graft.setFluxRegen;
  }
  if (graft.setFluxCost != null) {
    if (graft.setFluxCost < 0) {
      plan.fluxRegen = Math.abs(graft.setFluxCost);
      plan.fluxCost = 0;
    } else {
      plan.fluxCost = graft.setFluxCost;
    }
  }
  if (graft.addFluxCost != null) {
    plan.fluxCost += graft.addFluxCost;
  } else if (graft.addFluxGeneration != null) {
    plan.fluxCost += graft.addFluxGeneration;
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
  plan.bossDamageMultiplier = graft.bossDamageMultiplier ?? 1;
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
  plan.dropLootOnKill = graft.dropLootOnKill ?? null;

  plan.apCost = Math.max(0, plan.apCost);
  plan.ammoCost = Math.max(0, plan.ammoCost);

  return plan;
}

export function scaleClassGraftDamage(
  baseDamage: number,
  plan: ClassGraftCastPlan,
  ctx: { currentAmmo: number; maxAmmo: number; veilFlux: number; fluxMaxCap: number },
): number {
  if (plan.damageScale === 'MISSING_FLUX') {
    const missing = Math.max(0, ctx.fluxMaxCap - ctx.veilFlux);
    return Math.max(
      1,
      Math.floor(missing * 0.45 * plan.damageMultiplier * plan.baseDamageMultiplier),
    );
  }
  let damage = Math.floor(baseDamage * plan.damageMultiplier * plan.baseDamageMultiplier);
  if (plan.damageScale === 'MISSING_AMMO') {
    const missing = Math.max(0, ctx.maxAmmo - ctx.currentAmmo);
    damage += missing * 8;
  }
  if (plan.damageScale === 'CURRENT_FLUX') {
    damage += Math.floor((ctx.fluxMaxCap - ctx.veilFlux) * 0.35);
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
  _residueBalance?: number,
): string {
  const graft = getClassGraftDefinition(classId, graftId) as ClassGraftDefinition;
  return `[ ${graft.name.toUpperCase()} ] — SANCTUARY ATTUNE\n${graft.description}`;
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
  aegisAbilityGrafts: Partial<Record<string, VeilGraftId>>,
): OperativeClassGraftId | VeilGraftId | undefined {
  if (classId === 'HEX_SHOT') {
    return resolveHexShotAbilityGraftId(hexShotAbilityGrafts, abilityId as HexShotAbilityId);
  }
  if (classId === 'ENVOY') {
    return envoyAbilityGrafts[abilityId as EnvoyAbilityId];
  }
  return resolveAegisAbilityGraftId(aegisAbilityGrafts, abilityId);
}
