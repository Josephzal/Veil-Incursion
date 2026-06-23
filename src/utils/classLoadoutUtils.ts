import {
  ENVOY_ANCHOR,
  HEX_SHOT_ANCHOR,
  sanitizeEnvoyCombatLoadout,
  sanitizeHexShotCombatLoadout,
} from '../data/classAbilityUnlockEngine';
import {
  isEnvoyProcUltimate,
  isHexShotProcUltimate,
} from '../data/combatMasteryEngine';
import type { EnvoyLoadout, HexShotLoadout } from '../types/operativeClass';

export function normalizeHexShotLoadoutForCommit(input: readonly string[]): HexShotLoadout {
  return sanitizeHexShotCombatLoadout(input as HexShotLoadout);
}

export function normalizeEnvoyLoadoutForCommit(input: readonly string[]): EnvoyLoadout {
  return sanitizeEnvoyCombatLoadout(input as EnvoyLoadout);
}

export function validateHexShotLoadoutCommit(
  loadout: readonly string[],
  unlocked?: readonly string[],
): string | null {
  if (loadout.length !== 4) return '>> LOADOUT REJECTED — FOUR SLOTS REQUIRED.';
  if (loadout[0] !== HEX_SHOT_ANCHOR) {
    return '>> LOADOUT REJECTED — SLOT 1 MUST REMAIN SILVER-CORE SIDEARM.';
  }
  const flex = loadout.slice(1);
  if (flex.some((id) => isHexShotProcUltimate(id))) {
    return '>> LOADOUT REJECTED — ZERO-PROTOCOL is a mastery proc, not a deck slot.';
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
    return '>> LOADOUT REJECTED — CATACLYSM SIGIL is a mastery proc, not a deck slot.';
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
