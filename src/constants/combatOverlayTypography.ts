/** Shared combat popup scale — status, cargo, hostile intent, status tooltips. */
export const COMBAT_POPUP_SCALE = 1.75;

export function combatPopupFont(base: number): number {
  return Math.round(base * COMBAT_POPUP_SCALE * 10) / 10;
}

/** Uniform body size for combat modal copy (all lines in a popup match). */
export const COMBAT_POPUP_BODY_FONT = combatPopupFont(8);
