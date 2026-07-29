import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import type { WeaponAbilityInteractionHook } from '../../types/weaponLoadoutRecommendation';
import type { ClassGraftDefinition } from '../../types/classGraft';
import { getWeaponIdentityProfile } from '../weaponIdentityProfiles';
import {
  applyGraftTagMods,
  inspectWeaponBasicTagLayers,
} from '../weaponTagResolutionEngine';
import { getAbilityTags as getAegisAbilityTags } from '../aegisAbilities';
import { getHexShotAbilityTags } from '../hexShotAbilities';
import { getEnvoyAbilityTags } from '../envoyAbilities';
import { AEGIS_ANCHOR } from '../../utils/aegisLoadoutUtils';
import { HEX_SHOT_ANCHOR, ENVOY_ANCHOR } from '../classAbilityUnlockEngine';
import { isFrozenInteractionHook } from './weaponInteractionHookContract';
import { getClassGraftDefinition } from '../classGraftEngine';
import type { BoonOfferContext, TagLayerSnapshot } from './boonOfferTypes';

function abilityTags(classId: ClassType, abilityId: string): readonly string[] {
  if (classId === 'AEGIS') return getAegisAbilityTags(abilityId as never);
  if (classId === 'HEX_SHOT') return getHexShotAbilityTags(abilityId as never);
  return getEnvoyAbilityTags(abilityId as never);
}

type GraftTagMods = Pick<
  ClassGraftDefinition,
  'addTag' | 'removeTags' | 'modifyTagFrom' | 'modifyTagTo'
>;

function resolveGraftTagMods(
  classId: ClassType,
  graftId: string | undefined,
): GraftTagMods | null {
  if (!graftId) return null;
  const def = getClassGraftDefinition(classId, graftId) as GraftTagMods & { addTag?: string };
  return {
    addTag: def.addTag,
    removeTags: def.removeTags,
    modifyTagFrom: 'modifyTagFrom' in def ? (def as ClassGraftDefinition).modifyTagFrom : undefined,
    modifyTagTo: 'modifyTagTo' in def ? (def as ClassGraftDefinition).modifyTagTo : undefined,
  };
}

function transformAbilityTags(
  classId: ClassType,
  abilityId: string,
  graftId: string | undefined,
): { base: readonly string[]; final: readonly string[]; added: readonly string[]; removed: readonly string[] } {
  const base = [...abilityTags(classId, abilityId)];
  const mods = resolveGraftTagMods(classId, graftId);
  if (!mods) {
    return { base, final: base, added: [], removed: [] };
  }
  const result = applyGraftTagMods(base, mods);
  return { base, final: result.next, added: result.added, removed: result.removed };
}

