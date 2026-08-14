import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import type { WeaponAbilityInteractionHook } from '../../types/weaponLoadoutRecommendation';
import { getWeaponIdentityProfile } from '../weaponIdentityProfiles';
import {
  inspectWeaponBasicTagLayers,
} from '../weaponTagResolutionEngine';
import { HEX_SHOT_ANCHOR, ENVOY_ANCHOR } from '../classAbilityUnlockEngine';
import { isFrozenInteractionHook } from './weaponInteractionHookContract';
import type { BoonOfferContext, TagLayerSnapshot } from './boonOfferTypes';
import { resolveClassAbilityCost } from '../classAbilityResolver';

function abilityTags(classId: ClassType, abilityId: string): readonly string[] {
  return resolveClassAbilityCost(classId, abilityId).tags;
}

type GraftTagMods = {
  addTag?: string;
  removeTags?: readonly string[];
  modifyTagFrom?: string;
  modifyTagTo?: string;
};

/**
 * Build authored tag layers for the equipped loadout + weapon basic.
 * Universal action upgrades never alter tags. Affinity remains a separate soft layer.
 */
export function buildLoadoutTagLayers(args: {
  classId: ClassType;
  weaponFamilyId: WeaponFamilyId;
  equippedAbilityIds: readonly string[];
  basicActionRuntimeTags?: readonly string[];
  /** Single graft on the weapon basic (legacy arg). */
  graft?: GraftTagMods | null;
  /** Equipped ability → graft map (Phase 3J). */
  abilityGrafts?: Readonly<Record<string, string>>;
}): TagLayerSnapshot {
  const profile = getWeaponIdentityProfile(args.weaponFamilyId);
  // Stage V-B: universal action upgrades never add/remove tags. `graft` is ignored.
  void args.graft;
  void args.abilityGrafts;
  const basic = inspectWeaponBasicTagLayers({
    familyId: args.weaponFamilyId,
    basicActionRuntimeTags: args.basicActionRuntimeTags ?? profile.mechanicalTags,
    graft: null,
  });

  const baseUnion = new Set<string>(basic.baseWeaponTags);
  const finalUnion = new Set<string>(basic.finalTransformedTags);
  const graftAdded = new Set<string>(basic.graftAddedTags);
  const graftRemoved = new Set<string>(basic.graftRemovedTags);

  args.equippedAbilityIds.forEach((id) => {
    const base = [...abilityTags(args.classId, id)];
    base.forEach((t) => baseUnion.add(t));
    base.forEach((t) => finalUnion.add(t));
  });

  if (args.classId === 'HEX_SHOT') {
    finalUnion.add('VOID_AMMO');
    baseUnion.add('VOID_AMMO');
  }

  return {
    baseActionTags: [...baseUnion],
    runtimeBasicTags: [...basic.basicActionRuntimeTags],
    graftAddedTags: [...graftAdded],
    graftRemovedTags: [...graftRemoved],
    finalTransformedTags: [...finalUnion],
  };
}

function alwaysReachableHooks(
  classId: ClassType,
  weaponFamilyId: WeaponFamilyId,
): WeaponAbilityInteractionHook[] {
  const hooks: WeaponAbilityInteractionHook[] = ['WEAPON_BASIC'];
  if (classId === 'AEGIS') {
    hooks.push('FRACTURE_SETUP', 'FRACTURE_BREAK', 'RESERVE_FLOW', 'RUNIC_BRAND');
    if (weaponFamilyId === 'aegis-paired-blades') hooks.push('RIFT_EDGE_TEMPO', 'PARRY_EVADE_TEMPO');
    if (weaponFamilyId === 'aegis-claymore') hooks.push('STAMINA_PRESSURE', 'FRACTURE_BREAK');
  }
  if (classId === 'HEX_SHOT') {
    hooks.push('RELOAD_PROTOCOL', 'PROTOCOL_CHARGE');
    if (weaponFamilyId === 'hex-shotgun') hooks.push('ARMOR_PRESSURE', 'STAMINA_PRESSURE');
    if (weaponFamilyId === 'hex-carbine') hooks.push('SPREAD_CLUSTER');
    if (weaponFamilyId === 'hex-revolver') hooks.push('EXECUTE_WINDOW');
  }
  if (classId === 'ENVOY') {
    hooks.push('FLUX_CYCLE');
    if (weaponFamilyId === 'envoy-scythe') hooks.push('CLEAN_CATALYST_CYCLE');
    if (weaponFamilyId === 'envoy-vambrace') hooks.push('ROT_SETUP');
    if (weaponFamilyId === 'envoy-sanguine-prism') hooks.push('BRINK_FLUX', 'HP_SACRIFICE');
  }
  return hooks.filter(isFrozenInteractionHook);
}

