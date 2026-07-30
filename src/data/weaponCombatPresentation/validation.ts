/**
 * Phase 3M — focused presentation validation (not the broad 3N suite).
 */

import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from '../weaponRegistry';
import { WEAPON_ANCHOR_ATTACK_BY_FAMILY } from '../weaponAnchorAttackRegistry';
import { WEAPON_ULTIMATE_BY_FAMILY } from '../weaponUltimateRegistry';
import {
  getWeaponCombatPresentationProfile,
  listWeaponCombatPresentationProfiles,
  WEAPON_COMBAT_PRESENTATION_BY_FAMILY,
} from './profiles';
import { resolveCombatPresentationCueRecipe } from '../../utils/combatPresentationAudio';

export interface WeaponPresentationValidationIssue {
  level: 'error' | 'warn';
  code: string;
  message: string;
}

export function validateWeaponCombatPresentation(): WeaponPresentationValidationIssue[] {
  const issues: WeaponPresentationValidationIssue[] = [];

  for (const id of ALL_WEAPON_FAMILY_IDS) {
    const profile = WEAPON_COMBAT_PRESENTATION_BY_FAMILY[id];
    if (!profile) {
      issues.push({
        level: 'error',
        code: 'MISSING_PROFILE',
        message: `No presentation profile for ${id}`,
      });
      continue;
    }
    if (profile.weaponFamilyId !== id) {
      issues.push({
        level: 'error',
        code: 'PROFILE_ID_MISMATCH',
        message: `Profile key ${id} has weaponFamilyId ${profile.weaponFamilyId}`,
      });
    }
    if (profile.displayName !== getWeaponFamily(id).name) {
      issues.push({
        level: 'error',
        code: 'DISPLAY_NAME_DRIFT',
        message: `${id} displayName ${profile.displayName} != registry ${getWeaponFamily(id).name}`,
      });
    }
    if (profile.anchorId !== WEAPON_ANCHOR_ATTACK_BY_FAMILY[id].id) {
      issues.push({
        level: 'error',
        code: 'ANCHOR_MISMATCH',
        message: `${id} anchor ${profile.anchorId} != registry`,
      });
    }
    if (profile.ultimateId !== WEAPON_ULTIMATE_BY_FAMILY[id].id) {
      issues.push({
        level: 'error',
        code: 'ULTIMATE_MISMATCH',
        message: `${id} ultimate ${profile.ultimateId} != registry`,
      });
    }
    if (profile.anchorSequence.length < 2 || profile.ultimateSequence.length < 2) {
      issues.push({
        level: 'error',
        code: 'SHORT_SEQUENCE',
        message: `${id} missing anchor/ultimate sequence stages`,
      });
    }
    const cueIds = Object.values(profile.cues).filter(Boolean) as string[];
    for (const cue of cueIds) {
      if (!resolveCombatPresentationCueRecipe(cue)) {
        issues.push({
          level: 'error',
          code: 'MISSING_CUE',
          message: `${id} cue ${cue} unresolved`,
        });
      }
    }
  }

  // Ensure no profile is keyed by display name.
  for (const profile of listWeaponCombatPresentationProfiles()) {
    if ((WEAPON_COMBAT_PRESENTATION_BY_FAMILY as Record<string, unknown>)[profile.displayName]) {
      issues.push({
        level: 'error',
        code: 'DISPLAY_NAME_KEY',
        message: `Presentation map must not key by display name ${profile.displayName}`,
      });
    }
    // Pose keys must be permanent IDs.
    getWeaponCombatPresentationProfile(profile.idlePoseKey);
    getWeaponCombatPresentationProfile(profile.attackPoseKey);
  }

  return issues;
}

export function formatWeaponCombatPresentationValidationReport(): string {
  const issues = validateWeaponCombatPresentation();
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');
  return [
    '== WEAPON COMBAT PRESENTATION (3M) ==',
    `profiles=${ALL_WEAPON_FAMILY_IDS.length} errors=${errors.length} warns=${warns.length}`,
    ...issues.map((i) => `[${i.level}] ${i.code}: ${i.message}`),
  ].join('\n');
}
