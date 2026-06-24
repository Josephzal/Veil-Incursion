import { CARGO_CELL_GAP, CARGO_CELL_SIZE } from '../components/CargoGridBoard';
import { HARVEST_EXTERNAL_BAY_HEIGHT, HARVEST_EXTERNAL_BAY_MARGIN_TOP } from './harvestLayout';
import { resolveImmersiveFooterInset } from './immersiveLayout';
import { CARGO_GRID_COLS, CARGO_GRID_ROWS } from '../types/cargoGrid';

export const CARGO_OVERLAY_PANEL_PADDING = 14;
export const CARGO_OVERLAY_HEADER_RESERVE = 40;
export const CARGO_OVERLAY_BACKDROP_PADDING = 16;
export const CARGO_OVERLAY_COMBAT_DETAIL_HEIGHT = 120;
export const CARGO_OVERLAY_SCANNER_BUTTON_HEIGHT = 32;
export const CARGO_OVERLAY_BOARD_GAP = 20;
export const CARGO_OVERLAY_MIN_CELL_SIZE = 36;

export function resolveCargoOverlayCellSize(
  screenHeight: number,
  bottomInset: number,
  options: {
    combatMode: boolean;
    hasContainment: boolean;
    scannerButtonCount: number;
  },
): number {
  const footerInset = resolveImmersiveFooterInset(bottomInset);
  const externalBayReserve = options.hasContainment
    ? HARVEST_EXTERNAL_BAY_HEIGHT + HARVEST_EXTERNAL_BAY_MARGIN_TOP
    : 0;
  const combatReserve = options.combatMode ? CARGO_OVERLAY_COMBAT_DETAIL_HEIGHT + CARGO_OVERLAY_BOARD_GAP : 0;
  const scannerReserve = options.scannerButtonCount > 0
    ? options.scannerButtonCount * (CARGO_OVERLAY_SCANNER_BUTTON_HEIGHT + 8)
    : 0;

  const available =
    screenHeight
    - CARGO_OVERLAY_BACKDROP_PADDING * 2
    - CARGO_OVERLAY_PANEL_PADDING * 2
    - CARGO_OVERLAY_HEADER_RESERVE
    - footerInset
    - externalBayReserve
    - combatReserve
    - scannerReserve
    - CARGO_OVERLAY_BOARD_GAP;

  const computed = Math.floor(
    (available - (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP) / CARGO_GRID_ROWS,
  );

  return Math.min(CARGO_CELL_SIZE, Math.max(CARGO_OVERLAY_MIN_CELL_SIZE, computed));
}

export function cargoOverlayFrameWidth(cellSize: number): number {
  return CARGO_GRID_COLS * cellSize + (CARGO_GRID_COLS - 1) * CARGO_CELL_GAP;
}
