import type { ClassType, PlayerAccount } from '../types/game';
import type { AegisAbilityId, AegisTechniqueLoadout } from '../types/aegisCombat';
import type { WeaponFamilyId } from '../types/weapon';
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
import { DEFAULT_AEGIS_TECHNIQUE_LOADOUT } from '../types/aegisCombat';
import { normalizeUnlockedAegisAbilities } from './aegisAbilityUnlockEngine';
import { hydrateAegisTechniqueLoadout } from '../utils/aegisLoadoutUtils';
import { getEnvoyAbilityDefinition } from './envoyAbilities';
import { getHexShotAbilityDefinition } from './hexShotAbilities';
import {
  formatHexWeaponActionLabel,
  isDefinedHexWeaponActionId,
} from './hexWeaponActionCatalog';
import { getAbilityDefinition } from './aegisAbilities';
import { getAegisTechniqueDefinition, isAegisTechniqueId } from './aegisTechniqueCatalog';
import { CLASS_DEFINITIONS } from './classes';
import {
  normalizeUnlockedEnvoyAbilities,
  normalizeUnlockedHexShotAbilities,
  sanitizeHexShotCombatLoadout,
} from './classAbilityUnlockEngine';
import { migrateHexShotAbilityId } from './hexShotMigration';
import { migrateEnvoyAbilityId } from './envoyMigration';
import { sanitizeEnvoyCombatLoadout } from './classAbilityUnlockEngine';
import { resolveWeaponAnchorForAbility } from './weaponAnchorAttackRegistry';
import {
  formatAegisWeaponActionLabel,
  isAegisWeaponActionCatalogId,
} from './aegisWeaponActionCatalog';
import { buildAegisCombatSurface } from './aegisCombatCompatibility';

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
  if (!loadout?.length) return [...DEFAULT_HEX_SHOT_LOADOUT];
  return sanitizeHexShotCombatLoadout(loadout.map((id) => migrateHexShotAbilityId(id)));
}

function normalizeEnvoyLoadout(loadout: readonly string[] | undefined): EnvoyLoadout {
  if (!loadout?.length) return [...DEFAULT_ENVOY_LOADOUT] as EnvoyLoadout;
  return sanitizeEnvoyCombatLoadout(loadout.map((id) => migrateEnvoyAbilityId(id)));
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
    default: {
      const techniques = hydrateAegisTechniqueLoadout({
        aegisTechniqueLoadout: account.aegisTechniqueLoadout,
      });
      return {
        classId: 'AEGIS',
        loadout: techniques,
        unlocked: normalizeUnlockedAegisAbilities(account.unlockedAegisAbilities, techniques),
      };
    }
  }
}

export function getActiveClassLoadoutForRun(
  account: PlayerAccount,
  weaponFamilyId?: WeaponFamilyId | null,
): readonly string[] {
  const snapshot = getActiveClassSnapshot(account);
  if (snapshot.classId === 'AEGIS') {
    // Phase B: 4 derived weapon actions + 3 snapshotted techniques (not persisted).
    // Account has no equipped family — callers should pass the run snapshot family.
    return buildAegisCombatSurface({
      weaponFamilyId: weaponFamilyId ?? 'aegis-runed-longsword',
      techniques: snapshot.loadout,
    }).hudCards;
  }
  return snapshot.loadout;
}

export function formatAbilityLabel(
  classId: ClassType,
  abilityId: string,
  equippedWeaponFamilyId?: WeaponFamilyId | null,
  opts?: { doomfallReleaseAvailable?: boolean },
): string {
  if (classId === 'AEGIS' && isAegisWeaponActionCatalogId(abilityId)) {
    return formatAegisWeaponActionLabel(abilityId, opts);
  }
  const anchor = resolveWeaponAnchorForAbility(abilityId, equippedWeaponFamilyId, classId);
  if (anchor) {
    return `[ ${anchor.displayName} ]`;
  }
  if (classId === 'HEX_SHOT') {
    const waLabel = formatHexWeaponActionLabel(abilityId);
    if (isDefinedHexWeaponActionId(abilityId)) return waLabel;
    return getHexShotAbilityDefinition(abilityId as HexShotAbilityId).label;
  }
  if (classId === 'ENVOY') {
    return getEnvoyAbilityDefinition(abilityId as EnvoyAbilityId).label;
  }
  if (isAegisTechniqueId(abilityId)) {
    return getAegisTechniqueDefinition(abilityId).label;
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

export function normalizeClassAccountFields(parsed: Partial<PlayerAccount> & {
  /** Legacy four-slot field from older saves. */
  aegisLoadout?: unknown;
}): Pick<
  PlayerAccount,
  | 'activeClass'
  | 'unlockedClasses'
  | 'aegisTechniqueLoadout'
  | 'unlockedAegisAbilities'
  | 'hexShotLoadout'
  | 'unlockedHexShotAbilities'
  | 'envoyLoadout'
  | 'unlockedEnvoyAbilities'
> {
  const activeClass = migrateClassType(parsed.activeClass);
  const unlockedClasses = migrateUnlockedClasses(parsed.unlockedClasses);
  const aegisTechniqueLoadout = hydrateAegisTechniqueLoadout({
    aegisTechniqueLoadout: parsed.aegisTechniqueLoadout,
    aegisLoadout: (parsed as { aegisLoadout?: unknown }).aegisLoadout,
  });
  const hexShotLoadout = normalizeHexShotLoadout(parsed.hexShotLoadout);
  const envoyLoadout = normalizeEnvoyLoadout(parsed.envoyLoadout);
  return {
    activeClass,
    unlockedClasses: unlockedClasses.length > 0
      ? [...new Set([...unlockedClasses, ...ALL_OPERATIVE_CLASSES])] as ClassType[]
      : [...ALL_OPERATIVE_CLASSES],
    aegisTechniqueLoadout,
    unlockedAegisAbilities: normalizeUnlockedAegisAbilities(
      parsed.unlockedAegisAbilities,
      aegisTechniqueLoadout,
    ),
    hexShotLoadout,
    unlockedHexShotAbilities: normalizeUnlockedHexShotAbilities(parsed.unlockedHexShotAbilities, hexShotLoadout),
    envoyLoadout,
    unlockedEnvoyAbilities: normalizeUnlockedEnvoyAbilities(parsed.unlockedEnvoyAbilities, envoyLoadout),
  };
}

/** @deprecated Prefer account.aegisTechniqueLoadout */
export type { AegisTechniqueLoadout };
export { DEFAULT_AEGIS_TECHNIQUE_LOADOUT };
