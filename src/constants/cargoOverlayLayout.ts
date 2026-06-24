import { CARGO_CELL_GAP, CARGO_CELL_SIZE } from '../components/CargoGridBoard';
import { HARVEST_EXTERNAL_BAY_HEIGHT, HARVEST_EXTERNAL_BAY_MARGIN_TOP } from './harvestLayout';
import { resolveImmersiveFooterInset } from './immersiveLayout';
import { CARGO_GRID_COLS, CARGO_GRID_ROWS } from '../types/cargoGrid';

export const CARGO_OVERLAY_PANEL_PADDING = 14;
export const CARGO_OVERLAY_HEADER_RESERVE = 40;
export const CARGO_OVERLAY_BACKDROP_PADDING = 16;
export const CARGO_OVERLAY_COMBAT_DETAIL_HEIGHT = 168;
export const CARGO_OVERLAY_SCANNER_BUTTON_HEIGHT = 32;
export const CARGO_OVERLAY_BOARD_GAP = 12;
export const CARGO_OVERLAY_MIN_CELL_SIZE = 36;

/** Compact inventory grid inside the wide combat cargo modal. */
export const COMBAT_OVERLAY_GRID_CELL_SIZE = 30;
export const COMBAT_OVERLAY_PANEL_WIDTH_RATIO = 0.64;
export const COMBAT_OVERLAY_SPLIT_GAP = 12;

export function resolveCargoOverlayCellSize(
  screenHeight: number,
  screenWidth: number,
  bottomInset: number,
  options: {
    combatMode: boolean;
    hasContainment: boolean;
    scannerButtonCount: number;
  },
): number {
  if (options.combatMode) {
    return COMBAT_OVERLAY_GRID_CELL_SIZE;
  }

  const footerInset = resolveImmersiveFooterInset(bottomInset);
  const externalBayReserve = options.hasContainment
    ? HARVEST_EXTERNAL_BAY_HEIGHT + HARVEST_EXTERNAL_BAY_MARGIN_TOP
    : 0;
  const scannerReserve = options.scannerButtonCount > 0
    ? options.scannerButtonCount * (CARGO_OVERLAY_SCANNER_BUTTON_HEIGHT + 8)
    : 0;

  const availableHeight =
    screenHeight
    - CARGO_OVERLAY_BACKDROP_PADDING * 2
    - CARGO_OVERLAY_PANEL_PADDING * 2
    - CARGO_OVERLAY_HEADER_RESERVE
    - footerInset
    - externalBayReserve
    - scannerReserve
    - CARGO_OVERLAY_BOARD_GAP;

  const heightCell = Math.floor(
    (availableHeight - (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP) / CARGO_GRID_ROWS,
  );
  return Math.min(CARGO_CELL_SIZE, Math.max(CARGO_OVERLAY_MIN_CELL_SIZE, heightCell));
}

export function resolveCombatOverlayPanelWidth(screenWidth: number): number {
  return Math.floor(screenWidth * COMBAT_OVERLAY_PANEL_WIDTH_RATIO);
}

export function cargoOverlayFrameWidth(cellSize: number): number {
  return CARGO_GRID_COLS * cellSize + (CARGO_GRID_COLS - 1) * CARGO_CELL_GAP;
}

export function cargoOverlayFrameHeight(cellSize: number): number {
  return CARGO_GRID_ROWS * cellSize + (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP;
}

export function cargoOverlayPanelWidthFromCellSize(cellSize: number): number {
  return cargoOverlayFrameWidth(cellSize) + CARGO_OVERLAY_PANEL_PADDING * 2 + 4;
}

export function resolveOverlayPanelWidth(
  screenWidth: number,
  cellSize: number,
  combatMode: boolean,
): number {
  if (combatMode) {
    return resolveCombatOverlayPanelWidth(screenWidth);
  }
  return cargoOverlayPanelWidthFromCellSize(cellSize);
}
