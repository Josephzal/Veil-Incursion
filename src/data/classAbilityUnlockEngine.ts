import type { AbilityUnlockCost } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import {
  DEFAULT_ENVOY_LOADOUT,
  DEFAULT_HEX_SHOT_LOADOUT,
} from '../types/operativeClass';
import { ENVOY_ABILITY_CATALOG } from './envoyAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import {
  canAffordAbilityUnlock,
  deductAbilityUnlockCost,
  formatAbilityUnlockCost,
  isUnlockCostEmpty,
} from './aegisAbilityUnlockEngine';

export {
  canAffordAbilityUnlock,
  deductAbilityUnlockCost,
  formatAbilityUnlockCost,
  isUnlockCostEmpty,
};

export const HEX_SHOT_ANCHOR: HexShotAbilityId = 'SILVER_CORE_SIDEARM';
export const ENVOY_ANCHOR: EnvoyAbilityId = 'VEIL_SPLINTER';

/** Not assignable to loadout slots — intrinsic class features. */
export const HEX_SHOT_INTRINSIC: readonly HexShotAbilityId[] = ['PHASE_SHIFT_RELOAD'];
export const ENVOY_INTRINSIC: readonly EnvoyAbilityId[] = ['RIFT_WARD'];

export function getAssignableHexShotAbilities(): HexShotAbilityId[] {
  return (Object.keys(HEX_SHOT_ABILITY_CATALOG) as HexShotAbilityId[]).filter(
    (id) => !HEX_SHOT_INTRINSIC.includes(id) && id !== HEX_SHOT_ANCHOR,
  );
}

export function getAssignableEnvoyAbilities(): EnvoyAbilityId[] {
  return (Object.keys(ENVOY_ABILITY_CATALOG) as EnvoyAbilityId[]).filter(
    (id) => !ENVOY_INTRINSIC.includes(id) && id !== ENVOY_ANCHOR,
  );
}

export function isHexShotAbilityUnlocked(
  unlocked: readonly HexShotAbilityId[],
  abilityId: HexShotAbilityId,
): boolean {
  if (abilityId === HEX_SHOT_ANCHOR || HEX_SHOT_INTRINSIC.includes(abilityId)) return true;
  return unlocked.includes(abilityId);
}

export function isEnvoyAbilityUnlocked(
  unlocked: readonly EnvoyAbilityId[],
  abilityId: EnvoyAbilityId,
): boolean {
  if (abilityId === ENVOY_ANCHOR || ENVOY_INTRINSIC.includes(abilityId)) return true;
  return unlocked.includes(abilityId);
}

export function formatHexShotAbilityTags(abilityId: HexShotAbilityId): string {
  return HEX_SHOT_ABILITY_CATALOG[abilityId].tags.join(' · ');
}

export function formatEnvoyAbilityTags(abilityId: EnvoyAbilityId): string {
  return ENVOY_ABILITY_CATALOG[abilityId].tags.join(' · ');
}

export function getHexShotUnlockCost(abilityId: HexShotAbilityId): AbilityUnlockCost {
  return HEX_SHOT_ABILITY_CATALOG[abilityId].unlockCost;
}

export function getEnvoyUnlockCost(abilityId: EnvoyAbilityId): AbilityUnlockCost {
  return ENVOY_ABILITY_CATALOG[abilityId].unlockCost;
}

export function normalizeUnlockedHexShotAbilities(
  stored: readonly HexShotAbilityId[] | undefined,
  loadout: readonly HexShotAbilityId[],
): HexShotAbilityId[] {
  const set = new Set<HexShotAbilityId>([
    HEX_SHOT_ANCHOR,
    ...DEFAULT_HEX_SHOT_LOADOUT,
    ...HEX_SHOT_INTRINSIC,
  ]);
  stored?.forEach((id) => set.add(id));
  loadout.forEach((id) => set.add(id));
  return [...set];
}

export function normalizeUnlockedEnvoyAbilities(
  stored: readonly EnvoyAbilityId[] | undefined,
  loadout: readonly EnvoyAbilityId[],
): EnvoyAbilityId[] {
  const set = new Set<EnvoyAbilityId>([
    ENVOY_ANCHOR,
    ...DEFAULT_ENVOY_LOADOUT,
    ...ENVOY_INTRINSIC,
  ]);
  stored?.forEach((id) => set.add(id));
  loadout.forEach((id) => set.add(id));
  return [...set];
}
