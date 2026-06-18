import type { RunNodeType } from '../types/game';

export type ScannerRevealTone = 'combat' | 'elite' | 'sanctuary' | 'narrative' | 'extract' | 'market' | 'boon';

/** Pale reveal accents for locked + selected scanner pings. */
export const SCANNER_REVEAL_COLORS: Record<ScannerRevealTone, string> = {
  combat: '#fca5a5',
  elite: '#991b1b',
  sanctuary: '#22c55e',
  narrative: '#93c5fd',
  extract: '#fde68a',
  market: '#d8b4fe',
  boon: '#f1f5f9',
};

export function scannerRevealToneForNodeType(nodeType: RunNodeType): ScannerRevealTone {
  switch (nodeType) {
    case 'STANDARD_COMBAT':
    case 'BOSS_COMBAT':
      return 'combat';
    case 'ELITE_COMBAT':
      return 'elite';
    case 'SANCTUARY':
      return 'sanctuary';
    case 'NARRATIVE_EVENT':
      return 'narrative';
    case 'EMERGENCY_EXTRACTION':
    case 'SAFE_ANCHOR_EXTRACTION':
    case 'MASTER_EXTRACTION_LINK':
      return 'extract';
    case 'BLACK_MARKET':
      return 'market';
    case 'RESOURCE_HARVEST':
    case 'VEIL_BLEED_BOON':
      return 'boon';
    default:
      return 'combat';
  }
}

export function scannerRevealColorForNodeType(nodeType: RunNodeType): string {
  return SCANNER_REVEAL_COLORS[scannerRevealToneForNodeType(nodeType)];
}
