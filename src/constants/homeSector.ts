import type { MacroSectorId } from '../types/regional';

/** Player home macro-sector — US Pacific coast (Seattle grid). */
export const DEFAULT_HOME_MACRO_SECTOR = 'PACIFIC' satisfies MacroSectorId;

export const DEFAULT_HOME_METROPOLITAN_NODE = 'SEATTLE CORE';

export const DEFAULT_HOME_SECTOR_PROFILE_LABEL = 'PACIFIC // US';

export function formatHomeSectorDisplay(sectorId: MacroSectorId, sectorLabel: string): string {
  if (sectorId === DEFAULT_HOME_MACRO_SECTOR) {
    return 'Pacific // US';
  }
  return sectorLabel
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
