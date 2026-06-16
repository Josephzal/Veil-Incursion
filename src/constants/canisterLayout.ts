/** Source asset dimensions for canister.png (319×781). */
export const CANISTER_IMAGE_WIDTH = 319;
export const CANISTER_IMAGE_HEIGHT = 781;
export const CANISTER_ASPECT_RATIO = CANISTER_IMAGE_WIDTH / CANISTER_IMAGE_HEIGHT;

/** Vertical bands of the canister art (fractions of total height). */
export const CANISTER_TOP_CAP_RATIO = 0.24;
export const CANISTER_GLASS_HEIGHT_RATIO = 0.60;
export const CANISTER_BASE_RATIO = 0.16;

/** Horizontal inset of the glass cylinder from the shell edges. */
export const CANISTER_GLASS_SIDE_INSET_RATIO = 0.08;

/** Responsive glass tube height clamps (screen-height fraction + min/max). */
export const GLASS_SCREEN_HEIGHT_RATIO = 0.115;
export const GLASS_MIN_HEIGHT = 72;
export const GLASS_MAX_HEIGHT = 132;

/** Canister height as a fraction of the cargo cell grid frame height (harvest sidecar). */
export const CANISTER_GRID_HEIGHT_RATIO = 0.78;

export interface CanisterLayoutDimensions {
  glassHeight: number;
  glassWidth: number;
  canisterHeight: number;
  canisterWidth: number;
}

export function resolveCanisterLayoutDimensions(screenHeight: number): CanisterLayoutDimensions {
  const glassHeight = Math.min(
    GLASS_MAX_HEIGHT,
    Math.max(GLASS_MIN_HEIGHT, Math.round(screenHeight * GLASS_SCREEN_HEIGHT_RATIO)),
  );
  const canisterHeight = Math.round(glassHeight / CANISTER_GLASS_HEIGHT_RATIO);
  const canisterWidth = Math.round(canisterHeight * CANISTER_ASPECT_RATIO);
  const glassWidth = Math.round(canisterWidth * (1 - CANISTER_GLASS_SIDE_INSET_RATIO * 2));

  return { glassHeight, glassWidth, canisterHeight, canisterWidth };
}

/** Size the harvest canister to sit snugly beside the inventory cell grid. */
export function resolveCanisterLayoutForGrid(gridFrameHeight: number): CanisterLayoutDimensions {
  const canisterHeight = Math.max(48, Math.round(gridFrameHeight * CANISTER_GRID_HEIGHT_RATIO));
  const glassHeight = Math.round(canisterHeight * CANISTER_GLASS_HEIGHT_RATIO);
  const canisterWidth = Math.round(canisterHeight * CANISTER_ASPECT_RATIO);
  const glassWidth = Math.round(canisterWidth * (1 - CANISTER_GLASS_SIDE_INSET_RATIO * 2));

  return { glassHeight, glassWidth, canisterHeight, canisterWidth };
}
