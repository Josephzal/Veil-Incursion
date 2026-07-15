import type { RunWorldBrief } from '../types/runWorldBrief';
import type {
  ProceduralDirectorAdjustment,
  ProceduralDirectorContext,
  ProceduralDirectorIssue,
  RunPressureScore,
  SafetyCapResult,
} from '../types/proceduralDirector';
import { clampMultiplier } from './runWorldBriefBiasEngine';

export function applyProceduralSafetyCaps(
  brief: RunWorldBrief,
  pressure: RunPressureScore,
  _context?: ProceduralDirectorContext,
): SafetyCapResult {
  const issues: ProceduralDirectorIssue[] = [];
  const adjustments: ProceduralDirectorAdjustment[] = [];
  let next = {
    ...brief,
    scannerBias: { ...brief.scannerBias, overlayBias: { ...brief.scannerBias.overlayBias } },
    encounterBias: { ...brief.encounterBias, favoredModifiers: { ...brief.encounterBias.favoredModifiers } },
    rewardBias: { ...brief.rewardBias },
  };

  const overlay = next.scannerBias.overlayBias;
  const multiOverlayCount = [
    overlay.highRisk > 1.1,
    overlay.highValueResource > 1.1,
    overlay.anchorSignal > 1.1,
    overlay.echoSignal > 1.1,
  ].filter(Boolean).length;

  if (multiOverlayCount >= 4) {
    issues.push({
      id: 'OVERLAY_DENSITY_HIGH',
      severity: 'WARNING',
      category: 'OVERLOADED_PRESSURE',
      message: 'Too many scanner overlays stacked on brief.',
      suggestedFix: 'Reduce overlay weights.',
    });
    const before = overlay.highRisk;
    overlay.highRisk = Math.max(1, before * 0.92);
    adjustments.push({
      id: 'CAP_OVERLAY_DENSITY',
      reason: 'Reduced high-risk overlay to cap density',
      before,
      after: overlay.highRisk,
      applied: true,
    });
  }

  if (pressure.scannerUncertainty > 65) {
    issues.push({
      id: 'SCANNER_UNCERTAINTY_HIGH',
      severity: 'WARNING',
      category: 'FAIRNESS',
      message: 'Scanner uncertainty is high — hidden lethal risk possible.',
    });
    const before = overlay.scannerLabelDegrade;
    overlay.scannerLabelDegrade = Math.min(0.25, before * 0.85);
    overlay.extractionUncertainty = Math.min(0.28, overlay.extractionUncertainty * 0.9);
    adjustments.push({
      id: 'CAP_SCANNER_UNCERTAINTY',
      reason: 'Soft-capped scanner degradation',
      before,
      after: overlay.scannerLabelDegrade,
      applied: true,
    });
  }

  if (pressure.extractionPressure > 70) {
    issues.push({
      id: 'EXTRACTION_PRESSURE_HIGH',
      severity: 'WARNING',
      category: 'OVERLOADED_PRESSURE',
      message: 'Extraction pressure is high.',
    });
    next.rewardBias.rareLootMultiplier = clampMultiplier(next.rewardBias.rareLootMultiplier * 1.08);
    adjustments.push({
      id: 'BOOST_EXTRACTION_REWARD',
      reason: 'Raised rare loot for high extraction pressure',
      applied: true,
    });
  }

  if (pressure.label === 'CRITICAL' && next.rewardBias.rareLootMultiplier <= 1.05) {
    issues.push({
      id: 'REWARD_RISK_MISMATCH',
      severity: 'WARNING',
      category: 'REWARD_MISMATCH',
      message: 'Critical pressure without reward increase.',
    });
    const before = next.rewardBias.rareLootMultiplier;
    next.rewardBias = {
      ...next.rewardBias,
      rareLootMultiplier: clampMultiplier(before * 1.12),
      sectorResourceMultiplier: clampMultiplier(next.rewardBias.sectorResourceMultiplier * 1.08),
    };
    adjustments.push({
      id: 'BOOST_CRITICAL_REWARD',
      reason: 'Matched rewards to critical pressure',
      before,
      after: next.rewardBias.rareLootMultiplier,
      applied: true,
    });
  }

  if (pressure.elitePressure > 75 && next.encounterBias.eliteWeight > 1.1) {
    const before = next.encounterBias.eliteWeight;
    next.encounterBias.eliteWeight = Math.max(1, before * 0.94);
    adjustments.push({
      id: 'CAP_ELITE_WEIGHT',
      reason: 'Soft-capped elite weight',
      before,
      after: next.encounterBias.eliteWeight,
      applied: true,
    });
  }

  return { issues, adjustments, brief: next };
}
