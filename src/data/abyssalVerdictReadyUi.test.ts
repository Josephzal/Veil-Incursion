/**
 * ABYSSAL VERDICT ready / targeting UI — lifecycle tests.
 * Run: npx --yes tsx src/data/abyssalVerdictReadyUi.test.ts
 */

import assert from 'node:assert/strict';
import { COMBAT_ACTION } from '../types/run';
import {
  ABYSSAL_VERDICT_BRACKET_COLLAPSE_MS,
  ABYSSAL_VERDICT_READY_NOTIFY_MS,
  ABYSSAL_VERDICT_UI_COPY,
  isAbyssalVerdictEnemyEligible,
  previewAbyssalVerdictDamage,
  resolveAbyssalVerdictCommitDamage,
  resolveAbyssalVerdictPresentationState,
  shouldFireAbyssalVerdictReadyNotification,
  shouldShowOrbitalUltimatePing,
} from './abyssalVerdictReadyUi';

function main(): void {
  console.log('ABYSSAL VERDICT ready UI suite');

  assert.equal(
    resolveAbyssalVerdictPresentationState({ ultimateReady: false, primed: false }),
    'unavailable',
  );
  assert.equal(
    resolveAbyssalVerdictPresentationState({ ultimateReady: true, primed: false }),
    'ready',
  );
  assert.equal(
    resolveAbyssalVerdictPresentationState({ ultimateReady: true, primed: true }),
    'targeting',
  );
  // Primed while not ready must not stick as targeting.
  assert.equal(
    resolveAbyssalVerdictPresentationState({ ultimateReady: false, primed: true }),
    'unavailable',
  );

  assert.equal(shouldFireAbyssalVerdictReadyNotification(false, true), true);
  assert.equal(shouldFireAbyssalVerdictReadyNotification(true, true), false);
  assert.equal(shouldFireAbyssalVerdictReadyNotification(true, false), false);
  assert.equal(shouldFireAbyssalVerdictReadyNotification(false, false), false);
  // Turn transition / rerender while still ready — no replay.
  assert.equal(shouldFireAbyssalVerdictReadyNotification(true, true), false);
  // Drop then re-ready fires again once.
  assert.equal(shouldFireAbyssalVerdictReadyNotification(false, true), true);

  assert.equal(isAbyssalVerdictEnemyEligible({ alive: true }), true);
  assert.equal(isAbyssalVerdictEnemyEligible({ alive: false }), false);
  assert.equal(isAbyssalVerdictEnemyEligible({ alive: true, dissolveHidden: true }), false);

  // Old floating red center circle must never show for Abyssal Verdict.
  assert.equal(shouldShowOrbitalUltimatePing('eviscerate'), false);
  assert.equal(shouldShowOrbitalUltimatePing(null), false);
  assert.equal(shouldShowOrbitalUltimatePing('zero_protocol'), true);
  assert.equal(shouldShowOrbitalUltimatePing('cataclysm'), true);

  assert.ok(ABYSSAL_VERDICT_READY_NOTIFY_MS >= 700 && ABYSSAL_VERDICT_READY_NOTIFY_MS <= 900);
  assert.ok(ABYSSAL_VERDICT_BRACKET_COLLAPSE_MS >= 60 && ABYSSAL_VERDICT_BRACKET_COLLAPSE_MS <= 90);

  // E.1d.1 — grade from authoritative input; FULL targeting does not force PERFECT.
  const perfect = resolveAbyssalVerdictCommitDamage({ hitCount: 3 });
  assert.equal(perfect.hits, 3);
  assert.equal(perfect.damage, COMBAT_ACTION.EVISCERATE_DAMAGE);
  assert.equal(perfect.gradeLabel, 'PERFECT');

  const clean = resolveAbyssalVerdictCommitDamage({ hitCount: 2 });
  assert.equal(clean.hits, 2);
  assert.equal(clean.damage, 23);
  assert.equal(clean.gradeLabel, 'CLEAN');

  const simplified = resolveAbyssalVerdictCommitDamage({ simplifiedInputs: true });
  assert.equal(simplified.hits, 1);
  assert.ok(simplified.damage < perfect.damage);
  assert.equal(simplified.gradeLabel, 'STANDARD');
  assert.equal(simplified.damage, 11);

  // Preview uses the same commit damage path (canonical), not a second formula.
  const preview = previewAbyssalVerdictDamage({
    currentHp: 20,
    kineticArmor: 5,
    grade: 'PERFECT',
  });
  assert.equal(preview.damage, COMBAT_ACTION.EVISCERATE_DAMAGE);
  assert.equal(preview.lethal, true);
  assert.equal(preview.remainingHp, 0);
  assert.equal(preview.remainingArmor, 5);

  const previewSurvive = previewAbyssalVerdictDamage({
    currentHp: 100,
    grade: 'CLEAN',
  });
  assert.equal(previewSurvive.lethal, false);
  assert.equal(previewSurvive.remainingHp, 100 - 23);
  assert.equal(previewSurvive.gradeLabel, 'CLEAN');

  assert.equal(ABYSSAL_VERDICT_UI_COPY.displayName, 'ABYSSAL VERDICT');
  assert.ok(ABYSSAL_VERDICT_UI_COPY.targetingInstruction.includes('SELECT TARGET'));
  assert.equal(ABYSSAL_VERDICT_UI_COPY.primeHint, 'PRIME ULTIMATE');
  assert.equal(ABYSSAL_VERDICT_UI_COPY.cancelLabel, 'CANCEL — FREE');

  console.log('ABYSSAL VERDICT ready UI suite — ok');
}

main();
