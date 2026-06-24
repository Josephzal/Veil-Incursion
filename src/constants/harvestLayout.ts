import { CARGO_CELL_GAP, CARGO_CELL_SIZE, CARGO_GRID_FRAME_WIDTH } from '../components/CargoGridBoard';
import { LANDSCAPE_PANEL_PADDING } from './landscapeLayout';
import {
  resolveImmersiveContentPadding,
  resolveImmersiveFooterInset,
} from './immersiveLayout';
import { CARGO_GRID_COLS, CARGO_GRID_ROWS } from '../types/cargoGrid';

export const HARVEST_HORIZONTAL_PADDING = 8;
export const GRID_CANISTER_GAP = 6;
export const HARVEST_EXTERNAL_ROW_GAP = 20;
/** Tri-pane harvest column ratios. */
export const HARVEST_LEFT_PANE_RATIO = 0.27;
export const HARVEST_RIGHT_PANE_RATIO = 0.23;
export const HARVEST_TRI_PANE_GAP = 8;
export const HARVEST_CARGO_BACKING_PADDING = 12;
/** Padding below the containment slot row inside the external bay. */
export const HARVEST_EXTERNAL_BAY_EXTRA = 28;
/** Fixed vertical footprint for the harvest containment row (margin + slot height). */
export const HARVEST_EXTERNAL_BAY_HEIGHT = CARGO_CELL_SIZE + HARVEST_EXTERNAL_BAY_EXTRA;
export const HARVEST_HEADER_RESERVE = 36;
export const HARVEST_BOARD_COLUMN_GAP = 6;
export const HARVEST_MIN_CELL_SIZE = 34;
export const HARVEST_EXTERNAL_BAY_MARGIN_TOP = 10;
/** Gap between containment row and pinned footer CTA. */
export const HARVEST_CONTENT_BUFFER = 6;
export const HARVEST_CONTINUE_BUTTON_HEIGHT = 36;

export function harvestExternalBayHeight(cellSize: number): number {
  return cellSize + HARVEST_EXTERNAL_BAY_EXTRA;
}

export function harvestGridFrameHeight(cellSize: number): number {
  return CARGO_GRID_ROWS * cellSize + (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP;
}

export function resolveHarvestFooterSlotHeight(bottomInset = 0): number {
  const footerBottomInset = resolveImmersiveFooterInset(bottomInset);
  return (
    8 // RunEventScreenFrame footer paddingTop
    + 6 // harvest footer band paddingTop
    + HARVEST_CONTINUE_BUTTON_HEIGHT
    + 2 // harvest footer band paddingBottom
    + footerBottomInset
  );
}

export function resolveHarvestCellSize(
  screenHeight: number,
  bottomInset = 0,
  topInset = 0,
): number {
  const framePaddingTop = resolveImmersiveContentPadding(topInset, LANDSCAPE_PANEL_PADDING);
  const framePaddingBottom = LANDSCAPE_PANEL_PADDING;
  const headerReserve = HARVEST_HEADER_RESERVE + HARVEST_BOARD_COLUMN_GAP;

  const fixedChrome =
    framePaddingTop
    + framePaddingBottom
    + headerReserve
    + resolveHarvestFooterSlotHeight(bottomInset)
    + HARVEST_CONTENT_BUFFER;

  const rowGaps = (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP;
  const numerator =
    screenHeight
    - fixedChrome
    - HARVEST_EXTERNAL_BAY_MARGIN_TOP
    - HARVEST_EXTERNAL_BAY_EXTRA
    - rowGaps;

  // Grid rows plus one external containment strip share the same cell size.
  const computed = Math.floor(numerator / (CARGO_GRID_ROWS + 1));

  return Math.min(CARGO_CELL_SIZE, Math.max(HARVEST_MIN_CELL_SIZE, computed));
}

export function resolveHarvestTriPaneCellSize(
  screenHeight: number,
  screenWidth: number,
  topInset = 0,
): number {
  const framePaddingTop = resolveImmersiveContentPadding(topInset, LANDSCAPE_PANEL_PADDING);
  const framePaddingBottom = LANDSCAPE_PANEL_PADDING;
  const headerReserve = HARVEST_HEADER_RESERVE + HARVEST_BOARD_COLUMN_GAP;

  const leftPaneInnerWidth =
    Math.floor(screenWidth * HARVEST_LEFT_PANE_RATIO)
    - HARVEST_CARGO_BACKING_PADDING * 2
    - 2;
  const widthCell = Math.floor(
    (leftPaneInnerWidth - (CARGO_GRID_COLS - 1) * CARGO_CELL_GAP) / CARGO_GRID_COLS,
  );

  const rowGaps = (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP;
  const heightAvailable =
    screenHeight - framePaddingTop - framePaddingBottom - headerReserve - 8;
  const heightCell = Math.floor((heightAvailable - rowGaps) / CARGO_GRID_ROWS);

  return Math.min(
    CARGO_CELL_SIZE,
    Math.max(HARVEST_MIN_CELL_SIZE, Math.min(widthCell, heightCell)),
  );
}

export function resolveHarvestLeftPaneWidth(screenWidth: number): number {
  return Math.floor(screenWidth * HARVEST_LEFT_PANE_RATIO);
}

export function resolveHarvestRightPaneWidth(screenWidth: number): number {
  return Math.floor(screenWidth * HARVEST_RIGHT_PANE_RATIO);
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
