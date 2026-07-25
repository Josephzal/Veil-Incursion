import { CARGO_GRID_COLS, CARGO_GRID_ROWS } from '../types/cargoGrid';
import { CARGO_CELL_GAP, cargoGridFrameDimensions } from '../components/CargoGridBoard';
import {
  HUB_CARGO_MAT_INSET,
  resolveHubCargoMatShellMetrics,
} from '../constants/cargoGridVisual';
import { getGridMetrics } from './layoutGrid';

export interface CargoGridWindowMetrics {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
  cellSize: number;
  cellGap: number;
}

export function resolveCargoGridCellFromWindow(
  absoluteX: number,
  absoluteY: number,
  metrics: CargoGridWindowMetrics,
): { row: number; col: number } | null {
  const stride = metrics.cellSize + metrics.cellGap;
  const localX = absoluteX - metrics.pageX;
  const localY = absoluteY - metrics.pageY;
  if (localX < 0 || localY < 0 || localX >= metrics.width || localY >= metrics.height) return null;
  const col = Math.floor(localX / stride);
  const row = Math.floor(localY / stride);
  if (row < 0 || col < 0 || row >= CARGO_GRID_ROWS || col >= CARGO_GRID_COLS) return null;
  return { row, col };
}

export function pointInWindowRect(
  x: number,
  y: number,
  rect: { pageX: number; pageY: number; width: number; height: number },
  padding = 0,
): boolean {
  return x >= rect.pageX - padding
    && x <= rect.pageX + rect.width + padding
    && y >= rect.pageY - padding
    && y <= rect.pageY + rect.height + padding;
}

export function resolveSplitLanes(
  contentWidth: number,
  gap: number,
  leftRatio: number,
): { leftWidth: number; rightWidth: number } {
  const inner = Math.max(0, contentWidth - gap);
  const leftWidth = Math.floor(inner * leftRatio);
  const rightWidth = Math.max(0, inner - leftWidth);
  return { leftWidth, rightWidth };
}

/** Column width for cards inside a nested panel lane. */
export function resolveLaneColumnWidth(
  laneWidth: number,
  lanePadding: number,
  columns: number,
  gap: number,
): number {
  return getGridMetrics(Math.max(0, laneWidth - lanePadding * 2), columns, gap).columnWidth;
}

/** Width of hub stash icon boxes — matches HubCargoIconBox (`iconSize + 16`). */
export function resolveHubStashIconSquareSize(iconSize: number): number {
  return iconSize + 16;
}

/** Hub cargo grids (loadout, extraction, black market) render 20% larger than legacy baseline. */
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

/** Fit cargo grid cells to the available pane — prefers target size when it fits. */
export function resolveHubLoadoutCellSize(
  areaWidth: number,
  areaHeight: number,
  targetCellSize = HUB_CARGO_DEFAULT_TARGET,
  maxCellSize = targetCellSize,
  cellGap = CARGO_CELL_GAP,
): number {
  if (areaWidth <= 0 || areaHeight <= 0) {
    return targetCellSize;
  }
  const maxByWidth = Math.floor((areaWidth - (CARGO_GRID_COLS - 1) * cellGap) / CARGO_GRID_COLS);
  const maxByHeight = Math.floor((areaHeight - (CARGO_GRID_ROWS - 1) * cellGap) / CARGO_GRID_ROWS);
  const fitted = Math.min(maxByWidth, maxByHeight);

  if (fitted <= 0) {
    return targetCellSize;
  }

  if (fitted >= targetCellSize) {
    if (maxCellSize > targetCellSize) {
      return Math.min(fitted, maxCellSize);
    }
    return targetCellSize;
  }

  return Math.max(scaleHubCargoCellSize(38), Math.min(fitted, Math.max(targetCellSize, maxCellSize)));
}

/** Like resolveHubLoadoutCellSize but ensures the hub cargo mat shell fits inside the pane. */
export function resolveHubMatAwareLoadoutCellSize(
  areaWidth: number,
  areaHeight: number,
  scaleSpacing: (value: number) => number,
  targetCellSize = HUB_CARGO_INCURSION_CELL_TARGET,
  maxCellSize = HUB_CARGO_INCURSION_CELL_MAX,
  matInset = HUB_CARGO_MAT_INSET,
): number {
  if (areaWidth <= 0 || areaHeight <= 0) {
    return targetCellSize;
  }

  let cellSize = resolveHubLoadoutCellSize(areaWidth, areaHeight, targetCellSize, maxCellSize);
  const minCell = scaleHubCargoCellSize(38);

  while (cellSize > minCell) {
    const frame = cargoGridFrameDimensions(cellSize);
    const mat = resolveHubCargoMatShellMetrics(
      frame.frameWidth,
      frame.frameHeight,
      scaleSpacing,
      matInset,
    );
    if (mat.width <= areaWidth && mat.height <= areaHeight) {
      return cellSize;
    }
    cellSize -= 1;
  }

  return Math.max(minCell, cellSize);
}
