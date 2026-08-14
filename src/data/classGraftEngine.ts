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
import {
  applyUniversalDamagePacketUpgrade,
  getUniversalGraftDefinition,
  getUniversalGraftForAction,
  readUniversalUpgradeValue,
  universalGraftMatchesTarget,
} from './universalGraftRegistry';

const HEX_ANCHORS: readonly HexShotAbilityId[] = ['SILVER_CORE_SIDEARM'];
const ENVOY_ANCHORS: readonly EnvoyAbilityId[] = ['VEIL_SPLINTER'];

export function getClassGraftDefinition(
  classId: ClassType,
  graftId: string,
): ClassGraftDefinition | import('../types/veilGraft').VeilGraftDefinition {
  const universal = getUniversalGraftDefinition(graftId);
  if (universal?.classId === classId) {
    return universal as unknown as ClassGraftDefinition;
  }
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
  _grafts: HexShotAbilityGraftMap,
): boolean {
  return false;
}

export function canGraftClassAbility(
  classId: ClassType,
  abilityId: string,
  _access?: { allowFixedBasic?: boolean; allowUltimate?: boolean },
): boolean {
  const bare = abilityId.startsWith('WA:')
    ? abilityId.slice(3)
    : abilityId.startsWith('TECH:')
      ? abilityId.slice(5)
      : abilityId;
  return getUniversalGraftForAction(classId, bare) != null;
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

  if (!graftId || classId === 'AEGIS' || !universalGraftMatchesTarget(classId, abilityId, graftId)) {
    return plan;
  }
  const graft = getUniversalGraftDefinition(graftId);
  if (!graft) return plan;
  plan.graftId = graft.id;
  plan.upgradeAxis = graft.upgradeAxis;
  plan.currentAxisValue = graft.baseValue;
  plan.upgradedAxisValue = graft.upgradedValue;
  plan.graftName = graft.name;
  plan.fluxCost = readUniversalUpgradeValue(plan, 'FLUX_COST', plan.fluxCost);

  return plan;
}

export function scaleClassGraftDamage(
  baseDamage: number,
  plan: ClassGraftCastPlan,
  ctx: { currentAmmo: number; maxAmmo: number; veilFlux: number; fluxMaxCap: number },
): number {
  if (plan.upgradeAxis === 'DIRECT_DAMAGE') {
    const graft = getUniversalGraftDefinition(plan.graftId);
    return applyUniversalDamagePacketUpgrade({ damage: baseDamage }, graft).damage;
  }
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
  _classId: ClassType,
  _hexShotAbilityGrafts: HexShotAbilityGraftMap,
  _envoyAbilityGrafts: EnvoyAbilityGraftMap,
  _encounterUltimateDisabled: boolean,
): boolean {
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
