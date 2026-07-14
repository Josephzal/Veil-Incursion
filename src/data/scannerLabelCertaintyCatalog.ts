import type { ProceduralNodeType } from '../types/proceduralRunTree';

export type ScannerLabelCertainty = 'RELIABLE' | 'DEGRADED' | 'STRANGE';

export interface ScannerLabelOverlay {
  certainty: ScannerLabelCertainty;
  displayedType: ProceduralNodeType;
  /** D3 stranger readout — still actionable, not a blank blank. */
  strangeLabel?: string;
}

/** Base degrade chance by district depth (before Distortion/Law bias). */
export const SCANNER_LABEL_BASE_DEGRADE_CHANCE: Record<1 | 2 | 3, number> = {
  1: 0.02,
  2: 0.12,
  3: 0.24,
};

/** Cap combined degrade chance after identity bias. */
export const SCANNER_LABEL_DEGRADE_CHANCE_CAP = 0.55;

/** Of corrupt rolls, chance the result is STRANGE vs DEGRADED. */
export const SCANNER_LABEL_STRANGE_SHARE: Record<1 | 2 | 3, number> = {
  1: 0,
  2: 0.15,
  3: 0.42,
};

/** Nearby swaps — still point at a meaningful vector class. */
export const DEGRADED_TYPE_SWAPS: Record<ProceduralNodeType, readonly ProceduralNodeType[]> = {
  COMBAT: ['ELITE', 'ANOMALY', 'RESOURCE'],
  ELITE: ['COMBAT', 'ANOMALY'],
  ANOMALY: ['COMBAT', 'RESOURCE', 'SANCTUARY'],
  RESOURCE: ['ANOMALY', 'MARKET', 'COMBAT'],
  MARKET: ['RESOURCE', 'SANCTUARY'],
  SANCTUARY: ['MARKET', 'ANOMALY', 'EXTRACTION'],
  EXTRACTION: ['SANCTUARY', 'MARKET'],
  GATEKEEPER: ['ELITE'],
};

/** Strange-but-actionable scanner phrases keyed by true type. */
export const STRANGE_SCANNER_LABELS: Record<ProceduralNodeType, readonly string[]> = {
  COMBAT: ['UNSTABLE HOSTILE CONTACT', 'BLEEDING VECTOR', 'WARPED ENGAGEMENT'],
  ELITE: ['AMPLIFIED CONTACT', 'CROWNED VECTOR', 'HEAVY SIGNATURE'],
  ANOMALY: ['FOLDED SITE', 'NON-EUCLIDEAN SIGNAL', 'DRIFTING ANOMALY'],
  RESOURCE: ['GLOWING CACHE TRACE', 'VEIL HARVEST PING', 'CONTAMINATED YIELD'],
  MARKET: ['BLACK CHANNEL', 'BROKER SHADOW', 'OFF-LEDGER CONTACT'],
  SANCTUARY: ['FALSE QUIET', 'BREATHING SHELTER', 'SOFT LOCK REST'],
  EXTRACTION: ['ROUTE MIRROR', 'EXIT SHIMMER', 'RECALL ECHO'],
  GATEKEEPER: ['ANCHOR GATE PRESSURE', 'TERMINAL THRESHOLD'],
};

/** Node types never lied about on the scanner (always readable). */
export const SCANNER_LABEL_IMMUNE_TYPES: readonly ProceduralNodeType[] = [
  'GATEKEEPER',
];

export function getScannerLabelCertaintyDisplay(certainty: ScannerLabelCertainty): string {
  switch (certainty) {
    case 'RELIABLE':
      return 'RELIABLE';
    case 'DEGRADED':
      return 'DEGRADED';
    case 'STRANGE':
      return 'STRANGE';
    default:
      return 'RELIABLE';
  }
}
