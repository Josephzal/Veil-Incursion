import {
  ENVOY_ANCHOR,
  HEX_SHOT_ANCHOR,
} from '../data/classAbilityUnlockEngine';
import type { EnvoyLoadout, HexShotLoadout } from '../types/operativeClass';
import {
  DEFAULT_ENVOY_LOADOUT,
  DEFAULT_HEX_SHOT_LOADOUT,
} from '../types/operativeClass';

export function normalizeHexShotLoadoutForCommit(input: readonly string[]): HexShotLoadout {
  if (input.length !== 4 || input[0] !== HEX_SHOT_ANCHOR) {
    return [...DEFAULT_HEX_SHOT_LOADOUT];
  }
  return [input[0], input[1], input[2], input[3]] as HexShotLoadout;
}

export function normalizeEnvoyLoadoutForCommit(input: readonly string[]): EnvoyLoadout {
  if (input.length !== 4 || input[0] !== ENVOY_ANCHOR) {
    return [...DEFAULT_ENVOY_LOADOUT];
  }
  return [input[0], input[1], input[2], input[3]] as EnvoyLoadout;
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
