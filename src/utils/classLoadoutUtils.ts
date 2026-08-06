import {
  ENVOY_ANCHOR,
  getAssignableHexShotAbilities,
  HEX_SHOT_ANCHOR,
  HEX_SHOT_INTRINSIC,
  isHexShotDeprecatedAbility,
  sanitizeEnvoyCombatLoadout,
  sanitizeEnvoyFlexLoadout,
  sanitizeHexFlexLoadout,
  validateEnvoyFlexLoadoutCommit,
  validateHexFlexLoadoutCommit,
} from '../data/classAbilityUnlockEngine';
import {
  isEnvoyProcUltimate,
  isHexShotProcUltimate,
} from '../data/combatMasteryEngine';
import type {
  EnvoyFlexLoadout,
  EnvoyLoadout,
  HexFlexLoadout,
  HexShotAbilityId,
  HexShotLoadout,
} from '../types/operativeClass';

export function normalizeHexShotLoadoutForCommit(input: readonly string[]): HexShotLoadout {
  return sanitizeHexFlexLoadout(input);
}

/** E.5 — Sanctuary / account commit normalizes to canonical three-flex. */
export function normalizeEnvoyLoadoutForCommit(input: readonly string[]): EnvoyLoadout {
  return sanitizeEnvoyCombatLoadout(input);
}

/** Canonical three-flex normalize (structural / migration). */
export function normalizeEnvoyFlexLoadoutForCommit(input: readonly string[]): EnvoyFlexLoadout {
  return sanitizeEnvoyFlexLoadout(input);
}

export { validateEnvoyFlexLoadoutCommit };

export function validateHexShotLoadoutCommit(
  loadout: readonly string[],
  unlocked?: readonly string[],
): string | null {
  // Accept legacy 4-slot drafts during UI transition — validate the extracted flex triple.
  if (loadout.length === 4 && loadout[0] === HEX_SHOT_ANCHOR) {
    return validateHexFlexLoadoutCommit(loadout.slice(1), unlocked);
  }
  if (loadout.length === 3) {
    return validateHexFlexLoadoutCommit(loadout, unlocked);
  }
  return '>> LOADOUT REJECTED — THREE FLEX SLOTS REQUIRED.';
}

export function validateEnvoyLoadoutCommit(
  loadout: readonly string[],
  unlocked?: readonly string[],
): string | null {
  // Accept legacy 4-slot drafts — validate the extracted flex triple.
  if (loadout.length === 4 && (
    loadout[0] === ENVOY_ANCHOR
    || loadout[0] === 'VEIL_SPLINTER'
    || loadout[0] === 'BLACK_WICK'
    || loadout[0] === 'GRAVEWEAVE'
    || loadout[0] === 'NULL_ARC'
    || loadout[0] === 'BLOOD_REFRACTION'
  )) {
    return validateEnvoyFlexLoadoutCommit(loadout.slice(1), unlocked);
  }
  if (loadout.length === 3) {
    return validateEnvoyFlexLoadoutCommit(loadout, unlocked);
  }
  return '>> LOADOUT REJECTED — THREE FLEX SLOTS REQUIRED.';
}

export type { HexFlexLoadout, HexShotAbilityId };
