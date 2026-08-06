/**
 * Hex Shot W.2 — three-flex persisted loadout + migration from legacy 4-slot decks.
 */
import type { HexShotAbilityId, HexFlexLoadout, HexShotLoadout } from '../types/operativeClass';
import {
  DEFAULT_HEX_FLEX_LOADOUT,
  DEFAULT_HEX_SHOT_LOADOUT,
} from '../types/operativeClass';
import {
  getAssignableHexShotAbilities,
  HEX_SHOT_ANCHOR,
  HEX_SHOT_INTRINSIC,
  isHexShotDeprecatedAbility,
} from './classAbilityUnlockEngine';
import { isHexShotProcUltimate } from './combatMasteryEngine';
import {
  migrateDeprecatedHexShotLoadoutId,
  migrateHexShotAbilityId,
} from './hexShotMigration';
import { isHexWeaponActionId } from './hexWeaponActionRegistry';

function isValidFlexCandidate(id: HexShotAbilityId, used: Set<string>): boolean {
  if (used.has(id)) return false;
  if (id === HEX_SHOT_ANCHOR) return false;
  if (HEX_SHOT_INTRINSIC.includes(id)) return false;
  if (isHexShotProcUltimate(id)) return false;
  if (isHexShotDeprecatedAbility(id)) return false;
  if (isHexWeaponActionId(id)) return false;
  const assignable = getAssignableHexShotAbilities();
  return assignable.includes(id);
}

function nextDefaultFlex(used: Set<string>): HexShotAbilityId {
  for (const id of DEFAULT_HEX_FLEX_LOADOUT) {
    if (!used.has(id)) return id;
  }
  for (const id of getAssignableHexShotAbilities()) {
    if (!used.has(id)) return id;
  }
  return 'RIFT_SNARE';
}

/**
 * Extract three flex IDs from legacy 4-slot `[anchor, f0, f1, f2]` or canonical 3-slot flex.
 * Pure — does not mutate input.
 */
export function extractHexFlexCandidates(
  loadout: readonly string[] | null | undefined,
): HexShotAbilityId[] {
  if (!loadout?.length) return [...DEFAULT_HEX_FLEX_LOADOUT];
  const migrated = loadout.map((id) => migrateHexShotAbilityId(String(id)));
  if (migrated.length >= 4) {
    // Legacy: drop slot 0 (anchor / WA / SILVER_CORE_SIDEARM).
    return migrated.slice(1, 4).map((raw) => migrateDeprecatedHexShotLoadoutId(raw));
  }
  if (migrated.length === 3) {
    return migrated.map((raw) => migrateDeprecatedHexShotLoadoutId(raw));
  }
  // Partial / corrupt — pad from defaults after migration.
  return migrated.map((raw) => migrateDeprecatedHexShotLoadoutId(raw));
}

/** Canonical three-flex sanitize. Read-compatible with legacy 4-tuples. */
export function sanitizeHexFlexLoadout(
  loadout: readonly string[] | HexShotLoadout | HexFlexLoadout | null | undefined,
): HexFlexLoadout {
  const candidates = extractHexFlexCandidates(loadout as readonly string[] | undefined);
  const used = new Set<string>();
  const flex: HexShotAbilityId[] = [];
  for (let i = 0; i < 3; i += 1) {
    const raw = candidates[i];
    if (raw && isValidFlexCandidate(raw, used)) {
      used.add(raw);
      flex.push(raw);
    } else {
      const replacement = nextDefaultFlex(used);
      used.add(replacement);
      flex.push(replacement);
    }
  }
  return [flex[0]!, flex[1]!, flex[2]!];
}

/** @deprecated Prefer sanitizeHexFlexLoadout — kept as alias for call-site migration. */
export function sanitizeHexShotCombatLoadout(
  loadout: readonly HexShotAbilityId[],
): HexFlexLoadout {
  return sanitizeHexFlexLoadout(loadout);
}

export function validateHexFlexLoadoutCommit(
  loadout: readonly string[],
  unlocked?: readonly string[],
): string | null {
  if (loadout.length !== 3) {
    return '>> LOADOUT REJECTED — THREE FLEX SLOTS REQUIRED.';
  }
  const flex = loadout as HexShotAbilityId[];
  if (flex.some((id) => isHexWeaponActionId(id))) {
    return '>> LOADOUT REJECTED — WEAPON ACTIONS ARE NOT SELECTABLE FLEXES.';
  }
  if (flex.some((id) => id === HEX_SHOT_ANCHOR)) {
    return '>> LOADOUT REJECTED — FIXED BASIC IS NOT A FLEX SLOT.';
  }
  if (flex.some((id) => isHexShotProcUltimate(id))) {
    return '>> LOADOUT REJECTED — WEAPON ULTIMATE IS NOT A DECK SLOT.';
  }
  if (flex.some((id) => HEX_SHOT_INTRINSIC.includes(id))) {
    return '>> LOADOUT REJECTED — INTRINSIC ABILITY CANNOT OCCUPY A FLEX SLOT.';
  }
  if (flex.some((id) => isHexShotDeprecatedAbility(id))) {
    return '>> LOADOUT REJECTED — DEPRECATED AMMO-IDENTITY ABILITY NOT SELECTABLE.';
  }
  const assignable = new Set(getAssignableHexShotAbilities());
  const illegal = flex.find((id) => !assignable.has(id));
  if (illegal) {
    return `>> LOADOUT REJECTED — ${String(illegal).replace(/_/g, ' ')} NOT AN ASSIGNABLE FLEX ABILITY.`;
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

export { DEFAULT_HEX_FLEX_LOADOUT, DEFAULT_HEX_SHOT_LOADOUT };
