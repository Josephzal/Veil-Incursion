/**
 * Combat Refactor Phase 5 — safety caps / soft adjustments.
 */

import type { EnemyCombatProfile } from '../types/run';
import type {
  CombatDirectorAdjustment,
  CombatDirectorContext,
  CombatDirectorIssue,
  EncounterPressureScore,
  MechanicDensitySnapshot,
} from '../types/combatDirector';
import { COMBAT_DIRECTOR_BALANCE } from './balance/combatDirectorBalanceConfig';
import { isEarlyDepth1 } from './combatDirectorDensityEngine';
import { getIntentCatalogEntry } from './enemyIntentCatalog';

export interface CombatSafetyCapResult {
  enemies: EnemyCombatProfile[];
  adjustments: CombatDirectorAdjustment[];
  issues: CombatDirectorIssue[];
  survivalTurnsRequired?: number;
  incomingDamageMitigationPct: number;
}

function maxPressureFor(ctx: CombatDirectorContext): number {
  const c = COMBAT_DIRECTOR_BALANCE;
  if (isEarlyDepth1(ctx)) return c.depth1EarlyMaxPressure;
  if (ctx.depth === 1) return c.depth1LateMaxPressure;
  if (ctx.depth === 2) return c.depth2NormalMaxPressure;
  return c.depth3NormalMaxPressure;
}

