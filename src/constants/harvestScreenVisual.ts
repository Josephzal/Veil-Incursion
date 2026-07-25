import {
  SCANNER_PHOSPHOR,
  SCANNER_TEXT_PRIMARY,
  SCANNER_TEXT_SECONDARY,
  SCANNER_VEIL_VIOLET,
} from '../components/scanner/vectorScannerShared';

/** Align harvest chrome with Field Scanner / Veil operational surfaces. */
export const HARVEST_MUTED_SLATE = SCANNER_TEXT_SECONDARY;
export const HARVEST_TEXT_PRIMARY = SCANNER_TEXT_PRIMARY;
export const HARVEST_PHOSPHOR = SCANNER_PHOSPHOR;
export const HARVEST_VEIL_VIOLET = SCANNER_VEIL_VIOLET;
export const HARVEST_DANGER = 'rgba(180, 86, 108, 0.92)';

/** Near-transparent containment — environment stays visible beneath. */
export const HARVEST_CONTAINMENT_BG = 'rgba(2, 8, 7, 0.04)';
export const HARVEST_CONTAINMENT_BORDER = 'rgba(91, 224, 195, 0.10)';
/** Stronger gradient only behind upper HUD labels; floor stays readable. */
export const HARVEST_CONTAINMENT_SCRIM_TOP = 'rgba(2, 6, 6, 0.18)';
export const HARVEST_CONTAINMENT_SCRIM_BOTTOM = 'rgba(2, 6, 6, 0.01)';

/** Extractor / status instruments — translucent HUD, not opaque panels. */
export const HARVEST_INSTRUMENT_BG = 'rgba(4, 12, 11, 0.78)';
export const HARVEST_STATUS_STRIP_BG = 'rgba(4, 12, 11, 0.72)';
export const HARVEST_PANEL_BORDER = 'rgba(91, 224, 195, 0.14)';
export const HARVEST_PANEL_BG = HARVEST_INSTRUMENT_BG;

/** Cargo rail stays mostly opaque for inventory readability. */
export const HARVEST_CARGO_SURFACE = 'rgba(3, 10, 9, 0.94)';
export const HARVEST_CARGO_BORDER = 'rgba(100, 201, 177, 0.20)';

/** Quiet empty cells — readable without dominating the rail. */
export const HARVEST_GRID_CELL_BORDER = 'rgba(126, 139, 133, 0.15)';
export const HARVEST_GRID_CELL_EMPTY_BG = 'rgba(1, 5, 4, 0.55)';
export const HARVEST_GRID_CELL_OCCUPIED_BG = 'rgba(8, 16, 14, 0.42)';
export const HARVEST_GRID_CELL_SELECTED_BORDER = 'rgba(118, 78, 176, 0.72)';
export const HARVEST_GRID_CELL_VALID_BORDER = 'rgba(100, 201, 177, 0.55)';
export const HARVEST_GRID_CELL_INVALID_BORDER = 'rgba(180, 86, 108, 0.62)';

export function resolveHarvestGridCellBackground(options: {
  occupied: boolean;
  isPreview: boolean;
  canDrop: boolean;
  selected?: boolean;
}): string {
  const { occupied, isPreview, canDrop } = options;

  if (isPreview) {
    return canDrop ? 'rgba(100, 201, 177, 0.14)' : 'rgba(180, 86, 108, 0.16)';
  }

  if (occupied) {
    return HARVEST_GRID_CELL_OCCUPIED_BG;
  }

  return HARVEST_GRID_CELL_EMPTY_BG;
}

export function resolveHarvestGridCellBorder(options: {
  occupied: boolean;
  isPreview: boolean;
  canDrop: boolean;
  selected?: boolean;
}): string {
  const { isPreview, canDrop, selected } = options;
  if (isPreview) {
    return canDrop ? HARVEST_GRID_CELL_VALID_BORDER : HARVEST_GRID_CELL_INVALID_BORDER;
  }
  if (selected) {
    return HARVEST_GRID_CELL_SELECTED_BORDER;
  }
  return HARVEST_GRID_CELL_BORDER;
}
