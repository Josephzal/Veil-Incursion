/**
 * Hex weapon actions — always derived from equipped family.
 * Never persist these IDs on PlayerAccount or ActiveIncursion.
 *
 * W.5 — total family authority. All registered Hex families are kit-complete.
 * Transitional incomplete-family fallback removed.
 */
import type { HexWeaponActionId } from '../types/hexWeaponAction';
import {
  HEX_BLACK_DOOR_WEAPON_ACTIONS,
  HEX_CARBINE_WEAPON_ACTIONS,
  HEX_REVOLVER_WEAPON_ACTIONS,
} from '../types/hexWeaponAction';
import type { WeaponFamilyId } from '../types/weapon';

export type HexWeaponFamilyId =
  | 'hex-silver-core-sidearm'
  | 'hex-pulse-rifle'
  | 'hex-void-cannon';

export interface HexWeaponActionSet {
  familyId: HexWeaponFamilyId;
  /** Live registry display name (not design-kit alias). */
  displayName: string;
  /** Design-kit alias (Revolver / Carbine / Black Door). */
  designKitAlias: 'Revolver' | 'Carbine' | 'Black Door';
  actions: readonly [
    HexWeaponActionId,
    HexWeaponActionId,
    HexWeaponActionId,
    HexWeaponActionId,
  ];
  /**
   * Validation metadata — all registered families must be true after W.5.
   * Does not select an alternate combat surface.
   */
  kitComplete: true;
}

const HEX_WEAPON_ACTION_BY_FAMILY: Record<HexWeaponFamilyId, HexWeaponActionSet> = {
  'hex-silver-core-sidearm': {
    familyId: 'hex-silver-core-sidearm',
    displayName: 'Silver-Core Sidearm',
    designKitAlias: 'Revolver',
    actions: HEX_REVOLVER_WEAPON_ACTIONS,
    kitComplete: true,
  },
  'hex-pulse-rifle': {
    familyId: 'hex-pulse-rifle',
    displayName: 'Ash Shotgun',
    designKitAlias: 'Carbine',
    actions: HEX_CARBINE_WEAPON_ACTIONS,
    kitComplete: true,
  },
  'hex-void-cannon': {
    familyId: 'hex-void-cannon',
    displayName: 'Nullbreach',
    designKitAlias: 'Black Door',
    actions: HEX_BLACK_DOOR_WEAPON_ACTIONS,
    kitComplete: true,
  },
};

export const ALL_HEX_WEAPON_FAMILY_IDS: readonly HexWeaponFamilyId[] = [
  'hex-silver-core-sidearm',
  'hex-pulse-rifle',
  'hex-void-cannon',
];

export function isHexWeaponFamilyId(id: string | null | undefined): id is HexWeaponFamilyId {
  return id === 'hex-silver-core-sidearm'
    || id === 'hex-pulse-rifle'
    || id === 'hex-void-cannon';
}

export function getHexWeaponActionSet(
  familyId: WeaponFamilyId | HexWeaponFamilyId | null | undefined,
): HexWeaponActionSet | null {
  if (!isHexWeaponFamilyId(familyId)) return null;
  return HEX_WEAPON_ACTION_BY_FAMILY[familyId];
}

/**
 * W.5 — every registered Hex family is kit-complete.
 * Retained as validation metadata; does not select LEGACY surfaces.
 */
export function isHexWeaponKitComplete(
  familyId: WeaponFamilyId | HexWeaponFamilyId | null | undefined,
): boolean {
  const set = getHexWeaponActionSet(familyId);
  return set != null && set.kitComplete === true;
}

export function deriveHexWeaponActions(
  familyId: WeaponFamilyId | HexWeaponFamilyId | null | undefined,
): readonly [
  HexWeaponActionId,
  HexWeaponActionId,
  HexWeaponActionId,
  HexWeaponActionId,
] | null {
  return getHexWeaponActionSet(familyId)?.actions ?? null;
}

/**
 * Require a registered Hex family with four catalog-defined actions.
 * Throws on missing/incomplete mappings — never falls back to a legacy basic.
 */
export function requireHexWeaponActions(
  familyId: WeaponFamilyId | HexWeaponFamilyId | null | undefined,
): readonly [
  HexWeaponActionId,
  HexWeaponActionId,
  HexWeaponActionId,
  HexWeaponActionId,
] {
  if (!isHexWeaponFamilyId(familyId)) {
    throw new Error(`[HEX W.5] Unknown or missing Hex weapon family: ${String(familyId)}`);
  }
  const set = HEX_WEAPON_ACTION_BY_FAMILY[familyId];
  if (!set.kitComplete) {
    throw new Error(`[HEX W.5] Registered family not kit-complete: ${familyId}`);
  }
  if (set.actions.length !== 4) {
    throw new Error(`[HEX W.5] Family ${familyId} must derive exactly 4 weapon actions.`);
  }
  return set.actions;
}

/** Registry-wide structural invariant — all three families resolve four actions. */
export function assertHexWeaponFamilyRegistryInvariant(): void {
  for (const familyId of ALL_HEX_WEAPON_FAMILY_IDS) {
    requireHexWeaponActions(familyId);
  }
}

export function isHexWeaponActionId(id: string): id is HexWeaponActionId {
  for (const familyId of ALL_HEX_WEAPON_FAMILY_IDS) {
    if ((HEX_WEAPON_ACTION_BY_FAMILY[familyId].actions as readonly string[]).includes(id)) {
      return true;
    }
  }
  return false;
}

/** Executable when the action belongs to the equipped registered family's four WAs. */
export function isHexWeaponActionExecutable(
  familyId: WeaponFamilyId | HexWeaponFamilyId | null | undefined,
  actionId: string,
): boolean {
  if (!isHexWeaponFamilyId(familyId)) return false;
  try {
    const actions = requireHexWeaponActions(familyId);
    return (actions as readonly string[]).includes(actionId);
  } catch {
    return false;
  }
}
