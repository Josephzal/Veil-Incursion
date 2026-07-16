/**
 * Combat Refactor Phase 5 — reward / risk matching.
 */

import type {
  CombatDirectorContext,
  CombatRewardRiskResult,
  EncounterPressureScore,
} from '../types/combatDirector';
import { COMBAT_DIRECTOR_BALANCE } from './balance/combatDirectorBalanceConfig';
import { isEarlyDepth1 } from './combatDirectorDensityEngine';

export function resolveEncounterRewardRiskAdjustment(
  ctx: CombatDirectorContext,
  pressure: EncounterPressureScore,
): CombatRewardRiskResult {
  const c = COMBAT_DIRECTOR_BALANCE;
  const early = isEarlyDepth1(ctx);

  let rewardMultiplier: number = c.rewardMultiplierLow;
  let rareLootBonusPct = 0;
  let creditsBonusPct = 0;
  let debriefCallout: string | null = null;
  let allowedInContext = true;

  if (pressure.label === 'HIGH') {
    rewardMultiplier = c.rewardMultiplierHigh;
    rareLootBonusPct = c.rareLootBonusHighPct;
    creditsBonusPct = c.creditsBonusHighPct;
    debriefCallout = 'High-pressure engagement — elevated salvage weight.';
  } else if (pressure.label === 'CRITICAL') {
    rewardMultiplier = c.rewardMultiplierCritical;
    rareLootBonusPct = c.rareLootBonusCriticalPct;
    creditsBonusPct = c.creditsBonusCriticalPct;
    debriefCallout = 'Critical-pressure engagement — premium salvage emphasis.';
    allowedInContext = Boolean(
      ctx.isEliteEncounter
      || ctx.isBossEncounter
      || ctx.isDirtyExtraction
      || ctx.isHighRiskNode
      || ctx.depth >= 2,
    );
    if (early && !allowedInContext) {
      // Safety should have softened; still flag mismatch if CRITICAL remains early.
      debriefCallout = 'Critical pressure on early Depth 1 — safety soft expected.';
    }
  }

  return {
    pressureLabel: pressure.label,
    rewardMultiplier,
    rareLootBonusPct,
    creditsBonusPct,
    debriefCallout,
    allowedInContext,
  };
}
