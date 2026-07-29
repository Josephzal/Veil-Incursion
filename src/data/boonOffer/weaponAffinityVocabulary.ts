/**
 * Phase 3I — frozen weapon affinity vocabulary (soft weighting only).
 * Never hard-eligibility.
 */
import type { WeaponAffinityTag } from '../../types/weaponIdentity';
import type { WeaponFamilyId } from '../../types/weapon';
import { getWeaponIdentityProfile, listWeaponIdentityProfiles } from '../weaponIdentityProfiles';

/** Frozen ordered vocabulary — do not invent ad-hoc strings in profiles. */
export const WEAPON_AFFINITY_VOCABULARY = [
  'FRACTURE',
  'RELOAD',
  'EXECUTION',
  'ARMOR_PIERCE',
  'AOE',
  'CONTROL',
  'CURSE',
  'FLUX',
  'SACRIFICE',
  'HIGH_RISK',
  'RESERVE',
  'PARRY',
  'EVADE',
  'BALLISTIC',
  'MELEE',
  'OCCULT',
  'TRAP',
  'INTERRUPT',
  'CLEAN_CYCLE',
] as const satisfies readonly WeaponAffinityTag[];

export type FrozenWeaponAffinityTag = (typeof WEAPON_AFFINITY_VOCABULARY)[number];

/**
 * Retired from soft affinity vocabulary after 3I normalization.
 * BLEED overlapped Pulse AoE fantasy without a distinct soft-weight consumer path.
 */
export const RETIRED_AFFINITY_TAGS = ['BLEED'] as const;

export function isFrozenAffinityTag(tag: string): tag is FrozenWeaponAffinityTag {
  return (WEAPON_AFFINITY_VOCABULARY as readonly string[]).includes(tag);
}

export function listAffinityUsageMatrix(): {
  tag: FrozenWeaponAffinityTag;
  weapons: WeaponFamilyId[];
  siblingSharedFully: boolean;
}[] {
  const profiles = listWeaponIdentityProfiles();
  return WEAPON_AFFINITY_VOCABULARY.map((tag) => {
    const weapons = profiles.filter((p) => p.affinityTags.includes(tag)).map((p) => p.id);
    const byClass = new Map<string, WeaponFamilyId[]>();
    weapons.forEach((id) => {
      const cls = getWeaponIdentityProfile(id).classId;
      const list = byClass.get(cls) ?? [];
      list.push(id);
      byClass.set(cls, list);
    });
    const siblingSharedFully = [...byClass.values()].some((ids) => ids.length >= 3);
    return { tag, weapons, siblingSharedFully };
  });
}

/** Distinguishing affinity signal per weapon vs both siblings. */
export function distinguishingAffinityTags(id: WeaponFamilyId): FrozenWeaponAffinityTag[] {
  const self = getWeaponIdentityProfile(id);
  const siblings = listWeaponIdentityProfiles().filter(
    (p) => p.classId === self.classId && p.id !== id,
  );
  return self.affinityTags.filter((tag): tag is FrozenWeaponAffinityTag => {
    if (!isFrozenAffinityTag(tag)) return false;
    return siblings.every((s) => !s.affinityTags.includes(tag));
  });
}

export function validateAffinityVocabulary(): string[] {
  const issues: string[] = [];
  listWeaponIdentityProfiles().forEach((p) => {
    p.affinityTags.forEach((tag) => {
      if (!isFrozenAffinityTag(tag) && !(RETIRED_AFFINITY_TAGS as readonly string[]).includes(tag)) {
        issues.push(`${p.id} uses non-frozen affinity tag ${tag}`);
      }
    });
    if (distinguishingAffinityTags(p.id).length < 1) {
      issues.push(`${p.id} lacks a sibling-distinguishing affinity tag`);
    }
  });
  return issues;
}
