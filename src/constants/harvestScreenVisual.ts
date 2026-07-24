import {
  SCANNER_BORDER_QUIET,
  SCANNER_DOSSIER_SURFACE,
  SCANNER_FIELD_SURROUND,
  SCANNER_INSTRUMENT_SURFACE,
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

export const HARVEST_PANEL_BORDER = SCANNER_BORDER_QUIET;
export const HARVEST_PANEL_BG = SCANNER_INSTRUMENT_SURFACE;
export const HARVEST_CARGO_SURFACE = SCANNER_DOSSIER_SURFACE;

export const HARVEST_CONTAINMENT_BG = 'rgba(4, 10, 9, 0.72)';
export const HARVEST_CONTAINMENT_BORDER = SCANNER_BORDER_QUIET;
export const HARVEST_FIELD_SURROUND = SCANNER_FIELD_SURROUND;

export const HARVEST_GRID_CELL_BORDER = 'rgba(108, 156, 143, 0.16)';
export const HARVEST_GRID_CELL_EMPTY_BG = 'rgba(4, 8, 8, 0.88)';

export function resolveHarvestGridCellBackground(options: {
  occupied: boolean;
  isPreview: boolean;
  canDrop: boolean;
  accentColor: string;
}): string {
  const { occupied, isPreview, canDrop, accentColor } = options;

  if (isPreview) {
    return canDrop ? 'rgba(100, 201, 177, 0.22)' : 'rgba(180, 86, 108, 0.22)';
  }

  if (occupied) {
    return `${accentColor}1F`;
  }

  return HARVEST_GRID_CELL_EMPTY_BG;
}
