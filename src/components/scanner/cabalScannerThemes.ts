import { CabalScannerTheme, ScannerCabal } from '../../types/scanner';

export const CABAL_SCANNER_THEMES: Record<ScannerCabal, CabalScannerTheme> = {
  TERRAN_GRID: {
    primary: '#FFFFFF',
    line: '#64748B',
    backdrop: '#1A1C1E',
    text: '#F8FAFC',
    blipAccent: '#CBD5E1',
    borderStyle: 'solid',
    sweepGlow: 'rgba(255, 255, 255, 0.85)',
  },
  LEGION: {
    primary: '#8B5CF6',
    line: '#5B21B6',
    backdrop: '#030303',
    text: '#DDD6FE',
    blipAccent: '#A78BFA',
    borderStyle: 'dashed',
    sweepGlow: 'rgba(139, 92, 246, 0.9)',
  },
  SOLARIS: {
    primary: '#EF4444',
    line: '#991B1B',
    backdrop: '#171717',
    text: '#FEE2E2',
    blipAccent: '#FFD700',
    borderStyle: 'solid',
    sweepGlow: 'rgba(239, 68, 68, 0.9)',
  },
};

export function getCabalScannerTheme(cabal: ScannerCabal): CabalScannerTheme {
  return CABAL_SCANNER_THEMES[cabal];
}
