/**
 * Hex weapon actions — always derived from equipped family.
 * Never persist these IDs on PlayerAccount or ActiveIncursion.
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
  displayName: string;
  actions: readonly [
    HexWeaponActionId,
    HexWeaponActionId,
    HexWeaponActionId,
    HexWeaponActionId,
  ];
  /**
   * W.2–W.4 — All three Hex kits combat-complete in W.4.
   * Central fallback retained for W.5 cleanup; incomplete families keep legacy surface.
   */
  kitComplete: boolean;
}

const HEX_WEAPON_ACTION_BY_FAMILY: Record<HexWeaponFamilyId, HexWeaponActionSet> = {
  'hex-silver-core-sidearm': {
    familyId: 'hex-silver-core-sidearm',
    displayName: 'Silver-Core Sidearm',
    actions: HEX_REVOLVER_WEAPON_ACTIONS,
    kitComplete: true,
  },
  'hex-pulse-rifle': {
    familyId: 'hex-pulse-rifle',
    displayName: 'Ash Shotgun',
    actions: HEX_CARBINE_WEAPON_ACTIONS,
    kitComplete: true,
  },
  'hex-void-cannon': {
    familyId: 'hex-void-cannon',
    displayName: 'Nullbreach',
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

/** Central W.2–W.4 gate — extend when Carbine/Black Door kits ship; remove fallback in W.5. */
export function isHexWeaponKitComplete(
  familyId: WeaponFamilyId | HexWeaponFamilyId | null | undefined,
): boolean {
  return getHexWeaponActionSet(familyId)?.kitComplete === true;
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

export function isHexWeaponActionId(id: string): id is HexWeaponActionId {
  for (const familyId of ALL_HEX_WEAPON_FAMILY_IDS) {
    if ((HEX_WEAPON_ACTION_BY_FAMILY[familyId].actions as readonly string[]).includes(id)) {
      return true;
    }
  }
  return false;
}

/** Executable when the equipped family's kit is complete (W.4 = all three Hex families). */
export function isHexWeaponActionExecutable(
  familyId: WeaponFamilyId | HexWeaponFamilyId | null | undefined,
  actionId: string,
): boolean {
  if (!isHexWeaponKitComplete(familyId)) return false;
  const actions = deriveHexWeaponActions(familyId);
  return !!actions && (actions as readonly string[]).includes(actionId);
}
