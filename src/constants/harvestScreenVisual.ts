import { DOSSIER_BORDER, DOSSIER_FOREGROUND } from './dossierSurface';

export const HARVEST_MUTED_SLATE = '#94A3B8';
export const HARVEST_PANEL_BORDER = '#1e293b';
export const HARVEST_PANEL_BG = 'rgba(15, 23, 42, 0.85)';

export const HARVEST_CONTAINMENT_BG = 'rgba(0, 0, 0, 0.2)';
export const HARVEST_CONTAINMENT_BORDER = 'rgba(51, 65, 85, 0.3)';

export const HARVEST_GRID_CELL_BORDER = DOSSIER_BORDER;
export const HARVEST_GRID_CELL_EMPTY_BG = DOSSIER_FOREGROUND;

export function resolveHarvestGridCellBackground(options: {
  occupied: boolean;
  isPreview: boolean;
  canDrop: boolean;
  accentColor: string;
}): string {
  const { occupied, isPreview, canDrop, accentColor } = options;

  if (isPreview) {
    return canDrop ? `${accentColor}33` : 'rgba(239, 68, 68, 0.22)';
  }

  if (occupied) {
    return `${accentColor}24`;
  }

  return HARVEST_GRID_CELL_EMPTY_BG;
}
