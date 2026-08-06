/**
 * Aegis Phase A migration — legacy four-slot decks → three techniques.
 * Follows the Hex/Envoy migration module pattern.
 */
import {
  DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  type AegisTechniqueId,
  type AegisTechniqueLoadout,
} from '../types/aegisCombat';
import { isAegisBrandTechnique, isAegisTechniqueId } from './aegisTechniqueCatalog';
import { isAegisWeaponActionId, isAegisWeaponUltimateId } from './aegisWeaponActionRegistry';

/** Legacy catalog ids that map onto the Phase A technique pool. */
const LEGACY_TECHNIQUE_ID_MAP: Record<string, AegisTechniqueId> = {
  BLOOD_BOUND_CARAPACE: 'RUNEBOUND_CARAPACE',
};

/** IDs that must never enter the technique loadout. */
const REJECTED_LOADOUT_IDS = new Set<string>([
  'STRIKE',
  'WRAITH_PARRY',
  'EVISCERATE',
  'BLOOD_TITHE',
  'ABYSSAL_FAULT',
  'THREEFOLD_BRAND',
  'ABYSSAL_VERDICT',
  'REND_THE_VEIL',
  'GRAVEFALL',
]);

export function migrateLegacyAegisTechniqueId(raw: string): AegisTechniqueId | null {
  if (REJECTED_LOADOUT_IDS.has(raw)) return null;
  if (isAegisWeaponActionId(raw) || isAegisWeaponUltimateId(raw)) return null;
  if (raw === 'WRAITH_PARRY') return null;
  const mapped = LEGACY_TECHNIQUE_ID_MAP[raw] ?? raw;
  return isAegisTechniqueId(mapped) ? mapped : null;
}

function padFromDefaults(
  selected: AegisTechniqueId[],
  used: Set<AegisTechniqueId>,
): AegisTechniqueId[] {
  const next = [...selected];
  for (const id of DEFAULT_AEGIS_TECHNIQUE_LOADOUT) {
    if (next.length >= 3) break;
    if (used.has(id)) continue;
    used.add(id);
    next.push(id);
  }
  for (const id of [
    'RUIN',
    'GRAVE_BIND',
    'RUNEBOUND_CARAPACE',
    'VEIL_PIERCER',
    'ASHEN_MANTLE',
    'SHADOW_STEP',
    'NAIL_TO_GRID',
    'REAVE',
    'DEVASTATE',
    'DEMONS_LUNG',
    'CRIMSON_PACT',
    'FINAL_MERCY',
  ] as const satisfies readonly AegisTechniqueId[]) {
    if (next.length >= 3) break;
    if (used.has(id)) continue;
    used.add(id);
    next.push(id);
  }
  return next;
}

function ensureBrandTechnique(loadout: AegisTechniqueId[]): AegisTechniqueLoadout {
  if (loadout.some((id) => isAegisBrandTechnique(id))) {
    return [loadout[0]!, loadout[1]!, loadout[2]!];
  }
  // Replace the last position with RUIN (or first free Brand if RUIN already present — shouldn't be).
  const used = new Set(loadout.slice(0, 2));
  const brand: AegisTechniqueId = used.has('RUIN') ? 'VEIL_PIERCER' : 'RUIN';
  return [loadout[0]!, loadout[1]!, brand];
}

/**
 * Migrate a legacy four-slot (or messy) Aegis loadout into exactly three techniques.
 *
 * Rules:
 * - Discard slot 0 STRIKE (and any STRIKE occurrence).
 * - Preserve valid unique techniques from remaining slots in order.
 * - Map BLOOD_BOUND_CARAPACE → RUNEBOUND_CARAPACE.
 * - Drop BLOOD_TITHE, ABYSSAL_FAULT, WRAITH_PARRY, EVISCERATE, unknowns, duplicates.
 * - Pad from default; enforce ≥1 Brand technique.
 */
export function migrateAegisTechniqueLoadout(input: unknown): AegisTechniqueLoadout {
  if (!Array.isArray(input) || input.length === 0) {
    return [...DEFAULT_AEGIS_TECHNIQUE_LOADOUT];
  }

  const used = new Set<AegisTechniqueId>();
  const selected: AegisTechniqueId[] = [];

  // Prefer slots 1–3 when a classic 4-slot shape is present; still scan all for safety.
  const ordered = input.length >= 4
    ? [...input.slice(1), input[0]]
    : [...input];

  for (const raw of ordered) {
    if (typeof raw !== 'string') continue;
    if (raw === 'STRIKE') continue;
    const migrated = migrateLegacyAegisTechniqueId(raw);
    if (!migrated || used.has(migrated)) continue;
    used.add(migrated);
    selected.push(migrated);
    if (selected.length >= 3) break;
  }

  const padded = padFromDefaults(selected, used);
  return ensureBrandTechnique(padded.slice(0, 3));
}

/**
 * Sanitize / validate an already-migrated technique loadout.
 * Rejects weapon actions, Wraith Parry, ultimates, and non-techniques.
 */
export function sanitizeAegisTechniqueLoadout(input: unknown): AegisTechniqueLoadout {
  return migrateAegisTechniqueLoadout(input);
}

export function validateAegisTechniqueLoadoutCommit(
  loadout: readonly string[],
): string | null {
  if (loadout.length !== 3) {
    return '>> LOADOUT REJECTED — THREE TECHNIQUES REQUIRED.';
  }
  const seen = new Set<string>();
  for (const id of loadout) {
    if (isAegisWeaponActionId(id) || isAegisWeaponUltimateId(id) || id === 'WRAITH_PARRY') {
      return '>> LOADOUT REJECTED — WEAPON ACTIONS, PARRY, AND ULTIMATES ARE NOT TECHNIQUE SLOTS.';
    }
    if (id === 'STRIKE' || id === 'EVISCERATE' || id === 'BLOOD_TITHE' || id === 'ABYSSAL_FAULT') {
      return '>> LOADOUT REJECTED — RETIRED OR NON-TECHNIQUE ID IN SLOT.';
    }
    if (!isAegisTechniqueId(id)) {
      return '>> LOADOUT REJECTED — UNKNOWN TECHNIQUE.';
    }
    if (seen.has(id)) {
      return '>> LOADOUT REJECTED — DUPLICATE TECHNIQUE SLOTS DETECTED.';
    }
    seen.add(id);
  }
  if (![...seen].some((id) => isAegisBrandTechnique(id as AegisTechniqueId))) {
    return '>> LOADOUT REJECTED — AT LEAST ONE BRAND TECHNIQUE REQUIRED.';
  }
  return null;
}

/**
 * Hydrate run/account technique field from either the new key or legacy `aegisLoadout`.
 */
export function hydrateAegisTechniqueLoadout(source: {
  aegisTechniqueLoadout?: unknown;
  aegisLoadout?: unknown;
}): AegisTechniqueLoadout {
  if (source.aegisTechniqueLoadout != null) {
    return sanitizeAegisTechniqueLoadout(source.aegisTechniqueLoadout);
  }
  if (source.aegisLoadout != null) {
    return migrateAegisTechniqueLoadout(source.aegisLoadout);
  }
  return [...DEFAULT_AEGIS_TECHNIQUE_LOADOUT];
}
