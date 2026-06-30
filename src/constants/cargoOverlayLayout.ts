import { CARGO_CELL_GAP, CARGO_CELL_SIZE } from './cargoGridLayout';
import { COMBAT_POPUP_SCALE } from './combatOverlayTypography';
import { HARVEST_EXTERNAL_BAY_HEIGHT, HARVEST_EXTERNAL_BAY_MARGIN_TOP } from './harvestLayout';
import { resolveImmersiveFooterInset } from './immersiveLayout';
import { CARGO_GRID_COLS, CARGO_GRID_ROWS } from '../types/cargoGrid';

export const CARGO_OVERLAY_PANEL_PADDING = 14;
export const COMBAT_OVERLAY_PANEL_PADDING = Math.round(10 * COMBAT_POPUP_SCALE);
export const CARGO_OVERLAY_HEADER_RESERVE = 40;
export const CARGO_OVERLAY_BACKDROP_PADDING = 16;
export const CARGO_OVERLAY_COMBAT_DETAIL_HEIGHT = 168;
export const CARGO_OVERLAY_SCANNER_BUTTON_HEIGHT = 32;
export const CARGO_OVERLAY_BOARD_GAP = 12;
export const CARGO_OVERLAY_MIN_CELL_SIZE = 36;

/** Horizontal split inside the combat cargo modal content area. */
export const COMBAT_OVERLAY_GRID_SHARE = 0.65;
export const COMBAT_OVERLAY_DETAIL_SHARE = 0.35;
export const COMBAT_OVERLAY_SPLIT_GAP = 8;

export function resolveCombatOverlaySplitWidths(frameWidth: number): {
  gridWidth: number;
  detailWidth: number;
} {
  const detailWidth = Math.floor(frameWidth * COMBAT_OVERLAY_DETAIL_SHARE / COMBAT_OVERLAY_GRID_SHARE);
  return {
    gridWidth: frameWidth,
    detailWidth,
  };
}

export function resolveCombatOverlayContentWidth(cellSize: number): number {
  const frameWidth = cargoOverlayFrameWidth(cellSize);
  const { detailWidth } = resolveCombatOverlaySplitWidths(frameWidth);
  return frameWidth + COMBAT_OVERLAY_SPLIT_GAP + detailWidth;
}

export function resolveCombatOverlayPanelWidthFromCellSize(cellSize: number): number {
  return resolveCombatOverlayContentWidth(cellSize) + COMBAT_OVERLAY_PANEL_PADDING * 2;
}

export function resolveCombatOverlayCellSize(
  screenHeight: number,
  bottomInset: number,
): number {
  const footerInset = resolveImmersiveFooterInset(bottomInset);
  const availableHeight =
    screenHeight
    - CARGO_OVERLAY_BACKDROP_PADDING * 2
    - COMBAT_OVERLAY_PANEL_PADDING * 2
    - CARGO_OVERLAY_HEADER_RESERVE
    - footerInset
    - CARGO_OVERLAY_BOARD_GAP;
  const heightCell = Math.floor(
    (availableHeight - (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP) / CARGO_GRID_ROWS,
  );

  return Math.min(
    CARGO_CELL_SIZE,
    Math.max(CARGO_OVERLAY_MIN_CELL_SIZE, Math.floor(heightCell * COMBAT_POPUP_SCALE)),
  );
}

export function resolveCargoOverlayCellSize(
  screenHeight: number,
  screenWidth: number,
  bottomInset: number,
  options: {
    hasContainment: boolean;
    scannerButtonCount: number;
  },
): number {
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
    return resolveCombatOverlayPanelWidthFromCellSize(cellSize);
  }
  return cargoOverlayPanelWidthFromCellSize(cellSize);
}
