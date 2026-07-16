/**
 * Combat Refactor Phase 5 — DevTest helpers for Combat Director.
 */

import type { EnemyCombatProfile } from '../types/run';
import {
  buildCombatDirectorContextFromPrep,
  directEncounterBeforeStart,
  validateEncounterCombatFairness,
} from './combatDirectorEngine';
import { formatEncounterPressureScore, scoreEncounterPressure } from './combatDirectorPressureEngine';
import { snapshotMechanicDensity } from './combatDirectorDensityEngine';
import { formatClassFairnessAnswers } from './combatDirectorFairnessEngine';
import { formatCombatDirectorBalanceSummary } from './balance/combatDirectorBalanceConfig';
import { buildCombatJuiceEvent, formatJuiceEventStream } from './combatJuiceFeedbackEngine';
import type { CombatJuiceFeedbackEventType } from '../types/combatJuiceFeedback';

function mockEnemy(partial: Partial<EnemyCombatProfile> & { designation: string }): EnemyCombatProfile {
  const { designation, ...rest } = partial;
  return {
    class: 'ABOMINATION',
    designation,
    maxHp: rest.maxHp ?? 80,
    currentHp: rest.currentHp ?? rest.maxHp ?? 80,
    baseDamage: rest.baseDamage ?? 14,
    intent: rest.intent ?? 'STRIKE',
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex: 0,
    scale: 1,
    unitId: rest.unitId ?? `mock-${designation}`,
    kineticArmor: rest.kineticArmor ?? 0,
    occultWards: rest.occultWards ?? 0,
    baseKineticArmor: rest.kineticArmor ?? 0,
    baseOccultWards: rest.occultWards ?? 0,
    rosterId: rest.rosterId,
    ...rest,
  };
}

export function debugPrintCombatDirectorBalance(): string {
  return [
    formatCombatDirectorBalanceSummary(),
    '',
    formatClassFairnessAnswers(),
  ].join('\n');
}

export function debugScoreMockEncounter(opts?: {
  depth?: 1 | 2 | 3;
  early?: boolean;
  elite?: boolean;
  dirty?: boolean;
  dualDefense?: boolean;
}): string {
  const depth = opts?.depth ?? 1;
  const enemies = [
    mockEnemy({
      designation: 'TEST BRUTE',
      maxHp: 90,
      baseDamage: 16,
      kineticArmor: opts?.dualDefense ? 2 : 1,
      occultWards: opts?.dualDefense ? 2 : 0,
      intent: opts?.elite ? 'WORLD_ENDER' : 'CHARGE',
    }),
    mockEnemy({
      designation: 'TEST SUPPORT',
      maxHp: 55,
      baseDamage: 10,
      intent: 'FORTIFY',
      kineticArmor: opts?.early === false ? 1 : 0,
    }),
  ];
  const ctx = buildCombatDirectorContextFromPrep({
    depth,
    nodesCleared: opts?.early === false ? 5 : 1,
    playerClassId: 'AEGIS',
    playerMaxHp: 100,
    playerCurrentHp: 100,
    enemies,
    isElite: opts?.elite,
    isDirtyExtraction: opts?.dirty,
    hasObjective: opts?.dirty,
    survivalTurnsRequired: opts?.dirty ? 3 : undefined,
    hasUnstableCargo: opts?.dirty,
  });
  const pressure = scoreEncounterPressure(ctx);
  const density = snapshotMechanicDensity(ctx);
  const validated = validateEncounterCombatFairness(ctx);
  const directed = directEncounterBeforeStart(ctx);
  return [
    '══════════════════════════════════════',
    'COMBAT DIRECTOR MOCK SCORE',
    '══════════════════════════════════════',
    formatEncounterPressureScore(pressure),
    `Density hard=${density.hardCounterCount} [${density.hardCounterKinds.join(', ')}]`,
    '',
    'Validate:',
    validated.debugSummary,
    '',
    'Directed:',
    directed.debugSummary,
    `Enemies after soft: ${directed.enemies.map((e) => `${e.designation} HP${e.maxHp}/DMG${e.baseDamage}/KA${e.kineticArmor ?? 0}/OW${e.occultWards ?? 0}`).join(' | ')}`,
  ].join('\n');
}

export function debugSimulatePressureDistribution(
  samples = 40,
): string {
  const buckets = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
  for (let i = 0; i < samples; i += 1) {
    const depth = ((i % 3) + 1) as 1 | 2 | 3;
    const directed = directEncounterBeforeStart(
      buildCombatDirectorContextFromPrep({
        depth,
        nodesCleared: i % 8,
        playerClassId: (['AEGIS', 'HEX_SHOT', 'ENVOY'] as const)[i % 3]!,
        playerMaxHp: 100,
        playerCurrentHp: 70 + (i % 30),
        enemies: [
          mockEnemy({
            designation: `SIM-${i}`,
            maxHp: 60 + (i % 40),
            baseDamage: 10 + (i % 12),
            kineticArmor: i % 4 === 0 ? 2 : i % 3 === 0 ? 1 : 0,
            occultWards: i % 5 === 0 ? 2 : 0,
            intent: i % 7 === 0 ? 'TARGET_LOCK' : i % 6 === 0 ? 'CHARGE' : 'STRIKE',
          }),
          ...(i % 2 === 0
            ? [mockEnemy({ designation: `SIM-B-${i}`, maxHp: 50, baseDamage: 8 })]
            : []),
        ],
        isElite: i % 5 === 0,
        isDirtyExtraction: i % 11 === 0,
        hasObjective: i % 11 === 0 || i % 9 === 0,
        hasUnstableCargo: i % 11 === 0,
      }),
    );
    buckets[directed.pressureScore.label] += 1;
  }
  return [
    '══════════════════════════════════════',
    `PRESSURE DISTRIBUTION (${samples} sims)`,
    '══════════════════════════════════════',
    `LOW ${buckets.LOW} | MODERATE ${buckets.MODERATE} | HIGH ${buckets.HIGH} | CRITICAL ${buckets.CRITICAL}`,
  ].join('\n');
}

export function debugForceJuiceFeedback(
  types: CombatJuiceFeedbackEventType[] = [
    'ARMOR_BREAK',
    'WARD_BREAK',
    'FRACTURE_APPLIED',
    'PERFECT_PARRY',
    'OBJECTIVE_COMPLETED',
  ],
): string {
  const events = types.map((t) => buildCombatJuiceEvent(t, { text: `Force ${t}` }));
  return [
    '══════════════════════════════════════',
    'COMBAT JUICE FEEDBACK STREAM',
    '══════════════════════════════════════',
    formatJuiceEventStream(events),
  ].join('\n');
}

export function debugSimulateDirtyExtractionPressure(): string {
  return debugScoreMockEncounter({ depth: 1, early: false, dirty: true, elite: true });
}
