import { CARGO_GRID_COLS, CARGO_GRID_ROWS } from '../types/cargoGrid';
import { CARGO_CELL_GAP } from '../components/CargoGridBoard';

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
): boolean {
  return x >= rect.pageX
    && x <= rect.pageX + rect.width
    && y >= rect.pageY
    && y <= rect.pageY + rect.height;
}

/** Fit cargo grid cells within the deployment pack content area. */
export function resolveHubLoadoutCellSize(areaWidth: number, areaHeight: number): number {
  if (areaWidth <= 0 || areaHeight <= 0) return 44;
  const maxByWidth = Math.floor((areaWidth - (CARGO_GRID_COLS - 1) * CARGO_CELL_GAP) / CARGO_GRID_COLS);
  const maxByHeight = Math.floor((areaHeight - (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP) / CARGO_GRID_ROWS);
  const fitted = Math.min(maxByWidth, maxByHeight);
  return Math.max(38, Math.min(50, fitted));
}
