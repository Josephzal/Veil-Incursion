import type { ClassType, PlayerAccount } from '../types/game';
import type { AegisAbilityId, AegisLoadout } from '../types/aegisCombat';
import {
  ALL_OPERATIVE_CLASSES,
  DEFAULT_ENVOY_LOADOUT,
  DEFAULT_ENVOY_UNLOCKED,
  DEFAULT_HEX_SHOT_LOADOUT,
  DEFAULT_HEX_SHOT_UNLOCKED,
  type ClassLoadoutSnapshot,
  type EnvoyAbilityId,
  type EnvoyLoadout,
  type HexShotAbilityId,
  type HexShotLoadout,
} from '../types/operativeClass';
import { DEFAULT_AEGIS_LOADOUT } from '../types/aegisCombat';
import { normalizeUnlockedAegisAbilities } from './aegisAbilityUnlockEngine';
import { normalizeAegisLoadout } from '../utils/aegisLoadoutUtils';
import { getEnvoyAbilityDefinition } from './envoyAbilities';
import { getHexShotAbilityDefinition } from './hexShotAbilities';
import { getAbilityDefinition } from './aegisAbilities';
import { CLASS_DEFINITIONS } from './classes';
import { normalizeUnlockedHexShotAbilities, normalizeUnlockedEnvoyAbilities } from './classAbilityUnlockEngine';

export function migrateClassType(classId: string | undefined): ClassType {
  if (classId === 'RIFTSHOT') return 'HEX_SHOT';
  if (classId === 'AEGIS' || classId === 'HEX_SHOT' || classId === 'ENVOY') return classId;
  return 'AEGIS';
}

export function migrateUnlockedClasses(classes: readonly string[] | undefined): ClassType[] {
  const migrated = (classes ?? ['AEGIS']).map((entry) => migrateClassType(entry));
  return [...new Set(migrated)] as ClassType[];
}

function normalizeHexShotLoadout(loadout: readonly string[] | undefined): HexShotLoadout {
  const fallback = [...DEFAULT_HEX_SHOT_LOADOUT] as HexShotLoadout;
  if (!loadout?.length) return fallback;
  return [
    (loadout[0] as HexShotAbilityId) ?? fallback[0],
    (loadout[1] as HexShotAbilityId) ?? fallback[1],
    (loadout[2] as HexShotAbilityId) ?? fallback[2],
    (loadout[3] as HexShotAbilityId) ?? fallback[3],
  ];
}

function normalizeEnvoyLoadout(loadout: readonly string[] | undefined): EnvoyLoadout {
  const fallback = [...DEFAULT_ENVOY_LOADOUT] as EnvoyLoadout;
  if (!loadout?.length) return fallback;
  return [
    (loadout[0] as EnvoyAbilityId) ?? fallback[0],
    (loadout[1] as EnvoyAbilityId) ?? fallback[1],
    (loadout[2] as EnvoyAbilityId) ?? fallback[2],
    (loadout[3] as EnvoyAbilityId) ?? fallback[3],
  ];
}

export function getClassDisplayName(classId: ClassType): string {
  return CLASS_DEFINITIONS[classId].displayName;
}

export function getActiveClassSnapshot(account: PlayerAccount): ClassLoadoutSnapshot {
  switch (account.activeClass) {
    case 'HEX_SHOT':
      return {
        classId: 'HEX_SHOT',
        loadout: normalizeHexShotLoadout(account.hexShotLoadout),
        unlocked: normalizeUnlockedHexShotAbilities(
          account.unlockedHexShotAbilities,
          normalizeHexShotLoadout(account.hexShotLoadout),
        ),
      };
    case 'ENVOY':
      return {
        classId: 'ENVOY',
        loadout: normalizeEnvoyLoadout(account.envoyLoadout),
        unlocked: normalizeUnlockedEnvoyAbilities(
          account.unlockedEnvoyAbilities,
          normalizeEnvoyLoadout(account.envoyLoadout),
        ),
      };
    default:
      return {
        classId: 'AEGIS',
        loadout: normalizeAegisLoadout(account.aegisLoadout),
        unlocked: normalizeUnlockedAegisAbilities(account.unlockedAegisAbilities, account.aegisLoadout),
      };
  }
}

export function getActiveClassLoadoutForRun(account: PlayerAccount): readonly string[] {
  return getActiveClassSnapshot(account).loadout;
}

export function formatAbilityLabel(classId: ClassType, abilityId: string): string {
  if (classId === 'HEX_SHOT') {
    return getHexShotAbilityDefinition(abilityId as HexShotAbilityId).label;
  }
  if (classId === 'ENVOY') {
    return getEnvoyAbilityDefinition(abilityId as EnvoyAbilityId).label;
  }
  return getAbilityDefinition(abilityId as AegisAbilityId).label;
}

export function cycleOperativeClass(
  activeClass: ClassType,
  unlockedClasses: readonly ClassType[],
  direction: 1 | -1,
): ClassType {
  const pool = ALL_OPERATIVE_CLASSES.filter((entry) => unlockedClasses.includes(entry));
  if (pool.length <= 1) return activeClass;
  const currentIndex = Math.max(0, pool.indexOf(activeClass));
  const nextIndex = (currentIndex + direction + pool.length) % pool.length;
  return pool[nextIndex] ?? activeClass;
}

export function normalizeClassAccountFields(parsed: Partial<PlayerAccount>): Pick<
  PlayerAccount,
  | 'activeClass'
  | 'unlockedClasses'
  | 'aegisLoadout'
  | 'unlockedAegisAbilities'
  | 'hexShotLoadout'
  | 'unlockedHexShotAbilities'
  | 'envoyLoadout'
  | 'unlockedEnvoyAbilities'
> {
  const activeClass = migrateClassType(parsed.activeClass);
  const unlockedClasses = migrateUnlockedClasses(parsed.unlockedClasses);
  const aegisLoadout = normalizeAegisLoadout(parsed.aegisLoadout);
  const hexShotLoadout = normalizeHexShotLoadout(parsed.hexShotLoadout);
  const envoyLoadout = normalizeEnvoyLoadout(parsed.envoyLoadout);
  return {
    activeClass,
    unlockedClasses: unlockedClasses.length > 0
      ? [...new Set([...unlockedClasses, ...ALL_OPERATIVE_CLASSES])] as ClassType[]
      : [...ALL_OPERATIVE_CLASSES],
    aegisLoadout,
    unlockedAegisAbilities: normalizeUnlockedAegisAbilities(parsed.unlockedAegisAbilities, aegisLoadout),
    hexShotLoadout,
    unlockedHexShotAbilities: normalizeUnlockedHexShotAbilities(parsed.unlockedHexShotAbilities, hexShotLoadout),
    envoyLoadout,
    unlockedEnvoyAbilities: normalizeUnlockedEnvoyAbilities(parsed.unlockedEnvoyAbilities, envoyLoadout),
  };
}
