import { CARGO_CELL_GAP, CARGO_CELL_SIZE, CARGO_GRID_FRAME_WIDTH } from '../components/CargoGridBoard';
import { IMMERSIVE_FOOTER_GUTTER } from './immersiveLayout';
import { CARGO_GRID_ROWS } from '../types/cargoGrid';

export const HARVEST_HORIZONTAL_PADDING = 8;
export const GRID_CANISTER_GAP = 6;
export const HARVEST_EXTERNAL_ROW_GAP = 20;
/** Fixed vertical footprint for the harvest containment row (margin + slot height). */
export const HARVEST_EXTERNAL_BAY_HEIGHT = 84;
/** Vertical space reserved for pinned footer CTA on harvest screen. */
export const HARVEST_FOOTER_RESERVE = 56;
export const HARVEST_HEADER_RESERVE = 40;
export const HARVEST_FRAME_PADDING = 24;
export const HARVEST_MIN_CELL_SIZE = 40;
export const HARVEST_EXTERNAL_BAY_MARGIN_TOP = 10;

export function resolveHarvestCellSize(screenHeight: number, bottomInset = 0): number {
  const footerReserve = HARVEST_FOOTER_RESERVE + Math.max(0, bottomInset - IMMERSIVE_FOOTER_GUTTER);
  const available =
    screenHeight
    - footerReserve
    - HARVEST_HEADER_RESERVE
    - HARVEST_EXTERNAL_BAY_HEIGHT
    - HARVEST_EXTERNAL_BAY_MARGIN_TOP
    - HARVEST_FRAME_PADDING;
  const computed = Math.floor(
    (available - (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP) / CARGO_GRID_ROWS,
  );
  return Math.min(CARGO_CELL_SIZE, Math.max(HARVEST_MIN_CELL_SIZE, computed));
}

export function harvestGridFrameHeight(cellSize: number): number {
  return CARGO_GRID_ROWS * cellSize + (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP;
}

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
