/**
 * Hex Shot weapon-kit actions — derived from equipped family, never persisted as selections.
 * W.2–W.4: Revolver, Carbine, and Black Door kits executable when kitComplete.
 */

export type HexWeaponActionId =
  // Revolver — hex-silver-core-sidearm (W.2)
  | 'QUICKDRAW'
  | 'SLIPSHOT'
  | 'SIX_BELLS'
  | 'LAST_WORD'
  // Carbine — hex-pulse-rifle (W.3 — not executable in W.2)
  | 'CENTER_MASS'
  | 'CONTROLLED_BURST'
  | 'SUPPRESSIVE_BARRAGE'
  | 'CONTACT_FRONT'
  // Black Door — hex-void-cannon (W.4 — not executable in W.2)
  | 'DOOR_KNOCKER'
  | 'FATAL_FUNNEL'
  | 'THRESHOLD'
  | 'DEADBOLT';

export type HexRevolverWeaponActionId =
  | 'QUICKDRAW'
  | 'SLIPSHOT'
  | 'SIX_BELLS'
  | 'LAST_WORD';

export const HEX_REVOLVER_WEAPON_ACTIONS: readonly [
  HexRevolverWeaponActionId,
  HexRevolverWeaponActionId,
  HexRevolverWeaponActionId,
  HexRevolverWeaponActionId,
] = ['QUICKDRAW', 'SLIPSHOT', 'SIX_BELLS', 'LAST_WORD'];

export const HEX_CARBINE_WEAPON_ACTIONS: readonly [
  HexWeaponActionId,
  HexWeaponActionId,
  HexWeaponActionId,
  HexWeaponActionId,
] = ['CENTER_MASS', 'CONTROLLED_BURST', 'SUPPRESSIVE_BARRAGE', 'CONTACT_FRONT'];

export const HEX_BLACK_DOOR_WEAPON_ACTIONS: readonly [
  HexWeaponActionId,
  HexWeaponActionId,
  HexWeaponActionId,
  HexWeaponActionId,
] = ['DOOR_KNOCKER', 'FATAL_FUNNEL', 'THRESHOLD', 'DEADBOLT'];