/**
 * Build final transformed tag layers for the equipped loadout + weapon basic.
 * Applies per-ability equipped grafts. Affinity remains a separate soft layer.
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
  const anchor =
    args.classId === 'AEGIS' ? AEGIS_ANCHOR : args.classId === 'HEX_SHOT' ? HEX_SHOT_ANCHOR : ENVOY_ANCHOR;
  const basicGraftId = args.abilityGrafts?.[anchor];
  const basicGraftMods =
    args.graft
    ?? (basicGraftId ? resolveGraftTagMods(args.classId, basicGraftId) : null);

  const basic = inspectWeaponBasicTagLayers({
    familyId: args.weaponFamilyId,
    basicActionRuntimeTags: args.basicActionRuntimeTags ?? profile.mechanicalTags,
    graft: basicGraftMods,
  });

  const baseUnion = new Set<string>(basic.baseWeaponTags);
  const finalUnion = new Set<string>(basic.finalTransformedTags);
  const graftAdded = new Set<string>(basic.graftAddedTags);
  const graftRemoved = new Set<string>(basic.graftRemovedTags);

  args.equippedAbilityIds.forEach((id) => {
    const graftId = args.abilityGrafts?.[id];
    // Anchor uses weapon-basic graft mods when provided via `graft` or abilityGrafts.
    const modsForAbility: GraftTagMods | null =
      id === anchor && args.graft
        ? args.graft
        : resolveGraftTagMods(args.classId, graftId);
    const base = [...abilityTags(args.classId, id)];
    let final = base;
    let added: readonly string[] = [];
    let removed: readonly string[] = [];
    if (modsForAbility) {
      const result = applyGraftTagMods(base, modsForAbility);
      final = [...result.next];
      added = result.added;
      removed = result.removed;
    } else if (id === anchor && basicGraftMods) {
      const result = applyGraftTagMods(base, basicGraftMods);
      final = [...result.next];
      added = result.added;
      removed = result.removed;
    }
    base.forEach((t) => baseUnion.add(t));
    final.forEach((t) => finalUnion.add(t));
    added.forEach((t) => graftAdded.add(t));
    removed.forEach((t) => graftRemoved.add(t));
  });

  // Ensure removed tags do not leak from base registry unless another action still has them.
  graftRemoved.forEach((t) => {
    const stillPresent = args.equippedAbilityIds.some((id) => {
      const graftId = args.abilityGrafts?.[id];
      return transformAbilityTags(args.classId, id, graftId).final.includes(t);
    }) || basic.finalTransformedTags.includes(t);
    if (!stillPresent) finalUnion.delete(t);
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
    if (weaponFamilyId === 'aegis-rift-edge') hooks.push('RIFT_EDGE_TEMPO', 'PARRY_EVADE_TEMPO');
    if (weaponFamilyId === 'aegis-claymore-blade') hooks.push('STAMINA_PRESSURE', 'FRACTURE_BREAK');
  }
  if (classId === 'HEX_SHOT') {
    hooks.push('RELOAD_PROTOCOL', 'PROTOCOL_CHARGE');
    if (weaponFamilyId === 'hex-void-cannon') hooks.push('ARMOR_PRESSURE', 'STAMINA_PRESSURE');
    if (weaponFamilyId === 'hex-pulse-rifle') hooks.push('SPREAD_CLUSTER');
    if (weaponFamilyId === 'hex-silver-core-sidearm') hooks.push('EXECUTE_WINDOW');
  }
  if (classId === 'ENVOY') {
    hooks.push('FLUX_CYCLE');
    if (weaponFamilyId === 'envoy-null-conduit') hooks.push('CLEAN_CATALYST_CYCLE');
    if (weaponFamilyId === 'envoy-echo-lantern') hooks.push('ROT_SETUP');
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
  // If Echo graft on STRIKE removes FRACTURE and no other ability supplies it, drop FRACTURE_SETUP
  // from soft weight signals — hard eligibility uses final tags.
  const layers = buildLoadoutTagLayers({
    classId: args.classId,
    weaponFamilyId: args.weaponFamilyId,
    equippedAbilityIds: args.equippedAbilityIds,
    abilityGrafts: args.abilityGrafts,
  });
  if (!layers.finalTransformedTags.includes('FRACTURE')) {
    hooks = hooks.filter((h) => h !== 'FRACTURE_SETUP' && h !== 'FRACTURE_BREAK');
  }
  if (
    args.weaponFamilyId === 'hex-pulse-rifle'
    && args.abilityGrafts
    && Object.values(args.abilityGrafts).includes('WIDOW_CHOKE_GRAFT')
  ) {
    // Widow-Choke on a spread ability removes AoE — SPREAD_CLUSTER may still exist on basic.
    const basicGraft = args.abilityGrafts['SILVER_CORE_SIDEARM'];
    if (basicGraft === 'WIDOW_CHOKE_GRAFT') {
      hooks = hooks.filter((h) => h !== 'SPREAD_CLUSTER');
    }
  }
  return hooks;
}

export function ensureFixedBasicInLoadout(
  classId: ClassType,
  equippedAbilityIds: readonly string[],
): readonly string[] {
  const anchor =
    classId === 'AEGIS' ? AEGIS_ANCHOR : classId === 'HEX_SHOT' ? HEX_SHOT_ANCHOR : ENVOY_ANCHOR;
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
