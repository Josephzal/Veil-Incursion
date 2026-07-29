/**
 * WU-5 — player-facing ultimate surfaces + boon/graft hook compatibility.
 * Display names always resolve from the equipped weapon ultimate registry.
 * Hook ability IDs stay on legacy class ultimate tokens so ULTIMATE-tagged
 * boons/grafts keep firing without a full ability-catalog rewrite.
 */
import type { ClassType } from '../types/game';
import type { WeaponFamilyId } from '../types/weapon';
import {
  getWeaponUltimate,
  getWeaponUltimateById,
  isWeaponUltimateId,
  type WeaponUltimateId,
} from './weaponUltimateRegistry';
import { getAbilityTags } from './aegisAbilities';
import { getHexShotAbilityTags } from './hexShotAbilities';
import { getEnvoyAbilityTags } from './envoyAbilities';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';

/** Legacy ability IDs used by boon/graft tag matchers for weapon ultimates. */
export type WeaponUltimateLegacyHookAbilityId =
  | 'EVISCERATE'
  | 'ZERO_PROTOCOL'
  | 'CATACLYSM_SIGIL';

const LEGACY_HOOK_BY_CLASS: Record<ClassType, WeaponUltimateLegacyHookAbilityId> = {
  AEGIS: 'EVISCERATE',
  HEX_SHOT: 'ZERO_PROTOCOL',
  ENVOY: 'CATACLYSM_SIGIL',
};

export function resolveWeaponUltimateDisplayName(
  familyId: WeaponFamilyId | null | undefined,
): string | null {
  if (!familyId) return null;
  return getWeaponUltimate(familyId).displayName;
}

/** Compact ready chip for gauges (no brackets). */
export function formatWeaponUltimateReadyChip(
  familyId: WeaponFamilyId | null | undefined,
): string | null {
  return resolveWeaponUltimateDisplayName(familyId);
}

export function formatWeaponUltimateReadyCallout(
  familyId: WeaponFamilyId | null | undefined,
): string | null {
  const name = resolveWeaponUltimateDisplayName(familyId);
  return name ? `${name} READY` : null;
}

/** Protocol / Rot / AR ready suffixes. */
export function formatWeaponUltimateGaugeReadySuffix(
  familyId: WeaponFamilyId | null | undefined,
): string {
  const name = resolveWeaponUltimateDisplayName(familyId);
  return name ? ` // ${name}` : '';
}

/**
 * Legacy ability ID for ULTIMATE-tagged boon/graft matchers.
 * Logs and HUD must still use registry display names — not these IDs.
 */
export function resolveWeaponUltimateLegacyHookAbilityId(
  familyId: WeaponFamilyId | null | undefined,
): WeaponUltimateLegacyHookAbilityId | null {
  if (!familyId) return null;
  return LEGACY_HOOK_BY_CLASS[getWeaponUltimate(familyId).classId];
}

export function isWeaponUltimateLegacyHookAbilityId(
  abilityId: string | null | undefined,
): abilityId is WeaponUltimateLegacyHookAbilityId {
  return (
    abilityId === 'EVISCERATE'
    || abilityId === 'ZERO_PROTOCOL'
    || abilityId === 'CATACLYSM_SIGIL'
  );
}

/** True when abilityId is a weapon ultimate id or its legacy hook token. */
export function isWeaponUltimateActionId(abilityId: string | null | undefined): boolean {
  if (!abilityId) return false;
  if (isWeaponUltimateLegacyHookAbilityId(abilityId)) return true;
  return isWeaponUltimateId(abilityId);
}

/**
 * Tags for ultimate damage/kill resolution.
 * WeaponUltimateId → legacy ultimate tags for the owning class.
 */
export function resolveWeaponUltimateActionTags(
  abilityId: string | null | undefined,
  classId?: ClassType,
): readonly string[] {
  if (!abilityId) return [];

  if (isWeaponUltimateId(abilityId)) {
    const record = getWeaponUltimateById(abilityId);
    const legacy = LEGACY_HOOK_BY_CLASS[record.classId];
    if (legacy === 'EVISCERATE') return getAbilityTags('EVISCERATE' as AegisAbilityId);
    if (legacy === 'ZERO_PROTOCOL') return getHexShotAbilityTags('ZERO_PROTOCOL' as HexShotAbilityId);
    return getEnvoyAbilityTags('CATACLYSM_SIGIL' as EnvoyAbilityId);
  }

  if (abilityId === 'EVISCERATE') {
    return getAbilityTags('EVISCERATE' as AegisAbilityId);
  }
  if (abilityId === 'ZERO_PROTOCOL') {
    return getHexShotAbilityTags('ZERO_PROTOCOL' as HexShotAbilityId);
  }
  if (abilityId === 'CATACLYSM_SIGIL') {
    return getEnvoyAbilityTags('CATACLYSM_SIGIL' as EnvoyAbilityId);
  }

  if (classId === 'AEGIS') {
    try {
      return getAbilityTags(abilityId as AegisAbilityId);
    } catch {
      return [];
    }
  }
  if (classId === 'HEX_SHOT') {
    return getHexShotAbilityTags(abilityId as HexShotAbilityId);
  }
  if (classId === 'ENVOY') {
    return getEnvoyAbilityTags(abilityId as EnvoyAbilityId);
  }
  return [];
}

export function weaponUltimateActionHasUltimateTag(
  abilityId: string | null | undefined,
  classId?: ClassType,
): boolean {
  return resolveWeaponUltimateActionTags(abilityId, classId).includes('ULTIMATE');
}

/** Accessibility / ping label from equipped weapon. */
export function formatWeaponUltimatePingAccessibilityLabel(
  familyId: WeaponFamilyId | null | undefined,
): string {
  const name = resolveWeaponUltimateDisplayName(familyId);
  return name ? `Fire ${name}` : 'Fire weapon ultimate';
}

export function listRetiredUltimatePlayerFacingStrings(): readonly string[] {
  return [
    'EVISCERATE',
    'Cataclysm Sigil',
    'CATACLYSM SIGIL',
    'ZERO-PROTOCOL',
    'The Black Door',
  ] as const;
}

export function assertNoRetiredUltimatePlayerFacing(text: string): string[] {
  const issues: string[] = [];
  for (const retired of listRetiredUltimatePlayerFacingStrings()) {
    if (text.includes(retired)) {
      issues.push(`retired ultimate string "${retired}" in "${text}"`);
    }
  }
  return issues;
}

export type { WeaponUltimateId };
