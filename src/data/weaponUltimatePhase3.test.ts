/**
 * WU-3 — shared ultimate host / grades / cancel / simplified inputs.
 * Run: npx tsx src/data/weaponUltimatePhase3.test.ts
 */
import assert from 'node:assert/strict';
import {
  formatWeaponUltimateGradeLabel,
  gradeToZeroProtocolPerformance,
  resolveWeaponUltimateGrade,
  weaponUltimateCancelSpendsResources,
  weaponUltimateOpenSpendsResources,
} from './weaponUltimateGradeEngine';
import {
  buildSimplifiedUltimateRawResult,
  resolveWeaponUltimateInputMode,
  resolveWeaponUltimateTimingAssist,
  shouldSkipUltimateMinigame,
} from './weaponUltimateInputAdapter';
import { performanceFromTaps } from './hexZeroProtocolEngine';

console.log('Phase WU-3 — shared ultimate host suite');

assert.equal(weaponUltimateCancelSpendsResources(), false);
assert.equal(weaponUltimateOpenSpendsResources(), false);

// Zero Protocol taps → grades
assert.equal(resolveWeaponUltimateGrade({ tapCount: 0 }).grade, 'STANDARD');
assert.equal(resolveWeaponUltimateGrade({ tapCount: 0 }).effectiveTaps, 1);
assert.equal(resolveWeaponUltimateGrade({ tapCount: 4 }).grade, 'STANDARD');
assert.equal(resolveWeaponUltimateGrade({ tapCount: 5 }).grade, 'CLEAN');
assert.equal(resolveWeaponUltimateGrade({ tapCount: 9 }).grade, 'CLEAN');
assert.equal(resolveWeaponUltimateGrade({ tapCount: 10 }).grade, 'PERFECT');
assert.equal(
  gradeToZeroProtocolPerformance(resolveWeaponUltimateGrade({ tapCount: 10 }).grade),
  'PERFECT',
);
assert.equal(
  gradeToZeroProtocolPerformance(resolveWeaponUltimateGrade({ tapCount: 5 }).grade),
  'GOOD',
);
assert.equal(
  gradeToZeroProtocolPerformance(resolveWeaponUltimateGrade({ tapCount: 1 }).grade),
  'POOR',
);
// Bridge stays aligned with legacy performanceFromTaps for FULL thresholds
assert.equal(performanceFromTaps(10), 'PERFECT');
assert.equal(performanceFromTaps(5), 'GOOD');
assert.equal(performanceFromTaps(0), 'POOR');

// Null Circuit nodes → grades + STANDARD floor (no backlash path)
assert.equal(resolveWeaponUltimateGrade({ nodesCompleted: 0 }).grade, 'STANDARD');
assert.equal(resolveWeaponUltimateGrade({ nodesCompleted: 0 }).effectiveNodes, 1);
assert.equal(resolveWeaponUltimateGrade({ nodesCompleted: 1 }).grade, 'STANDARD');
assert.equal(resolveWeaponUltimateGrade({ nodesCompleted: 2 }).grade, 'CLEAN');
assert.equal(resolveWeaponUltimateGrade({ nodesCompleted: 3 }).grade, 'PERFECT');

// Threefold hits → grades + STANDARD floor (no zero-damage waste)
assert.equal(resolveWeaponUltimateGrade({ hitCount: 0 }).grade, 'STANDARD');
assert.equal(resolveWeaponUltimateGrade({ hitCount: 0 }).effectiveHits, 1);
assert.equal(resolveWeaponUltimateGrade({ hitCount: 1 }).grade, 'STANDARD');
assert.equal(resolveWeaponUltimateGrade({ hitCount: 2 }).grade, 'CLEAN');
assert.equal(resolveWeaponUltimateGrade({ hitCount: 3 }).grade, 'PERFECT');

// Simplified always STANDARD
for (const kind of ['ZERO_PROTOCOL', 'NULL_CIRCUIT', 'THREEFOLD_BRAND'] as const) {
  const raw = buildSimplifiedUltimateRawResult(kind);
  const resolved = resolveWeaponUltimateGrade(raw);
  assert.equal(resolved.grade, 'STANDARD', kind);
  assert.equal(raw.forceStandard, true);
}

assert.equal(resolveWeaponUltimateInputMode({ simplifiedUltimateInputs: true }), 'SIMPLIFIED');
assert.equal(resolveWeaponUltimateInputMode({ simplifiedUltimateInputs: false }), 'FULL');
assert.equal(shouldSkipUltimateMinigame('SIMPLIFIED'), true);
assert.equal(shouldSkipUltimateMinigame('FULL'), false);
assert.equal(
  resolveWeaponUltimateTimingAssist({ simplifiedUltimateInputs: false, reducedMotion: true }),
  1.35,
);
assert.equal(
  resolveWeaponUltimateTimingAssist({ simplifiedUltimateInputs: false, reducedMotion: false }),
  1,
);
assert.equal(formatWeaponUltimateGradeLabel('CLEAN'), 'CLEAN');

console.log('Phase WU-3 host OK — grades, STANDARD floors, simplified → STANDARD, cancel free');
