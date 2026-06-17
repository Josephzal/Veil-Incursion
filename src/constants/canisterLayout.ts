/** Source asset dimensions for canister.png (319×781). */
export const CANISTER_IMAGE_WIDTH = 319;
export const CANISTER_IMAGE_HEIGHT = 781;
export const CANISTER_ASPECT_RATIO = CANISTER_IMAGE_WIDTH / CANISTER_IMAGE_HEIGHT;

/** Vertical bands of the canister art (fractions of total height). */
export const CANISTER_TOP_CAP_RATIO = 0.24;
export const CANISTER_GLASS_HEIGHT_RATIO = 0.60;
export const CANISTER_BASE_RATIO = 0.16;

/** Visual vacuum bar height scale (0.9 = 10% shorter than the glass band). */
export const VACUUM_BAR_HEIGHT_SCALE = 0.9;
export const VACUUM_BAR_HEIGHT_RATIO = CANISTER_GLASS_HEIGHT_RATIO * VACUUM_BAR_HEIGHT_SCALE;

/** Lift the bar bottom edge upward by this fraction of total canister height (net after adjustments). */
export const VACUUM_BAR_BOTTOM_LIFT_RATIO = 0.04;

const DEFAULT_VACUUM_BAR_BOTTOM_RATIO = CANISTER_TOP_CAP_RATIO + CANISTER_GLASS_HEIGHT_RATIO;
export const VACUUM_BAR_BOTTOM_RATIO = DEFAULT_VACUUM_BAR_BOTTOM_RATIO - VACUUM_BAR_BOTTOM_LIFT_RATIO;
export const VACUUM_BAR_TOP_RATIO = VACUUM_BAR_BOTTOM_RATIO - VACUUM_BAR_HEIGHT_RATIO;

/** Horizontal inset of the glass cylinder from the shell edges. */
export const CANISTER_GLASS_SIDE_INSET_RATIO = 0.08;

/** Canister shell width scale (0.85 = 15% narrower than derived layout width). */
export const CANISTER_SHELL_WIDTH_SCALE = 0.85;

/** Vacuum bar width scale relative to its default inset-derived width (0.75 = 25% narrower). */
export const VACUUM_BAR_WIDTH_SCALE = 0.75;

const BASE_VACUUM_BAR_INSET_PCT = CANISTER_GLASS_SIDE_INSET_RATIO * 10;
const BASE_VACUUM_BAR_WIDTH_PCT = 100 - BASE_VACUUM_BAR_INSET_PCT * 2;

/** Horizontal inset (% of shell width) for each side of the vacuum bar pressable. */
export const VACUUM_BAR_SIDE_INSET_PCT = (100 - BASE_VACUUM_BAR_WIDTH_PCT * VACUUM_BAR_WIDTH_SCALE) / 2;

/** Responsive glass tube height clamps (screen-height fraction + min/max). */
export const GLASS_SCREEN_HEIGHT_RATIO = 0.115;
export const GLASS_MIN_HEIGHT = 72;
export const GLASS_MAX_HEIGHT = 132;

/** Canister height as a fraction of the cargo cell grid frame height (harvest sidecar). */
export const CANISTER_GRID_HEIGHT_RATIO = 0.78;

/** Harvest screen: canister shell + vacuum bar rendered at 60% of grid-derived size (40% reduction). */
export const HARVEST_CANISTER_SIZE_SCALE = 0.6;

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
  const canisterWidth = Math.round(canisterHeight * CANISTER_ASPECT_RATIO * CANISTER_SHELL_WIDTH_SCALE);
  const glassWidth = Math.round(canisterWidth * (1 - CANISTER_GLASS_SIDE_INSET_RATIO * 2) * VACUUM_BAR_WIDTH_SCALE);

  return { glassHeight, glassWidth, canisterHeight, canisterWidth };
}

/** Size the harvest canister to sit snugly beside the inventory cell grid. */
export function resolveCanisterLayoutForGrid(gridFrameHeight: number): CanisterLayoutDimensions {
  const canisterHeight = Math.max(48, Math.round(gridFrameHeight * CANISTER_GRID_HEIGHT_RATIO));
  const glassHeight = Math.round(canisterHeight * CANISTER_GLASS_HEIGHT_RATIO);
  const canisterWidth = Math.round(canisterHeight * CANISTER_ASPECT_RATIO * CANISTER_SHELL_WIDTH_SCALE);
  const glassWidth = Math.round(canisterWidth * (1 - CANISTER_GLASS_SIDE_INSET_RATIO * 2) * VACUUM_BAR_WIDTH_SCALE);

  const scale = HARVEST_CANISTER_SIZE_SCALE;
  return {
    canisterHeight: Math.max(29, Math.round(canisterHeight * scale)),
    glassHeight: Math.max(17, Math.round(glassHeight * scale)),
    canisterWidth: Math.max(22, Math.round(canisterWidth * scale)),
    glassWidth: Math.max(10, Math.round(glassWidth * scale)),
  };
}
