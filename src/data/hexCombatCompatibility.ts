/**
 * Hex Shot W.5 combat surface — total 4+3 authority.
 * Transitional LEGACY_BASIC_FLEX fallback removed.
 */
import type { HexFlexLoadout } from '../types/operativeClass';
import type { HexWeaponActionId } from '../types/hexWeaponAction';
import { DEFAULT_HEX_FLEX_LOADOUT } from '../types/operativeClass';
import { sanitizeHexFlexLoadout } from './hexFlexLoadoutEngine';
import {
  getHexWeaponActionSet,
  isHexWeaponFamilyId,
  requireHexWeaponActions,
  type HexWeaponFamilyId,
} from './hexWeaponActionRegistry';
import type { WeaponFamilyId } from '../types/weapon';

/** W.5 — only WEAPON_KIT remains. LEGACY_BASIC_FLEX deleted. */
export type HexCombatSurfaceMode = 'WEAPON_KIT';

export interface HexCombatSurface {
  familyId: HexWeaponFamilyId | null;
  mode: HexCombatSurfaceMode;
  weaponActions: readonly HexWeaponActionId[];
  flex: HexFlexLoadout;
  /**
   * Flat HUD order: 4 WA + 3 flex when family resolves; flex-only when family missing.
   * Typed as string[] so Reload/Ultimate exclusion checks stay uncoupled from ability unions.
   */
  hudCards: readonly string[];
  weaponActionCount: number;
  techniqueCount: number;
}

/**
 * Build the Hex combat strip for an equipped family.
 * Registered families always yield 4 WA + 3 flex.
 * Unknown/missing family never inserts a historical fixed basic.
 */
export function buildHexCombatSurface(args: {
  weaponFamilyId: WeaponFamilyId | HexWeaponFamilyId | null | undefined;
  flex: HexFlexLoadout | readonly string[] | null | undefined;
}): HexCombatSurface {
  const flex = sanitizeHexFlexLoadout(args.flex ?? DEFAULT_HEX_FLEX_LOADOUT);

  if (!isHexWeaponFamilyId(args.weaponFamilyId)) {
    return {
      familyId: null,
      mode: 'WEAPON_KIT',
      weaponActions: [],
      flex,
      hudCards: [...flex],
      weaponActionCount: 0,
      techniqueCount: 3,
    };
  }

  const set = getHexWeaponActionSet(args.weaponFamilyId)!;
  const actions = requireHexWeaponActions(args.weaponFamilyId);
  return {
    familyId: set.familyId,
    mode: 'WEAPON_KIT',
    weaponActions: actions,
    flex,
    hudCards: [...actions, ...flex],
    weaponActionCount: 4,
    techniqueCount: 3,
  };
}

/** True when the surface is the canonical playable 4+3 kit. */
export function isHexCombatSurfaceComplete(surface: HexCombatSurface): boolean {
  return surface.familyId != null
    && surface.mode === 'WEAPON_KIT'
    && surface.weaponActionCount === 4
    && surface.techniqueCount === 3
    && surface.weaponActions.length === 4
    && surface.hudCards.length === 7;
}
