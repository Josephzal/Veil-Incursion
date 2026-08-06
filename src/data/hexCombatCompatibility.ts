/**
 * Hex Shot W.2 combat surface — complete kits use 4+3; incomplete kits use legacy basic+3 flex.
 */
import type { HexFlexLoadout } from '../types/operativeClass';
import type { HexWeaponActionId } from '../types/hexWeaponAction';
import { DEFAULT_HEX_FLEX_LOADOUT } from '../types/operativeClass';
import { HEX_SHOT_ANCHOR } from './classAbilityUnlockEngine';
import { sanitizeHexFlexLoadout } from './hexFlexLoadoutEngine';
import {
  deriveHexWeaponActions,
  getHexWeaponActionSet,
  isHexWeaponKitComplete,
  type HexWeaponFamilyId,
} from './hexWeaponActionRegistry';
import type { WeaponFamilyId } from '../types/weapon';

export type HexCombatSurfaceMode = 'WEAPON_KIT' | 'LEGACY_BASIC_FLEX';

export interface HexCombatSurface {
  familyId: HexWeaponFamilyId | null;
  mode: HexCombatSurfaceMode;
  /** Derived WA when mode is WEAPON_KIT; empty for legacy. */
  weaponActions: readonly HexWeaponActionId[];
  flex: HexFlexLoadout;
  /**
   * Flat HUD order.
   * WEAPON_KIT: 4 WA + 3 flex.
   * LEGACY: SILVER_CORE_SIDEARM + 3 flex.
   */
  hudCards: readonly string[];
  weaponActionCount: number;
  techniqueCount: number;
}

export function buildHexCombatSurface(args: {
  weaponFamilyId: WeaponFamilyId | HexWeaponFamilyId | null | undefined;
  flex: HexFlexLoadout | readonly string[] | null | undefined;
}): HexCombatSurface {
  const flex = sanitizeHexFlexLoadout(args.flex ?? DEFAULT_HEX_FLEX_LOADOUT);
  const set = getHexWeaponActionSet(args.weaponFamilyId);
  const familyId = set?.familyId ?? null;

  if (isHexWeaponKitComplete(args.weaponFamilyId) && set) {
    const actions = deriveHexWeaponActions(args.weaponFamilyId)!;
    return {
      familyId,
      mode: 'WEAPON_KIT',
      weaponActions: actions,
      flex,
      hudCards: [...actions, ...flex],
      weaponActionCount: 4,
      techniqueCount: 3,
    };
  }

  return {
    familyId,
    mode: 'LEGACY_BASIC_FLEX',
    weaponActions: [],
    flex,
    hudCards: [HEX_SHOT_ANCHOR, ...flex],
    weaponActionCount: 0,
    techniqueCount: 0,
  };
}
