import type { ClassType } from '../types/game';
import type {
  ClassBoonDefinition,
  EnvoyBoonCombatModifiers,
  HexShotBoonCombatModifiers,
  HexShotBoonId,
  EnvoyBoonId,
  OperativeClassBoonId,
  PostCombatBoonOffer,
} from '../types/classBoon';
import {
  defaultEnvoyBoonModifiers,
  defaultHexShotBoonModifiers,
} from '../types/classBoon';
import type { BoonHook } from '../types/boonHooks';
import { getEnvoyAbilityTags } from './envoyAbilities';
import { getHexShotAbilityTags } from './hexShotAbilities';
import { ENVOY_BOON_CATALOG, pickRandomEnvoyBoons } from './envoyBoons';
import { HEX_SHOT_BOON_CATALOG, pickRandomHexShotBoons } from './hexShotBoons';
import { LEY_LINE_MUTATION_CATALOG, pickRandomLeyLineMutations } from './leyLineMutations';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';

export interface ClassBoonRule {
  id: OperativeClassBoonId;
  hook: BoonHook;
  tagAll?: readonly string[];
  tagAny?: readonly string[];
  trigger: string;
}

function catalogToRule(def: ClassBoonDefinition): ClassBoonRule {
  return {
    id: def.id,
    hook: def.hook,
    tagAll: def.tagAll,
    tagAny: def.tagAny,
    trigger: def.effect,
  };
}

export const HEX_SHOT_BOON_RULES: Record<HexShotBoonId, ClassBoonRule> = Object.fromEntries(
  Object.values(HEX_SHOT_BOON_CATALOG).map((def) => [def.id, catalogToRule(def)]),
) as Record<HexShotBoonId, ClassBoonRule>;

export const ENVOY_BOON_RULES: Record<EnvoyBoonId, ClassBoonRule> = Object.fromEntries(
  Object.values(ENVOY_BOON_CATALOG).map((def) => [def.id, catalogToRule(def)]),
) as Record<EnvoyBoonId, ClassBoonRule>;

function tagsMatch(
  actionTags: readonly string[],
  tagAll?: readonly string[],
  tagAny?: readonly string[],
): boolean {
  if (tagAll?.length && !tagAll.every((t) => actionTags.includes(t))) return false;
  if (tagAny?.length && !tagAny.some((t) => actionTags.includes(t))) return false;
  return true;
}

function resolveClassAbilityTags(classId: ClassType, abilityId: string): readonly string[] {
  if (classId === 'HEX_SHOT') return getHexShotAbilityTags(abilityId as HexShotAbilityId);
  if (classId === 'ENVOY') return getEnvoyAbilityTags(abilityId as EnvoyAbilityId);
  return [];
}

export function hasHexShotBoon(boons: readonly HexShotBoonId[], id: HexShotBoonId): boolean {
  return boons.includes(id);
}

export function hasEnvoyBoon(boons: readonly EnvoyBoonId[], id: EnvoyBoonId): boolean {
  return boons.includes(id);
}

export function boonMatchesHexAction(
  boons: readonly HexShotBoonId[],
  boonId: HexShotBoonId,
  abilityId?: string | null,
): boolean {
  const rule = HEX_SHOT_BOON_RULES[boonId];
  if (!rule || !hasHexShotBoon(boons, boonId)) return false;
  if (!abilityId) return rule.hook === 'passive' || rule.hook === 'onEncounterStart';
  const tags = getHexShotAbilityTags(abilityId as HexShotAbilityId);
  return tagsMatch(tags, rule.tagAll, rule.tagAny);
}

export function boonMatchesEnvoyAction(
  boons: readonly EnvoyBoonId[],
  boonId: EnvoyBoonId,
  abilityId?: string | null,
): boolean {
  const rule = ENVOY_BOON_RULES[boonId];
  if (!rule || !hasEnvoyBoon(boons, boonId)) return false;
  if (!abilityId) return rule.hook === 'passive' || rule.hook === 'onEncounterStart';
  const tags = getEnvoyAbilityTags(abilityId as EnvoyAbilityId);
  return tagsMatch(tags, rule.tagAll, rule.tagAny);
}

