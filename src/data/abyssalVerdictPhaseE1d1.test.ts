/**
 * Phase E.1d.1 — ABYSSAL VERDICT lethal aftermath + CLEAN reachability.
 * Run: npx tsx src/data/abyssalVerdictPhaseE1d1.test.ts
 */
import assert from 'node:assert/strict';
import { COMBAT_ACTION } from '../types/run';
import {
  abyssalVerdictDamageForGrade,
  abyssalVerdictPreservesBrands,
  planAbyssalVerdictAftermath,
  resolveAbyssalVerdictCommitFromGradeInput,
} from './abyssalVerdictCommitEngine';
import {
  previewAbyssalVerdictDamage,
  resolveAbyssalVerdictCommitDamage,
} from './abyssalVerdictReadyUi';

console.log('Phase E.1d.1 — ABYSSAL VERDICT aftermath + grade reachability');

// --- Matrix preserved ---
assert.equal(abyssalVerdictDamageForGrade('STANDARD'), 11);
assert.equal(abyssalVerdictDamageForGrade('CLEAN'), 23);
assert.equal(abyssalVerdictDamageForGrade('PERFECT'), 35);
assert.equal(COMBAT_ACTION.EVISCERATE_DAMAGE, 35);

// --- Grade from hitCount (authoritative slice windows) ---
const std = resolveAbyssalVerdictCommitFromGradeInput({ hitCount: 1 });
assert.equal(std.grade, 'STANDARD');
assert.equal(std.damage, 11);
assert.equal(std.hits, 1);

const clean = resolveAbyssalVerdictCommitFromGradeInput({ hitCount: 2 });
assert.equal(clean.grade, 'CLEAN');
assert.equal(clean.damage, 23);
assert.equal(clean.hits, 2);

const perfect = resolveAbyssalVerdictCommitFromGradeInput({ hitCount: 3 });
assert.equal(perfect.grade, 'PERFECT');
assert.equal(perfect.damage, 35);
assert.equal(perfect.hits, 3);

// Explicit staged grade wins
assert.equal(resolveAbyssalVerdictCommitFromGradeInput({ grade: 'CLEAN' }).damage, 23);
assert.equal(resolveAbyssalVerdictCommitFromGradeInput({ grade: 'PERFECT' }).damage, 35);

// Simplified → STANDARD
const simplified = resolveAbyssalVerdictCommitFromGradeInput({ simplifiedInputs: true });
assert.equal(simplified.grade, 'STANDARD');
assert.equal(simplified.damage, 11);

// FULL / no grade state must NOT award PERFECT
const noGrade = resolveAbyssalVerdictCommitFromGradeInput({});
assert.equal(noGrade.grade, 'STANDARD');
assert.equal(noGrade.damage, 11);
assert.notEqual(noGrade.grade, 'PERFECT');

// ReadyUi wrapper agrees
assert.equal(resolveAbyssalVerdictCommitDamage({ hitCount: 2 }).gradeLabel, 'CLEAN');
assert.equal(resolveAbyssalVerdictCommitDamage({ hitCount: 2 }).damage, 23);
assert.equal(resolveAbyssalVerdictCommitDamage({ grade: 'PERFECT' }).damage, 35);
assert.equal(resolveAbyssalVerdictCommitDamage({ simplifiedInputs: true }).damage, 11);

// Preview equals execution for all three grades
for (const grade of ['STANDARD', 'CLEAN', 'PERFECT'] as const) {
  const commit = resolveAbyssalVerdictCommitDamage({ grade });
  const preview = previewAbyssalVerdictDamage({ currentHp: 100, grade });
  assert.equal(preview.damage, commit.damage, `preview ${grade}`);
  assert.equal(preview.gradeLabel, grade);
  assert.equal(preview.remainingHp, 100 - commit.damage);
}

// CLEAN not promoted; PERFECT not downgraded
assert.equal(previewAbyssalVerdictDamage({ currentHp: 50, grade: 'CLEAN' }).damage, 23);
assert.equal(previewAbyssalVerdictDamage({ currentHp: 50, grade: 'PERFECT' }).damage, 35);

// --- Aftermath finalization ---
const nonlethal = planAbyssalVerdictAftermath({
  commitSucceeded: true,
  alreadyFinalized: false,
  livingEnemyIdsAfterDamage: ['e1', 'e2'],
});
assert.equal(nonlethal.shouldFinalize, true);
assert.equal(nonlethal.flushReserve, true);
assert.deepEqual(nonlethal.stripTargetIds, ['e1', 'e2']);

const lethalSurvivor = planAbyssalVerdictAftermath({
  commitSucceeded: true,
  alreadyFinalized: false,
  livingEnemyIdsAfterDamage: ['e2'],
});
assert.equal(lethalSurvivor.shouldFinalize, true);
assert.deepEqual(lethalSurvivor.stripTargetIds, ['e2']);
assert.ok(!lethalSurvivor.stripTargetIds.includes('e1'));

const lethalFinal = planAbyssalVerdictAftermath({
  commitSucceeded: true,
  alreadyFinalized: false,
  livingEnemyIdsAfterDamage: [],
});
assert.equal(lethalFinal.shouldFinalize, true);
assert.equal(lethalFinal.flushReserve, true);
assert.deepEqual(lethalFinal.stripTargetIds, []);

const overkill = planAbyssalVerdictAftermath({
  commitSucceeded: true,
  alreadyFinalized: false,
  livingEnemyIdsAfterDamage: ['other'],
});
assert.equal(overkill.shouldFinalize, true);

// Duplicate callback protection
const dup = planAbyssalVerdictAftermath({
  commitSucceeded: true,
  alreadyFinalized: true,
  livingEnemyIdsAfterDamage: ['e2'],
});
assert.equal(dup.shouldFinalize, false);
assert.equal(dup.flushReserve, false);

// Cancel / failed validation — no aftermath
const cancel = planAbyssalVerdictAftermath({
  commitSucceeded: false,
  alreadyFinalized: false,
  livingEnemyIdsAfterDamage: ['e1'],
});
assert.equal(cancel.shouldFinalize, false);

// Brands preserved (0 / partial / full)
assert.equal(abyssalVerdictPreservesBrands(0), 0);
assert.equal(abyssalVerdictPreservesBrands(2), 2);
assert.equal(abyssalVerdictPreservesBrands(5), 5);

// Reserve probe: flush intent identical at 100 and 150 (no Overflow damage scaling)
for (const reserve of [100, 150]) {
  const plan = planAbyssalVerdictAftermath({
    commitSucceeded: true,
    alreadyFinalized: false,
    livingEnemyIdsAfterDamage: reserve === 150 ? [] : ['s'],
  });
  assert.equal(plan.flushReserve, true, `flush @${reserve}`);
  assert.equal(abyssalVerdictDamageForGrade('CLEAN'), 23);
}

console.log('Phase E.1d.1 ABYSSAL VERDICT OK');
