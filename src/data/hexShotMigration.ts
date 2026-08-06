import type { HexShotAbilityId } from '../types/operativeClass';
import type { HexShotGraftId } from '../types/classGraft';

/** Legacy save ids → canonical ability ids. */
const LEGACY_HEX_SHOT_ABILITY_IDS: Record<string, HexShotAbilityId> = {
  BRIMSTONE_PAYLOAD: 'BLEEDING_PAYLOAD',
};

export function migrateHexShotAbilityId(id: string): HexShotAbilityId {
  return (LEGACY_HEX_SHOT_ABILITY_IDS[id] ?? id) as HexShotAbilityId;
}

/**
 * Ammo-type refactor v1 — standalone ammo-identity abilities are superseded by the
 * magazine ammo-type system. Existing saves that have them equipped are migrated to
 * the closest shot-pattern / tactical replacement so they no longer compete with the
 * ammo-type selection. The legacy ids remain valid in the catalog/executor so nothing
 * crashes if they surface elsewhere.
 */
const DEPRECATED_HEX_SHOT_LOADOUT_REPLACEMENTS: Partial<Record<HexShotAbilityId, HexShotAbilityId>> = {
  WRAITH_PIERCER_ROUND: 'SINGULARITY_SLUG',
  BLOOD_TRACER_ROUND: 'REVENANTS_ECHO',
  STASIS_LOCK_SLUG: 'PANOPTICON_PROTOCOL',
  BLEEDING_PAYLOAD: 'RIFT_SNARE',
};

/** Replace a deprecated ammo-identity ability id with its v1 loadout replacement. */
export function migrateDeprecatedHexShotLoadoutId(id: HexShotAbilityId): HexShotAbilityId {
  return DEPRECATED_HEX_SHOT_LOADOUT_REPLACEMENTS[id] ?? id;
}

export function migrateHexShotAbilityList(ids: readonly string[]): HexShotAbilityId[] {
  return ids.map((id) => migrateHexShotAbilityId(id));
}

/** Resolve graft bindings after ability id renames (e.g. saved incursion maps). */
export function resolveHexShotAbilityGraftId(
  grafts: Partial<Record<string, HexShotGraftId>>,
  abilityId: HexShotAbilityId | string,
): HexShotGraftId | undefined {
  const raw = String(abilityId);
  // W.2–W.4 — live fixed-basics map to historical SILVER_CORE_SIDEARM graft signatures.
  if (raw === 'QUICKDRAW' || raw === 'CENTER_MASS' || raw === 'DOOR_KNOCKER') {
    if (grafts[raw as 'QUICKDRAW' | 'CENTER_MASS' | 'DOOR_KNOCKER']) {
      return grafts[raw as 'QUICKDRAW' | 'CENTER_MASS' | 'DOOR_KNOCKER'];
    }
    if (grafts.SILVER_CORE_SIDEARM) return grafts.SILVER_CORE_SIDEARM;
  }
  const resolved = migrateHexShotAbilityId(raw as HexShotAbilityId);
  if (grafts[resolved]) return grafts[resolved];
  if (resolved === 'BLEEDING_PAYLOAD' && grafts.BRIMSTONE_PAYLOAD) {
    return grafts.BRIMSTONE_PAYLOAD;
  }
  return undefined;
}
