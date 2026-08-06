import {
  ENVOY_ANCHOR,
  getAssignableHexShotAbilities,
  HEX_SHOT_ANCHOR,
  HEX_SHOT_INTRINSIC,
  isHexShotDeprecatedAbility,
  sanitizeEnvoyCombatLoadout,
  sanitizeHexFlexLoadout,
  validateHexFlexLoadoutCommit,
} from '../data/classAbilityUnlockEngine';
import {
  isEnvoyProcUltimate,
  isHexShotProcUltimate,
} from '../data/combatMasteryEngine';
import type { EnvoyLoadout, HexFlexLoadout, HexShotAbilityId, HexShotLoadout } from '../types/operativeClass';

export function normalizeHexShotLoadoutForCommit(input: readonly string[]): HexShotLoadout {
  return sanitizeHexFlexLoadout(input);
}

export function normalizeEnvoyLoadoutForCommit(input: readonly string[]): EnvoyLoadout {
  return sanitizeEnvoyCombatLoadout(input as EnvoyLoadout);
}

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
  if (loadout.length !== 4) return '>> LOADOUT REJECTED — FOUR SLOTS REQUIRED.';
  if (loadout[0] !== ENVOY_ANCHOR) {
    return '>> LOADOUT REJECTED — SLOT 1 MUST REMAIN VEIL-SPLINTER.';
  }
  const flex = loadout.slice(1);
  if (flex.some((id) => isEnvoyProcUltimate(id))) {
    return '>> LOADOUT REJECTED — NULL CIRCUIT is a weapon ultimate, not a deck slot.';
  }
  if (new Set(flex).size < flex.length) {
    return '>> LOADOUT REJECTED — DUPLICATE ABILITY SLOTS DETECTED.';
  }
  if (unlocked) {
    const locked = flex.find((id) => !unlocked.includes(id));
    if (locked) {
      return `>> LOADOUT REJECTED — ${locked.replace(/_/g, ' ')} NOT UNLOCKED.`;
    }
  }
  return null;
}

export type { HexFlexLoadout, HexShotAbilityId };
