/**
 * Combat Refactor Phase 5 — class fairness validation against encounter needs.
 */

import type { ClassType } from '../types/game';
import type { CombatDirectorContext, CombatDirectorIssue } from '../types/combatDirector';
import { snapshotMechanicDensity } from './combatDirectorDensityEngine';

const CLASS_ANSWERS: Record<string, {
  armor: boolean;
  ward: boolean;
  lockOn: boolean;
  channel: boolean;
  guard: boolean;
  fracture: boolean;
  objectiveSurvive: boolean;
}> = {
  AEGIS: {
    armor: true,
    ward: false, // soft — Fracture / True / pierce paths
    lockOn: true, // Parry
    channel: true, // Interrupt / kill
    guard: true, // Guard break / Fracture
    fracture: true,
    objectiveSurvive: true,
  },
  HEX_SHOT: {
    armor: true,
    ward: true,
    lockOn: true,
    channel: true,
    guard: true,
    fracture: true,
    objectiveSurvive: true,
  },
  ENVOY: {
    armor: false, // soft — Fracture exploit / boons
    ward: true,
    lockOn: true, // Blind / interrupt tags
    channel: true,
    guard: true,
    fracture: true,
    objectiveSurvive: true,
  },
};

export function validateClassFairness(
  ctx: CombatDirectorContext,
): CombatDirectorIssue[] {
  const issues: CombatDirectorIssue[] = [];
  const classId = (ctx.playerClassId || 'AEGIS') as ClassType;
  const answers = CLASS_ANSWERS[classId] ?? CLASS_ANSWERS.AEGIS!;
  const density = snapshotMechanicDensity(ctx);

  if (density.hardCounterKinds.includes('ARMOR') && !answers.armor && classId === 'ENVOY') {
    issues.push({
      id: 'fairness-envoy-armor',
      severity: 'WARNING',
      category: 'CLASS_FAIRNESS',
      message: 'Envoy faces Kinetic Armor with limited starter ARMOR_BREAK',
      suggestedFix: 'Prefer Fracture / pierce paths; director may soft KA stacks',
    });
  }

  if (density.hardCounterKinds.includes('WARD') && !answers.ward && classId === 'AEGIS') {
    issues.push({
      id: 'fairness-aegis-ward',
      severity: 'WARNING',
      category: 'CLASS_FAIRNESS',
      message: 'Aegis faces Occult Wards with limited starter WARD_BREAK',
      suggestedFix: 'True damage / Fracture exploit; director may soft OW stacks',
    });
  }

  if (
    density.hardCounterKinds.includes('CRITICAL_LOCK_ON')
    && !answers.lockOn
  ) {
    issues.push({
      id: 'fairness-lock-on',
      severity: 'ERROR',
      category: 'CLASS_FAIRNESS',
      message: `${classId} lacks Lock-On answer vs CRITICAL LOCK_ON`,
    });
  }

  if (
    density.hardCounterKinds.includes('MAJOR_CHANNEL')
    && !answers.channel
  ) {
    issues.push({
      id: 'fairness-channel',
      severity: 'ERROR',
      category: 'CLASS_FAIRNESS',
      message: `${classId} lacks Channel/Ritual interrupt answer`,
    });
  }

  if (ctx.isDirtyExtraction && !answers.objectiveSurvive) {
    issues.push({
      id: 'fairness-dirty-extract',
      severity: 'ERROR',
      category: 'CLASS_FAIRNESS',
      message: `${classId} cannot reasonably survive Dirty Extraction`,
    });
  }

  const hpRatio = ctx.playerMaxHp > 0 ? ctx.playerCurrentHp / ctx.playerMaxHp : 1;
  if (ctx.depth === 1 && (ctx.nodesCleared ?? 0) < 3 && hpRatio < 0.5 && density.hardCounterCount >= 2) {
    issues.push({
      id: 'fairness-low-hp-early',
      severity: 'WARNING',
      category: 'CLASS_FAIRNESS',
      message: 'Player enters early Depth 1 fight below 50% HP with stacked counters',
      suggestedFix: 'Apply incoming mitigation or reduce enemy damage',
    });
  }

  return issues;
}

export function formatClassFairnessAnswers(): string {
  const lines = ['CLASS FAIRNESS ANSWER MATRIX'];
  for (const [id, a] of Object.entries(CLASS_ANSWERS)) {
    lines.push(
      `  ${id}: KA=${a.armor} OW=${a.ward} Lock=${a.lockOn} Channel=${a.channel} Guard=${a.guard} Fracture=${a.fracture}`,
    );
  }
  return lines.join('\n');
}
