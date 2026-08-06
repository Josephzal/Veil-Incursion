/**
 * Aegis loadout helpers — technique loadout + Phase C combat surface.
 */
import {
  DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  type AegisAbilityId,
  type AegisTechniqueId,
  type AegisTechniqueLoadout,
} from '../types/aegisCombat';
import {
  hydrateAegisTechniqueLoadout,
  migrateAegisTechniqueLoadout,
  sanitizeAegisTechniqueLoadout,
  validateAegisTechniqueLoadoutCommit,
} from '../data/aegisMigration';
import { buildAegisCombatSurface } from '../data/aegisCombatCompatibility';
import { isAegisTechniqueId, listAegisTechniques } from '../data/aegisTechniqueCatalog';

/**
 * @deprecated Phase A phantom STRIKE slot — no longer part of the combat HUD.
 */
export const AEGIS_ANCHOR: AegisAbilityId = 'STRIKE';

export {
  hydrateAegisTechniqueLoadout,
  migrateAegisTechniqueLoadout,
  sanitizeAegisTechniqueLoadout,
  validateAegisTechniqueLoadoutCommit,
  buildAegisCombatSurface,
};

export function normalizeAegisTechniqueLoadout(input: unknown): AegisTechniqueLoadout {
  return sanitizeAegisTechniqueLoadout(input);
}

/**
 * @deprecated Prefer normalizeAegisTechniqueLoadout.
 * Returns the sanitized three-technique loadout (no STRIKE pad).
 */
export function normalizeAegisLoadout(input: unknown): AegisTechniqueLoadout {
  return migrateAegisTechniqueLoadout(input);
}

/**
 * @deprecated Prefer sanitizeAegisTechniqueLoadout.
 */
export function sanitizeAegisCombatLoadout(
  loadout: readonly AegisAbilityId[],
): AegisTechniqueLoadout {
  return migrateAegisTechniqueLoadout(loadout);
}

export function hasDuplicateTechniqueSlots(loadout: readonly string[]): boolean {
  return new Set(loadout).size < loadout.length;
}

/** @deprecated Prefer validateAegisTechniqueLoadoutCommit. */
export function hasDuplicateLoadoutSlots(loadout: readonly AegisAbilityId[]): boolean {
  return hasDuplicateTechniqueSlots(loadout);
}

/**
 * Validate a three-technique commit. Ignores unlock economy (all techniques free).
 * @deprecated unlocked arg ignored — retained for call-site compatibility.
 */
export function validateLoadoutCommit(
  loadout: readonly string[],
  _unlocked?: readonly string[],
): string | null {
  if (loadout.length === 4) {
    const techniques = migrateAegisTechniqueLoadout(loadout);
    return validateAegisTechniqueLoadoutCommit(techniques);
  }
  return validateAegisTechniqueLoadoutCommit(loadout);
}

/** All twelve techniques — assignable without unlock economy. */
export function getAegisFlexAbilities(): AegisTechniqueId[] {
  return [...listAegisTechniques()];
}

export function getDefaultAegisTechniqueLoadout(): AegisTechniqueLoadout {
  return [...DEFAULT_AEGIS_TECHNIQUE_LOADOUT];
}

export function assertIsTechniqueOnlyLoadout(loadout: readonly string[]): boolean {
  return loadout.length === 3 && loadout.every((id) => isAegisTechniqueId(id));
}