function abilityReachableHooks(
  classId: ClassType,
  equippedAbilityIds: readonly string[],
  abilityGrafts?: Readonly<Record<string, string>>,
): WeaponAbilityInteractionHook[] {
  const hooks: WeaponAbilityInteractionHook[] = [];
  const set = new Set(equippedAbilityIds);
  if (classId === 'HEX_SHOT' && set.has('ASH_JACKET_SALVO')) hooks.push('ASH_SALVO_BURST');
  if (classId === 'ENVOY' && set.has('FLUX_PURGE')) {
    hooks.push('FLUX_PURGE_ROUTE', 'ROT_DETONATION');
  }
  // If a graft removed FRACTURE from the only Fracture-bearing action, FRACTURE_SETUP may still
  // come from weapon basic — recalculated via tag layers at eligibility time.
  void abilityGrafts;
  return hooks.filter(isFrozenInteractionHook);
}

export function resolveReachableInteractionHooks(args: {
  classId: ClassType;
  weaponFamilyId: WeaponFamilyId;
  equippedAbilityIds: readonly string[];
  abilityGrafts?: Readonly<Record<string, string>>;
}): WeaponAbilityInteractionHook[] {
  let hooks = [
    ...new Set([
      ...alwaysReachableHooks(args.classId, args.weaponFamilyId),
      ...abilityReachableHooks(args.classId, args.equippedAbilityIds, args.abilityGrafts),
    ]),
  ];
  // Reachability follows authored action tags.
  const layers = buildLoadoutTagLayers({
    classId: args.classId,
    weaponFamilyId: args.weaponFamilyId,
    equippedAbilityIds: args.equippedAbilityIds,
    abilityGrafts: args.abilityGrafts,
  });
  if (!layers.finalTransformedTags.includes('FRACTURE')) {
    hooks = hooks.filter((h) => h !== 'FRACTURE_SETUP' && h !== 'FRACTURE_BREAK');
  }
  return hooks;
}

export function ensureFixedBasicInLoadout(
  classId: ClassType,
  equippedAbilityIds: readonly string[],
): readonly string[] {
  // Phase C: Aegis techniques are exactly three — no phantom STRIKE pad.
  if (classId === 'AEGIS') {
    return equippedAbilityIds.slice(0, 3);
  }
  const anchor = classId === 'HEX_SHOT' ? HEX_SHOT_ANCHOR : ENVOY_ANCHOR;
  if (equippedAbilityIds.includes(anchor)) return equippedAbilityIds;
  return [anchor, ...equippedAbilityIds.filter((id) => id !== anchor)].slice(0, 4);
}

export function buildBoonOfferContext(args: {
  classId: ClassType;
  weaponFamilyId: WeaponFamilyId;
  equippedAbilityIds: readonly string[];
  ownedBoonIds: readonly string[];
  acquiredEngineFamilies?: readonly string[];
  depthBand?: 1 | 2 | 3;
  isFirstOffer?: boolean;
  seed: string;
  offerCount?: number;
  basicActionRuntimeTags?: readonly string[];
  graft?: GraftTagMods | null;
  abilityGrafts?: Readonly<Record<string, string>>;
}): BoonOfferContext {
  const equipped = ensureFixedBasicInLoadout(args.classId, args.equippedAbilityIds);
  const tagLayers = buildLoadoutTagLayers({
    classId: args.classId,
    weaponFamilyId: args.weaponFamilyId,
    equippedAbilityIds: equipped,
    basicActionRuntimeTags: args.basicActionRuntimeTags,
    graft: args.graft,
    abilityGrafts: args.abilityGrafts,
  });
  const profile = getWeaponIdentityProfile(args.weaponFamilyId);
  return {
    classId: args.classId,
    weaponFamilyId: args.weaponFamilyId,
    equippedAbilityIds: equipped,
    tagLayers,
    reachableHooks: resolveReachableInteractionHooks({
      classId: args.classId,
      weaponFamilyId: args.weaponFamilyId,
      equippedAbilityIds: equipped,
      abilityGrafts: args.abilityGrafts,
    }),
    weaponAffinityTags: [...profile.affinityTags],
    ownedBoonIds: args.ownedBoonIds,
    acquiredEngineFamilies: args.acquiredEngineFamilies ?? [],
    depthBand: args.depthBand ?? 1,
    isFirstOffer: args.isFirstOffer ?? false,
    seed: args.seed,
    offerCount: args.offerCount ?? 3,
  };
}