export function aggregateHexShotBoonModifiers(
  boons: readonly HexShotBoonId[],
): HexShotBoonCombatModifiers {
  const mods = defaultHexShotBoonModifiers();
  if (hasHexShotBoon(boons, 'EXTENDED_MAGS')) mods.maxAmmoBonus += 2;
  if (hasHexShotBoon(boons, 'DEPLETED_URANIUM_TIPS')) mods.ballisticArmorPierce += 1;
  if (hasHexShotBoon(boons, 'RECOIL_HARNESS')) mods.ballisticStaminaDiscountPct += 50;
  if (hasHexShotBoon(boons, 'SHATTER_RIFLING')) mods.ballisticFracturedDamagePct += 30;
  if (hasHexShotBoon(boons, 'DEAD_EYE')) mods.ballisticCritBonusFullMag += 15;
  if (hasHexShotBoon(boons, 'VOID_BANDOLEER')) mods.voidAmmoHpCostPct += 10;
  if (hasHexShotBoon(boons, 'LEYLINE_PENETRATOR')) mods.voidBacklineDamagePct += 50;
  if (hasHexShotBoon(boons, 'KINETIC_DAMPENERS')) mods.maxHpMultiplier *= 1.1;
  if (hasHexShotBoon(boons, 'AUTO_LOADER_DECK')) mods.autoLoaderOnStart = true;
  if (hasHexShotBoon(boons, 'FLAWLESS_DRILL')) mods.perfectReloadApBonus = true;
  if (hasHexShotBoon(boons, 'GUNSMITHS_CURSE')) {
    mods.damageMultiplier *= 1.3;
    mods.gunsmithsCurseActive = true;
  }
  return mods;
}

export function aggregateEnvoyBoonModifiers(
  boons: readonly EnvoyBoonId[],
): EnvoyBoonCombatModifiers {
  const mods = defaultEnvoyBoonModifiers();
  if (hasEnvoyBoon(boons, 'FLUX_CAPACITOR')) mods.fluxOverloadThreshold = 120;
  if (hasEnvoyBoon(boons, 'DEEP_RESERVES')) mods.startingFlux = 50;
  if (hasEnvoyBoon(boons, 'GLASS_CANNON')) {
    mods.damageMultiplier *= 1.4;
    mods.maxHpMultiplier *= 0.75;
  }
  if (hasEnvoyBoon(boons, 'VOID_TOUCHED')) mods.spellDamageFluxBonusPct += 15;
  if (hasEnvoyBoon(boons, 'ASTRAL_PIERCER')) mods.spellDamageFluxBonusPct += 0; // handled per-target
  if (hasEnvoyBoon(boons, 'RESIDUAL_ENERGY')) mods.fluxGenShieldStacks = 2;
  if (hasEnvoyBoon(boons, 'AETHERIC_BULWARK')) mods.kineticArmorPer25Flux = 1;
  if (hasEnvoyBoon(boons, 'MASOCHISTIC_CHANNEL')) mods.masochisticChannel = true;
  if (hasEnvoyBoon(boons, 'PENDULUM_SHIFT')) mods.pendulumDumpBonusPct += 50;
  if (hasEnvoyBoon(boons, 'OVERLOAD_MASTERY')) mods.overloadMasteryCrit = true;
  if (hasEnvoyBoon(boons, 'VOIDS_BARGAIN')) mods.damageMultiplier *= 1; // first-hit hook
  return mods;
}

function toOffer(def: ClassBoonDefinition): PostCombatBoonOffer {
  return {
    id: def.id,
    classId: def.classId,
    name: def.name,
    tier: def.tier,
    tierLabel: def.tierLabel,
    description: def.description,
    effect: def.effect,
  };
}

export function preparePostCombatBoonOffers(
  classId: ClassType,
  ownedAegis: readonly LeyLineMutationId[],
  ownedHex: readonly HexShotBoonId[],
  ownedEnvoy: readonly EnvoyBoonId[],
  count = 3,
): PostCombatBoonOffer[] {
  if (classId === 'HEX_SHOT') {
    return pickRandomHexShotBoons(count, ownedHex).map(toOffer);
  }
  if (classId === 'ENVOY') {
    return pickRandomEnvoyBoons(count, ownedEnvoy).map(toOffer);
  }
  return pickRandomLeyLineMutations(count, ownedAegis).map((def) => ({
    id: def.id,
    classId: 'AEGIS' as const,
    name: def.name,
    tier: def.tier,
    tierLabel: def.tier,
    description: def.description,
    effect: def.effect,
  }));
}

export function getClassBoonDisplayName(
  classId: ClassType,
  boonId: string,
): string {
  if (classId === 'HEX_SHOT') {
    return HEX_SHOT_BOON_CATALOG[boonId as HexShotBoonId]?.name ?? boonId;
  }
  if (classId === 'ENVOY') {
    return ENVOY_BOON_CATALOG[boonId as EnvoyBoonId]?.name ?? boonId;
  }
  return LEY_LINE_MUTATION_CATALOG[boonId as LeyLineMutationId]?.name ?? boonId;
}

export function getOwnedClassBoons(
  classId: ClassType,
  inc: {
    leyLineMutations: readonly LeyLineMutationId[];
    hexShotBoons: readonly HexShotBoonId[];
    envoyBoons: readonly EnvoyBoonId[];
  },
): readonly string[] {
  if (classId === 'HEX_SHOT') return inc.hexShotBoons;
  if (classId === 'ENVOY') return inc.envoyBoons;
  return inc.leyLineMutations;
}

/** Unused helper kept for future cross-class action routing. */
export function resolveClassAbilityTagsForBoon(classId: ClassType, abilityId: string): readonly string[] {
  return resolveClassAbilityTags(classId, abilityId);
}