export function applyCombatSafetyCaps(
  ctx: CombatDirectorContext,
  pressure: EncounterPressureScore,
  density: MechanicDensitySnapshot,
  priorIssues: readonly CombatDirectorIssue[],
): CombatSafetyCapResult {
  let enemies = ctx.enemies.map((e) => ({ ...e }));
  const adjustments: CombatDirectorAdjustment[] = [];
  const issues: CombatDirectorIssue[] = [];
  let incomingDamageMitigationPct = 0;
  let survivalTurnsRequired = ctx.survivalTurnsRequired;
  const early = isEarlyDepth1(ctx);
  const c = COMBAT_DIRECTOR_BALANCE;
  const maxP = maxPressureFor(ctx);

  // Strip dual defenses on early Depth 1.
  if (early || density.bothArmorAndWardCount > 0 && ctx.depth === 1) {
    enemies = enemies.map((e, idx) => {
      const ka = e.kineticArmor ?? e.baseKineticArmor ?? 0;
      const ow = e.occultWards ?? e.baseOccultWards ?? 0;
      if (ka > 0 && ow > 0) {
        adjustments.push({
          id: `strip-dual-${idx}`,
          reason: 'Remove dual KA+OW on Depth 1',
          before: { ka, ow },
          after: { ka, ow: 0 },
          applied: true,
        });
        return {
          ...e,
          occultWards: 0,
          baseOccultWards: 0,
        };
      }
      return e;
    });
  }

  // Cap layered enemies early.
  const maxLayered = early
    ? c.depth1EarlyMaxLayeredEnemies
    : ctx.depth === 1
      ? c.depth1LateMaxLayeredEnemies
      : 99;
  let layeredSeen = 0;
  enemies = enemies.map((e, idx) => {
    const ka = e.kineticArmor ?? e.baseKineticArmor ?? 0;
    const ow = e.occultWards ?? e.baseOccultWards ?? 0;
    if (ka <= 0 && ow <= 0) return e;
    layeredSeen += 1;
    if (layeredSeen <= maxLayered) return e;
    adjustments.push({
      id: `strip-layer-${idx}`,
      reason: `Layered enemy over cap ${maxLayered}`,
      before: { ka, ow },
      after: { ka: 0, ow: 0 },
      applied: true,
    });
    return {
      ...e,
      kineticArmor: 0,
      baseKineticArmor: 0,
      occultWards: 0,
      baseOccultWards: 0,
    };
  });

  // Soft stacks when over pressure or hard-counter ERROR.
  const needsSoft = pressure.total > maxP
    || priorIssues.some((i) => i.severity === 'ERROR' && (
      i.category === 'OVERLOADED_PRESSURE'
      || i.category === 'HARD_COUNTER_STACK'
      || i.category === 'MECHANIC_DENSITY'
    ));

  if (needsSoft) {
    enemies = enemies.map((e, idx) => {
      const next = { ...e };
      const before = {
        ka: e.kineticArmor ?? 0,
        ow: e.occultWards ?? 0,
        dmg: e.baseDamage,
        hp: e.maxHp,
      };
      if ((next.kineticArmor ?? 0) > c.safetyArmorStackFloor) {
        next.kineticArmor = c.safetyArmorStackFloor;
        next.baseKineticArmor = c.safetyArmorStackFloor;
      }
      if ((next.occultWards ?? 0) > c.safetyWardStackFloor) {
        next.occultWards = c.safetyWardStackFloor;
        next.baseOccultWards = c.safetyWardStackFloor;
      }
      next.baseDamage = Math.max(1, Math.floor((next.baseDamage || 1) * c.safetyDamageSoftMult));
      next.maxHp = Math.max(1, Math.floor((next.maxHp || 1) * c.safetyHpSoftMult));
      next.currentHp = Math.min(next.currentHp, next.maxHp);
      adjustments.push({
        id: `soft-unit-${idx}`,
        reason: `Pressure ${pressure.total} > cap ${maxP} or density ERROR`,
        before,
        after: {
          ka: next.kineticArmor,
          ow: next.occultWards,
          dmg: next.baseDamage,
          hp: next.maxHp,
        },
        applied: true,
      });
      return next;
    });
    incomingDamageMitigationPct = Math.max(
      incomingDamageMitigationPct,
      c.safetyIncomingMitigationPct,
    );
  }

  // Downgrade CRITICAL intents early / over cap.
  if (early || (density.criticalIntentCount > 0 && !ctx.isEliteEncounter && !ctx.isBossEncounter && ctx.depth === 1)) {
    enemies = enemies.map((e, idx) => {
      const meta = getIntentCatalogEntry(e.intent);
      if (meta.severity !== 'CRITICAL' && !(meta.severity === 'HIGH' && early && density.highIntentCount > c.depth1EarlyMaxHighIntents)) {
        return e;
      }
      if (meta.severity === 'CRITICAL' || (early && meta.severity === 'HIGH' && idx > 0)) {
        adjustments.push({
          id: `intent-downgrade-${idx}`,
          reason: 'Downgrade dangerous telegraph for Depth 1 safety',
          before: e.intent,
          after: 'STRIKE',
          applied: true,
        });
        return { ...e, intent: 'STRIKE' as const, chargeTurns: 0, queuedAction: null };
      }
      return e;
    });
  }

  // Lengthen tight survival timers under high pressure.
  if (
    ctx.isDirtyExtraction
    && survivalTurnsRequired != null
    && survivalTurnsRequired <= 2
    && pressure.label !== 'LOW'
  ) {
    const next = survivalTurnsRequired + c.safetyTimerLengthen;
    adjustments.push({
      id: 'lengthen-timer',
      reason: 'Dirty Extraction timer too tight for pressure',
      before: survivalTurnsRequired,
      after: next,
      applied: true,
    });
    survivalTurnsRequired = next;
  }

  if (pressure.total > maxP) {
    issues.push({
      id: 'pressure-over-cap',
      severity: early && pressure.label === 'CRITICAL' ? 'ERROR' : 'WARNING',
      category: 'OVERLOADED_PRESSURE',
      message: `Pressure ${pressure.total} (${pressure.label}) exceeds depth cap ${maxP}`,
      suggestedFix: 'Safety soft applied to HP/dmg/stacks',
    });
  }

  if (
    early
    && pressure.label === 'CRITICAL'
    && COMBAT_DIRECTOR_BALANCE.earlyCriticalPressureDisallowed
  ) {
    issues.push({
      id: 'early-critical-pressure',
      severity: 'ERROR',
      category: 'EARLY_DEPTH_SAFETY',
      message: 'CRITICAL pressure disallowed in early Depth 1',
      suggestedFix: 'Safety soft + intent downgrade',
    });
  }

  return {
    enemies,
    adjustments,
    issues,
    survivalTurnsRequired,
    incomingDamageMitigationPct,
  };
}
