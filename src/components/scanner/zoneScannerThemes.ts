import type { SectorZoneId } from '../../types/sectorPacing';
import type { CabalScannerTheme } from '../../types/scanner';

/** Zone tint overlays merged atop cabal scanner chrome. */
export const ZONE_SCANNER_TINTS: Record<SectorZoneId, Partial<CabalScannerTheme>> = {
  OUTSKIRTS: {
    sweepGlow: 'rgba(100, 200, 140, 0.55)',
    blipAccent: '#86efac',
    line: '#3f6212',
  },
  DEEP_TRANSIT: {
    sweepGlow: 'rgba(56, 189, 248, 0.6)',
    blipAccent: '#7dd3fc',
    line: '#0c4a6e',
  },
  BREACH_PERIMETER: {
    sweepGlow: 'rgba(251, 191, 36, 0.65)',
    blipAccent: '#fcd34d',
    line: '#92400e',
  },
  INNER_SANCTUM: {
    sweepGlow: 'rgba(239, 68, 68, 0.7)',
    blipAccent: '#fca5a5',
    line: '#7f1d1d',
  },
  COLLAPSE: {
    sweepGlow: 'rgba(168, 85, 247, 0.85)',
    blipAccent: '#e9d5ff',
    line: '#581c87',
    borderStyle: 'dashed',
  },
};

export function getZoneScannerTint(zone: SectorZoneId): Partial<CabalScannerTheme> {
  return ZONE_SCANNER_TINTS[zone];
}

export function mergeScannerThemes(
  cabal: CabalScannerTheme,
  zoneTint: Partial<CabalScannerTheme>,
): CabalScannerTheme {
  return { ...cabal, ...zoneTint };
}
