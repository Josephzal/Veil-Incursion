import type { WeaponFamilyId } from '../types/weapon';
import type { ClassGraftDefinition } from '../types/classGraft';
import { getWeaponIdentityProfile } from './weaponIdentityProfiles';

/**
 * Runtime tag layers for weapon basics (Phase 3F closeout).
 * mechanicalTags are attached to the resolved basic plan and merged with graft
 * transformations so combat effects / future boon eligibility can inspect them.
 */
export interface WeaponTagLayerInspect {
  baseWeaponTags: readonly string[];
  basicActionRuntimeTags: readonly string[];
  graftAddedTags: readonly string[];
  graftRemovedTags: readonly string[];
  finalTransformedTags: readonly string[];
  affinityTags: readonly string[];
}

export function applyGraftTagMods(
  tags: readonly string[],
  graft: Pick<ClassGraftDefinition, 'addTag' | 'removeTags' | 'modifyTagFrom' | 'modifyTagTo'>,
): { next: readonly string[]; added: readonly string[]; removed: readonly string[] } {
  const before = new Set(tags);
  let effective = [...tags];
  const removed: string[] = [];
  const added: string[] = [];

  if (graft.removeTags?.length) {
    for (const tag of graft.removeTags) {
      if (effective.includes(tag)) removed.push(tag);
    }
    effective = effective.filter((tag) => !graft.removeTags!.includes(tag));
  }
  if (graft.modifyTagFrom && graft.modifyTagTo) {
    const had = effective.includes(graft.modifyTagFrom);
    effective = effective.map((tag) =>
      tag === graft.modifyTagFrom ? graft.modifyTagTo! : tag,
    );
    if (had) {
      removed.push(graft.modifyTagFrom);
      if (!before.has(graft.modifyTagTo) && !added.includes(graft.modifyTagTo)) {
        added.push(graft.modifyTagTo);
      }
    }
    if (!effective.includes(graft.modifyTagTo)) {
      effective.push(graft.modifyTagTo);
      if (!added.includes(graft.modifyTagTo)) added.push(graft.modifyTagTo);
    }
  }
  if (graft.addTag && !effective.includes(graft.addTag)) {
    effective.push(graft.addTag);
    added.push(graft.addTag);
  }

  return { next: effective, added, removed };
}

/**
 * Build inspectable tag layers for a weapon basic resolution + optional graft.
 * `basicActionRuntimeTags` come from the live basic plan (not profile-only metadata).
 */
export function inspectWeaponBasicTagLayers(args: {
  familyId: WeaponFamilyId;
  basicActionRuntimeTags: readonly string[];
  graft?: Pick<ClassGraftDefinition, 'addTag' | 'removeTags' | 'modifyTagFrom' | 'modifyTagTo'> | null;
}): WeaponTagLayerInspect {
  const profile = getWeaponIdentityProfile(args.familyId);
  const baseWeaponTags = [...profile.mechanicalTags];
  const basicActionRuntimeTags = [...args.basicActionRuntimeTags];
  let finalTransformedTags = [...basicActionRuntimeTags];
  let graftAddedTags: readonly string[] = [];
  let graftRemovedTags: readonly string[] = [];

  if (args.graft) {
    const result = applyGraftTagMods(finalTransformedTags, args.graft);
    finalTransformedTags = [...result.next];
    graftAddedTags = result.added;
    graftRemovedTags = result.removed;
  }

  return {
    baseWeaponTags,
    basicActionRuntimeTags,
    graftAddedTags,
    graftRemovedTags,
    finalTransformedTags,
    affinityTags: [...profile.affinityTags],
  };
}

export function formatWeaponTagLayerDebug(inspect: WeaponTagLayerInspect): string {
  return [
    `baseWeapon=[${inspect.baseWeaponTags.join(',')}]`,
    `basicRuntime=[${inspect.basicActionRuntimeTags.join(',')}]`,
    `graftAdded=[${inspect.graftAddedTags.join(',')}]`,
    `graftRemoved=[${inspect.graftRemovedTags.join(',')}]`,
    `final=[${inspect.finalTransformedTags.join(',')}]`,
    `affinity=[${inspect.affinityTags.join(',')}]`,
  ].join(' // ');
}

/** True when final tags include a combat-relevant mechanical tag. */
export function runtimeHasMechanicalTag(
  finalTags: readonly string[],
  tag: string,
): boolean {
  return finalTags.includes(tag);
}
