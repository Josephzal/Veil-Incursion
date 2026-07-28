import { CARGO_GRID_COLS, CARGO_GRID_ROWS } from '../types/cargoGrid';

export const CARGO_CELL_SIZE = 56;
export const CARGO_CELL_GAP = 2;

export const CARGO_GRID_FRAME_WIDTH =
  CARGO_GRID_COLS * CARGO_CELL_SIZE + (CARGO_GRID_COLS - 1) * CARGO_CELL_GAP;
export const CARGO_GRID_FRAME_HEIGHT =
  CARGO_GRID_ROWS * CARGO_CELL_SIZE + (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP;
/** @deprecated Use CARGO_GRID_FRAME_WIDTH / HEIGHT for non-square grids. */
export const CARGO_GRID_FRAME_SIZE = CARGO_GRID_FRAME_WIDTH;

/** Hub / in-run cargo grids render 20% larger than the legacy baseline. */
export const HUB_CARGO_CELL_SCALE = 1.2;

export function scaleHubCargoCellSize(base: number): number {
  return Math.round(base * HUB_CARGO_CELL_SCALE);
}

export const HUB_CARGO_DEFAULT_TARGET = scaleHubCargoCellSize(44);
export const HUB_CARGO_INCURSION_CELL_TARGET = scaleHubCargoCellSize(52);
export const HUB_CARGO_INCURSION_CELL_MAX = scaleHubCargoCellSize(72);
export const HUB_CARGO_EXTRACTION_CELL_MAX = scaleHubCargoCellSize(96);
export const HUB_CARGO_EXTRACTION_CELL_TARGET_BASE = scaleHubCargoCellSize(52);
export const HUB_CARGO_EXTRACTION_CELL_TARGET_FONT_BASE = scaleHubCargoCellSize(58);

/**
 * Canonical in-run cargo cell size — black market, safehouse, harvest, and
 * cargo overlays share this so grids stay visually uniform.
 * Kept in constants (not utils) to avoid circular init with CargoGridBoard.
 */
export const INCURSION_CARGO_CELL_SIZE = HUB_CARGO_INCURSION_CELL_TARGET;

/** Black Market cargo deck — 2× the shared in-run cell size. */
export const BLACK_MARKET_CARGO_CELL_SIZE = INCURSION_CARGO_CELL_SIZE * 1.5;
