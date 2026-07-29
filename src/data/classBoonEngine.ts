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
import type { HexAmmoType } from '../types/hexAmmo';
import type { WeaponFamilyId } from '../types/weapon';
import { prepareWeightedBoonOffers } from './boonOffer/boonOfferEngine';
import { resolveWeaponUltimateActionTags } from './weaponUltimateSurfaceEngine';

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

/**
 * Ammo-type refactor v1 — ammo identity is combat state. A BALLISTIC ability firing
 * Wraithglass ammo counts as VOID_AMMO for boon/effect matching, so legacy VOID_AMMO
 * boons apply to Wraithglass shots. Explicit VOID_AMMO ability tags still count.
 */
export function resolveHexEffectiveTags(
  abilityId: string,
  ammoType?: HexAmmoType,
): readonly string[] {
  const base = resolveWeaponUltimateActionTags(abilityId, 'HEX_SHOT');
  if (ammoType === 'WRAITHGLASS' && base.includes('BALLISTIC') && !base.includes('VOID_AMMO')) {
    return [...base, 'VOID_AMMO'];
  }
  return base;
}

export function isUsingWraithglassAmmo(abilityId: string, ammoType?: HexAmmoType): boolean {
  if (ammoType !== 'WRAITHGLASS') return false;
  return resolveWeaponUltimateActionTags(abilityId, 'HEX_SHOT').includes('BALLISTIC');
}

export function boonMatchesHexAction(
  boons: readonly HexShotBoonId[],
  boonId: HexShotBoonId,
  abilityId?: string | null,
  ammoType?: HexAmmoType,
): boolean {
  const rule = HEX_SHOT_BOON_RULES[boonId];
  if (!rule || !hasHexShotBoon(boons, boonId)) return false;
  if (!abilityId) return rule.hook === 'passive' || rule.hook === 'onEncounterStart';
  const tags = resolveHexEffectiveTags(abilityId, ammoType);
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
  const tags = resolveWeaponUltimateActionTags(abilityId, 'ENVOY');
  return tagsMatch(tags, rule.tagAll, rule.tagAny);
}

export function loadoutHasDefensiveHexAbility(
  loadout: readonly HexShotAbilityId[] | undefined,
): boolean {
  if (!loadout?.length) return false;
  return loadout.some((id) => getHexShotAbilityTags(id).includes('DEFENSIVE'));
}

export function aggregateHexShotBoonModifiers(
  boons: readonly HexShotBoonId[],
  loadout?: readonly HexShotAbilityId[],
): HexShotBoonCombatModifiers {
  const mods = defaultHexShotBoonModifiers();
  if (hasHexShotBoon(boons, 'EXTENDED_MAGS')) mods.maxAmmoBonus += 2;
  if (hasHexShotBoon(boons, 'DEPLETED_URANIUM_TIPS')) mods.ballisticArmorPierce += 1;
  if (hasHexShotBoon(boons, 'RECOIL_HARNESS')) mods.ballisticOverchargeDamagePct += 20;
  if (hasHexShotBoon(boons, 'SHATTER_RIFLING')) mods.ballisticFracturedDamagePct += 30;
  if (hasHexShotBoon(boons, 'DEAD_EYE')) mods.ballisticCritBonusFullMag += 15;
  if (hasHexShotBoon(boons, 'VOID_BANDOLEER')) mods.voidAmmoHpCostPct += 10;
  if (hasHexShotBoon(boons, 'LEYLINE_PENETRATOR')) mods.voidBacklineDamagePct += 50;
  if (
    hasHexShotBoon(boons, 'KINETIC_DAMPENERS')
    && loadoutHasDefensiveHexAbility(loadout)
  ) {
    mods.maxHpMultiplier *= 1.1;
  }
  if (hasHexShotBoon(boons, 'SURVIVALIST')) mods.sanctuaryHealBonusPct = 50;
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
  if (hasEnvoyBoon(boons, 'FLUX_CAPACITOR')) mods.fluxMaxCap = 120;
  if (hasEnvoyBoon(boons, 'VOIDS_BARGAIN')) mods.startingFluxPenalty = 25;
  if (hasEnvoyBoon(boons, 'GLASS_CANNON')) {
    mods.damageMultiplier *= 1.4;
    mods.maxHpMultiplier *= 0.75;
  }
  if (hasEnvoyBoon(boons, 'VOID_TOUCHED')) mods.spellDamageFluxBonusPct += 15;
  if (hasEnvoyBoon(boons, 'RESIDUAL_ENERGY')) mods.fluxRegenShieldStacks = 2;
  if (hasEnvoyBoon(boons, 'AETHERIC_BULWARK')) mods.kineticArmorPer25Flux = 1;
  if (hasEnvoyBoon(boons, 'MASOCHISTIC_CHANNEL')) mods.masochisticChannel = true;
  if (hasEnvoyBoon(boons, 'PENDULUM_SHIFT')) mods.pendulumDumpBonusPct += 50;
  if (hasEnvoyBoon(boons, 'OVERLOAD_MASTERY')) mods.overloadMasteryCrit = true;
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

export function pickRawLeyBoonsForClass(
  count: number,
  classId: ClassType,
  ownedAegis: readonly LeyLineMutationId[],
  ownedHex: readonly HexShotBoonId[],
  ownedEnvoy: readonly EnvoyBoonId[],
): string[] {
  if (classId === 'HEX_SHOT') {
    return pickRandomHexShotBoons(count, ownedHex).map((def) => def.id);
  }
  if (classId === 'ENVOY') {
    return pickRandomEnvoyBoons(count, ownedEnvoy).map((def) => def.id);
  }
  return pickRandomLeyLineMutations(count, ownedAegis).map((def) => def.id);
}

export function preparePostCombatBoonOffers(
  classId: ClassType,
  ownedAegis: readonly LeyLineMutationId[],
  ownedHex: readonly HexShotBoonId[],
  ownedEnvoy: readonly EnvoyBoonId[],
  count = 3,
  weighted?: {
    weaponFamilyId: WeaponFamilyId;
    equippedAbilityIds: readonly string[];
    seed: string;
    depthBand?: 1 | 2 | 3;
    isFirstOffer?: boolean;
    acquiredEngineFamilies?: readonly string[];
    abilityGrafts?: Readonly<Record<string, string>>;
  },
): PostCombatBoonOffer[] {
  if (weighted) {
    return prepareWeightedBoonOffers({
      classId,
      weaponFamilyId: weighted.weaponFamilyId,
      equippedAbilityIds: weighted.equippedAbilityIds,
      ownedAegis,
      ownedHex,
      ownedEnvoy,
      seed: weighted.seed,
      count,
      depthBand: weighted.depthBand,
      isFirstOffer: weighted.isFirstOffer,
      acquiredEngineFamilies: weighted.acquiredEngineFamilies,
      abilityGrafts: weighted.abilityGrafts,
    });
  }
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
