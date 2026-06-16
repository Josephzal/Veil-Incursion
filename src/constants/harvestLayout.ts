import { CARGO_CELL_SIZE, CARGO_GRID_FRAME_WIDTH } from '../components/CargoGridBoard';

export const HARVEST_HORIZONTAL_PADDING = 8;
export const GRID_CANISTER_GAP = 6;
export const HARVEST_EXTERNAL_ROW_GAP = 20;
/** Fixed vertical footprint for the harvest containment row (margin + slot height). */
export const HARVEST_EXTERNAL_BAY_HEIGHT = 84;

/** Width of the harvest gap between the cargo grid and the right screen edge. */
export function resolveHarvestSidecarWidth(screenWidth: number): number {
  const usable = screenWidth - HARVEST_HORIZONTAL_PADDING * 2;
  const gridLeft = HARVEST_HORIZONTAL_PADDING + (usable - CARGO_GRID_FRAME_WIDTH) / 2;
  const gridRight = gridLeft + CARGO_GRID_FRAME_WIDTH;
  const gapRight = screenWidth - HARVEST_HORIZONTAL_PADDING;
  return Math.max(0, gapRight - gridRight - GRID_CANISTER_GAP);
}

export function resolveHarvestExternalRowWidth(slotCount: number): number {
  if (slotCount <= 0) return 0;
  return slotCount * CARGO_CELL_SIZE + (slotCount - 1) * HARVEST_EXTERNAL_ROW_GAP;
}
