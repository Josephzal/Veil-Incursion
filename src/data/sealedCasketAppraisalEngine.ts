import type { AppraisalValueBand } from '../types/sealedCargo';
import { SEALED_CASKET_CONFIG } from './sealedCargoEngine';

const BAND_WEIGHTS: Array<{ band: AppraisalValueBand; weight: number }> = [
  { band: 'LOW_VALUE', weight: 25 },
  { band: 'STANDARD_VALUE', weight: 35 },
  { band: 'HIGH_VALUE', weight: 22 },
  { band: 'RARE_VALUE', weight: 13 },
  { band: 'APEX_VALUE', weight: 5 },
];

export const APPRAISAL_BAND_LABELS: Record<AppraisalValueBand, string> = {
  LOW_VALUE: 'Low-value containment debris',
  STANDARD_VALUE: 'Standard contraband cache',
  HIGH_VALUE: 'High-value weaponized cargo',
  RARE_VALUE: 'Rare anomalous asset',
  APEX_VALUE: 'Apex containment breach',
};

export const APPRAISED_SELL_VALUES: Record<AppraisalValueBand, number> = {
  LOW_VALUE: 125,
  STANDARD_VALUE: 175,
  HIGH_VALUE: 250,
  RARE_VALUE: 375,
  APEX_VALUE: 500,
};

let debugForcedBand: AppraisalValueBand | null = null;

export function setDebugForcedAppraisalBand(band: AppraisalValueBand | null): void {
  debugForcedBand = band;
}

export function rollAppraisalValueBand(rng: () => number = Math.random): AppraisalValueBand {
  if (debugForcedBand) return debugForcedBand;
  const total = BAND_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of BAND_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.band;
  }
  return 'STANDARD_VALUE';
}

export function getAppraisalBandLabel(band: AppraisalValueBand): string {
  return APPRAISAL_BAND_LABELS[band];
}

export function getAppraisedSealedSellValue(band: AppraisalValueBand | undefined): number {
  if (!band) return SEALED_CASKET_CONFIG.sealedSellValue;
  return APPRAISED_SELL_VALUES[band];
}

export function resolveSealedSellValue(
  sealedState: 'SEALED' | 'APPRAISED',
  valueBand?: AppraisalValueBand,
): number {
  if (sealedState === 'APPRAISED' && valueBand) {
    return getAppraisedSealedSellValue(valueBand);
  }
  return SEALED_CASKET_CONFIG.sealedSellValue;
}

export function resolveOpeningFee(wasAppraised: boolean): number {
  if (wasAppraised && SEALED_CASKET_CONFIG.openingFeeWaivedIfAppraised) {
    return 0;
  }
  return SEALED_CASKET_CONFIG.openingFee;
}
