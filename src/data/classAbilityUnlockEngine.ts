import type { AbilityUnlockCost } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import {
  DEFAULT_ENVOY_LOADOUT,
  DEFAULT_HEX_SHOT_LOADOUT,
  type EnvoyLoadout,
  type HexShotLoadout,
} from '../types/operativeClass';
import {
  ENVOY_PROC_ULTIMATES,
  HEX_SHOT_PROC_ULTIMATES,
  isEnvoyProcUltimate,
  isHexShotProcUltimate,
} from './combatMasteryEngine';
import { ENVOY_ABILITY_CATALOG } from './envoyAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { migrateHexShotAbilityId } from './hexShotMigration';
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

/** Not assignable to loadout slots — intrinsic class features (see hexShotIntrinsics for Phantom Feed). */
export const HEX_SHOT_INTRINSIC: readonly HexShotAbilityId[] = [
  'PHASE_SHIFT_RELOAD',
  ...HEX_SHOT_PROC_ULTIMATES,
];
export const ENVOY_INTRINSIC: readonly EnvoyAbilityId[] = [
  'RIFT_WARD',
  ...ENVOY_PROC_ULTIMATES,
];

export function getAssignableHexShotAbilities(): HexShotAbilityId[] {
  return (Object.keys(HEX_SHOT_ABILITY_CATALOG) as HexShotAbilityId[]).filter(
    (id) => !HEX_SHOT_INTRINSIC.includes(id)
      && id !== HEX_SHOT_ANCHOR
      && !isHexShotProcUltimate(id),
  );
}

export function getAssignableEnvoyAbilities(): EnvoyAbilityId[] {
  return (Object.keys(ENVOY_ABILITY_CATALOG) as EnvoyAbilityId[]).filter(
    (id) => !ENVOY_INTRINSIC.includes(id)
      && id !== ENVOY_ANCHOR
      && !isEnvoyProcUltimate(id),
  );
}

export function sanitizeHexShotCombatLoadout(loadout: readonly HexShotAbilityId[]): HexShotLoadout {
  const migrated = loadout.map((id) => migrateHexShotAbilityId(id));
  if (migrated.length !== 4 || migrated[0] !== HEX_SHOT_ANCHOR) {
    return [...DEFAULT_HEX_SHOT_LOADOUT];
  }
  const used = new Set<string>([migrated[0]]);
  const flex = migrated.slice(1).map((id) => {
    if (!isHexShotProcUltimate(id)) {
      used.add(id);
      return id;
    }
    const replacement = DEFAULT_HEX_SHOT_LOADOUT.slice(1).find((d) => !used.has(d))
      ?? getAssignableHexShotAbilities().find((d) => !used.has(d))
      ?? 'RIFT_SNARE';
    used.add(replacement);
    return replacement;
  });
  return [migrated[0], flex[0], flex[1], flex[2]] as HexShotLoadout;
}

export function sanitizeEnvoyCombatLoadout(loadout: readonly EnvoyAbilityId[]): EnvoyLoadout {
  if (loadout.length !== 4 || loadout[0] !== ENVOY_ANCHOR) {
    return [...DEFAULT_ENVOY_LOADOUT];
  }
  const used = new Set<string>([loadout[0]]);
  const flex = loadout.slice(1).map((id) => {
    if (!isEnvoyProcUltimate(id)) {
      used.add(id);
      return id;
    }
    const replacement = DEFAULT_ENVOY_LOADOUT.slice(1).find((d) => !used.has(d))
      ?? getAssignableEnvoyAbilities().find((d) => !used.has(d))
      ?? 'ASTRAL_LANCE';
    used.add(replacement);
    return replacement;
  });
  return [loadout[0], flex[0], flex[1], flex[2]] as EnvoyLoadout;
}

export function isHexShotAbilityUnlocked(
  unlocked: readonly HexShotAbilityId[],
  abilityId: HexShotAbilityId,
): boolean {
  const resolved = migrateHexShotAbilityId(abilityId);
  if (resolved === HEX_SHOT_ANCHOR || HEX_SHOT_INTRINSIC.includes(resolved)) return true;
  return unlocked.some((id) => migrateHexShotAbilityId(id) === resolved);
}

export function isEnvoyAbilityUnlocked(
  unlocked: readonly EnvoyAbilityId[],
  abilityId: EnvoyAbilityId,
): boolean {
  if (abilityId === ENVOY_ANCHOR || ENVOY_INTRINSIC.includes(abilityId)) return true;
  return unlocked.includes(abilityId);
}

export function formatHexShotAbilityTags(abilityId: HexShotAbilityId): string {
  return HEX_SHOT_ABILITY_CATALOG[migrateHexShotAbilityId(abilityId)].tags.join(' · ');
}

export function formatEnvoyAbilityTags(abilityId: EnvoyAbilityId): string {
  return ENVOY_ABILITY_CATALOG[abilityId].tags.join(' · ');
}

export function getHexShotUnlockCost(abilityId: HexShotAbilityId): AbilityUnlockCost {
  return HEX_SHOT_ABILITY_CATALOG[migrateHexShotAbilityId(abilityId)].unlockCost;
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
  stored?.forEach((id) => set.add(migrateHexShotAbilityId(id)));
  loadout.forEach((id) => set.add(migrateHexShotAbilityId(id)));
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
