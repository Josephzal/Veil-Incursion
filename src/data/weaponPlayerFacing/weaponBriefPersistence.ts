import type { WeaponFamilyId } from '../../types/weapon';
import { isWeaponFamilyId } from '../weaponRegistry';

/** Normalize optional Phase 3L tutorial acknowledgement list. Missing ⇒ none acknowledged. */
export function normalizeWeaponBriefAcknowledged(raw: unknown): WeaponFamilyId[] {
  if (!Array.isArray(raw)) return [];
  const out: WeaponFamilyId[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string' && isWeaponFamilyId(entry) && !out.includes(entry)) {
      out.push(entry);
    }
  }
  return out;
}

export function hasWeaponBriefAcknowledged(
  acknowledged: readonly WeaponFamilyId[] | undefined,
  familyId: WeaponFamilyId,
): boolean {
  return (acknowledged ?? []).includes(familyId);
}

export function withWeaponBriefAcknowledged(
  acknowledged: readonly WeaponFamilyId[] | undefined,
  familyId: WeaponFamilyId,
): WeaponFamilyId[] {
  const next = normalizeWeaponBriefAcknowledged(acknowledged);
  if (!next.includes(familyId)) next.push(familyId);
  return next;
}

/**
 * Canonical first-use brief trigger (Phase 3L closeout).
 *
 * Opens when an **owned** weapon is first **explicitly selected** (chassis press)
 * or **explicitly equipped** (EQUIP CHASSIS), if not yet acknowledged.
 * Silent auto-select, hover, locked browse, and combat never trigger.
 * If a brief is already pending for the same family in this interaction, do not re-open.
 */
export function shouldOpenWeaponFirstUseBrief(args: {
  familyId: WeaponFamilyId;
  unlocked: boolean;
  acknowledged: readonly WeaponFamilyId[] | undefined;
  /** Silent chassis sync / hover / locked browse / combat */
  interaction: 'explicit-select' | 'explicit-equip' | 'silent' | 'hover' | 'focus' | 'locked-browse' | 'combat';
  /** Family id already showing a first-use modal in this UI session interaction */
  pendingFirstUseFamilyId?: WeaponFamilyId | null;
}): boolean {
  if (
    args.interaction === 'silent'
    || args.interaction === 'hover'
    || args.interaction === 'focus'
    || args.interaction === 'locked-browse'
    || args.interaction === 'combat'
  ) {
    return false;
  }
  if (!args.unlocked) return false;
  if (hasWeaponBriefAcknowledged(args.acknowledged, args.familyId)) return false;
  if (args.pendingFirstUseFamilyId === args.familyId) return false;
  return args.interaction === 'explicit-select' || args.interaction === 'explicit-equip';
}
