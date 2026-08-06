/**
 * Hex Black Door / Nullbreach position falloff — W.4.
 * Single owner for frontline full / backline ×0.75 on Black Door authored results.
 */

export const BLACK_DOOR_BACKLINE_DAMAGE_MULT = 0.75;

export function isBlackDoorBacklineSlot(
  gridSlot: string | null | undefined,
): boolean {
  return !!gridSlot && gridSlot.startsWith('BL');
}

/** Apply family backline falloff exactly once. Frontline unchanged. */
export function applyBlackDoorBacklineFalloff(
  damage: number,
  isBackline: boolean,
): number {
  if (!isBackline || damage <= 0) return damage;
  return Math.max(0, Math.floor(damage * BLACK_DOOR_BACKLINE_DAMAGE_MULT));
}

export function applyBlackDoorBacklineFalloffForUnit(
  damage: number,
  gridSlot: string | null | undefined,
): number {
  return applyBlackDoorBacklineFalloff(damage, isBlackDoorBacklineSlot(gridSlot));
}
