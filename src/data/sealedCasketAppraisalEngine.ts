import type { AppraisalValueBand, SealedContainerResourceId } from '../types/sealedCargo';
import {
  BLACKSITE_SPECIMEN_JAR_ID,
  SEALED_CONTAINMENT_CASKET_ID,
} from '../types/sealedCargo';
import type { ResourceItemId } from '../types/resourceItem';
import { getSealedCargoConfig, SEALED_CASKET_CONFIG, SEALED_SPECIMEN_JAR_CONFIG } from './sealedCargoEngine';

const CASKET_BAND_WEIGHTS: Array<{ band: AppraisalValueBand; weight: number }> = [
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

export const JAR_APPRAISAL_BAND_LABELS: Record<AppraisalValueBand, string> = {
  LOW_VALUE: 'Degraded specimen residue',
  STANDARD_VALUE: 'Standard blacksite specimen',
  HIGH_VALUE: 'Volatile lab specimen',
  RARE_VALUE: 'Rare containment sample',
  APEX_VALUE: 'Apex blacksite sample',
};

export const APPRAISED_SELL_VALUES: Record<AppraisalValueBand, number> = {
  LOW_VALUE: 125,
  STANDARD_VALUE: 175,
  HIGH_VALUE: 250,
  RARE_VALUE: 375,
  APEX_VALUE: 500,
};

/** Softer payout curve for Specimen Jar (minor sibling). */
export const JAR_APPRAISED_SELL_VALUES: Record<AppraisalValueBand, number> = {
  LOW_VALUE: 60,
  STANDARD_VALUE: 90,
  HIGH_VALUE: 130,
  RARE_VALUE: 180,
  APEX_VALUE: 250,
};

let debugForcedBand: AppraisalValueBand | null = null;

export function setDebugForcedAppraisalBand(band: AppraisalValueBand | null): void {
  debugForcedBand = band;
}

export function rollAppraisalValueBand(rng: () => number = Math.random): AppraisalValueBand {
  if (debugForcedBand) return debugForcedBand;
  const total = CASKET_BAND_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of CASKET_BAND_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.band;
  }
  return 'STANDARD_VALUE';
}

export function getAppraisalBandLabel(
  band: AppraisalValueBand,
  resourceId: ResourceItemId = SEALED_CONTAINMENT_CASKET_ID,
): string {
  if (resourceId === BLACKSITE_SPECIMEN_JAR_ID) {
    return JAR_APPRAISAL_BAND_LABELS[band];
  }
  return APPRAISAL_BAND_LABELS[band];
}

export function getAppraisedSealedSellValue(
  band: AppraisalValueBand | undefined,
  resourceId: ResourceItemId = SEALED_CONTAINMENT_CASKET_ID,
): number {
  const config = getSealedCargoConfig(resourceId) ?? SEALED_CASKET_CONFIG;
  if (!band) return config.sealedSellValue;
  if (resourceId === BLACKSITE_SPECIMEN_JAR_ID) {
    return JAR_APPRAISED_SELL_VALUES[band];
  }
  return APPRAISED_SELL_VALUES[band];
}

export function resolveSealedSellValue(
  sealedState: 'SEALED' | 'APPRAISED',
  valueBand?: AppraisalValueBand,
  resourceId: ResourceItemId = SEALED_CONTAINMENT_CASKET_ID,
): number {
  const config = getSealedCargoConfig(resourceId) ?? SEALED_CASKET_CONFIG;
  if (sealedState === 'APPRAISED' && valueBand) {
    return getAppraisedSealedSellValue(valueBand, resourceId);
  }
  return config.sealedSellValue;
}

export function resolveOpeningFee(
  wasAppraised: boolean,
  resourceId: ResourceItemId = SEALED_CONTAINMENT_CASKET_ID,
): number {
  const config = getSealedCargoConfig(resourceId) ?? SEALED_CASKET_CONFIG;
  if (wasAppraised && config.openingFeeWaivedIfAppraised) {
    return 0;
  }
  return config.openingFee;
}

export function getSealedAppraisalFee(resourceId: ResourceItemId): number {
  return (getSealedCargoConfig(resourceId) ?? SEALED_CASKET_CONFIG).appraisalFee;
}

export function sealedContainerShortLabel(resourceId: SealedContainerResourceId): string {
  return resourceId === BLACKSITE_SPECIMEN_JAR_ID ? 'Specimen Jar' : 'Containment Casket';
}

export { SEALED_SPECIMEN_JAR_CONFIG };
