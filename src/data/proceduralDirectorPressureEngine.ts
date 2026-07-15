import type { RunWorldBrief } from '../types/runWorldBrief';
import type { ProceduralDirectorContext, RunPressureLabel, RunPressureScore } from '../types/proceduralDirector';
import { EMPTY_PRESSURE_SCORE } from '../types/proceduralDirector';

function clampPressure(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function pressureLabel(total: number): RunPressureLabel {
  if (total <= 30) return 'LOW';
  if (total <= 55) return 'MODERATE';
  if (total <= 75) return 'HIGH';
  return 'CRITICAL';
}

export function scoreRunPressure(
  brief: RunWorldBrief | null | undefined,
  context?: ProceduralDirectorContext,
): RunPressureScore {
  if (!brief) return { ...EMPTY_PRESSURE_SCORE };

  const threat = brief.threatProfile;
  const overlay = brief.scannerBias.overlayBias;
  const encounter = brief.encounterBias;

  const combatPressure = clampPressure(
    threat.unstablePressure * 0.35
    + threat.containmentPressure * 0.2
    + (encounter.eliteWeight > 1 ? (encounter.eliteWeight - 1) * 80 : 0),
  );
  const elitePressure = clampPressure(
    (encounter.eliteWeight - 1) * 90
    + threat.anchorPressure * 0.15,
  );
  const scannerUncertainty = clampPressure(
    overlay.scannerLabelDegrade * 200
    + overlay.extractionUncertainty * 180
    + Math.max(0, overlay.extraction - 1) * 40,
  );
  const extractionPressure = clampPressure(
    threat.extractionPressure
    + overlay.extractionUncertainty * 120
    + Math.max(0, overlay.extraction - 1) * 35,
  );
  const cargoPressure = clampPressure(
    threat.unstablePressure * 0.25
    + (encounter.unstableCargoWeight > 1 ? (encounter.unstableCargoWeight - 1) * 70 : 0),
  );
  const unstablePressure = clampPressure(threat.unstablePressure);
  const echoPressure = clampPressure(threat.echoPressure + threat.mirrorPressure * 0.4);
  const anchorPressure = clampPressure(threat.anchorPressure);
  const rivalPressure = clampPressure(
    threat.rivalPressure
    + (encounter.rivalMercWeight > 1 ? (encounter.rivalMercWeight - 1) * 60 : 0),
  );
  const rewardPressure = clampPressure(
    50 - (brief.rewardBias.rareLootMultiplier - 1) * 120
    - (brief.rewardBias.sectorResourceMultiplier - 1) * 80,
  );

  const total = clampPressure(
    combatPressure * 0.12
    + elitePressure * 0.1
    + scannerUncertainty * 0.14
    + extractionPressure * 0.12
    + cargoPressure * 0.08
    + unstablePressure * 0.1
    + echoPressure * 0.1
    + anchorPressure * 0.1
    + rivalPressure * 0.08
    + Math.max(0, rewardPressure) * 0.06,
  );

  const aftermathBoost = (context?.aftermathModifiers?.length ?? 0) * 2;
  const adjustedTotal = clampPressure(total + aftermathBoost);

  return {
    total: adjustedTotal,
    combatPressure,
    elitePressure,
    scannerUncertainty,
    extractionPressure,
    cargoPressure,
    unstablePressure,
    echoPressure,
    anchorPressure,
    rivalPressure,
    rewardPressure,
    label: pressureLabel(adjustedTotal),
  };
}
