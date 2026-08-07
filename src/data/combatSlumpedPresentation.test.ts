/**
 * Run: npx tsx --test src/data/combatSlumpedPresentation.test.ts
 *
 * Guards the battlefield/Intel contradiction: while an enemy is canonically
 * Slumped, neither surface may advertise a normal upcoming action.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSlumpedForPresentation,
  resolveSlumpedPresentation,
  shouldSuppressNextIntent,
} from './combatSlumpedPresentation';

describe('combatSlumpedPresentation', () => {
  it('is inert for enemies that are not slumped', () => {
    assert.equal(isSlumpedForPresentation({ isSlumped: false }), false);
    assert.equal(shouldSuppressNextIntent({ isSlumped: false }), false);
    assert.equal(resolveSlumpedPresentation({ isSlumped: false }), null);
    assert.equal(resolveSlumpedPresentation({}), null);
  });

  it('suppresses next-intent on every surface while slumped', () => {
    const unit = { isSlumped: true, slumpTurnsRemaining: 1 };
    assert.equal(shouldSuppressNextIntent(unit), true);
  });

  it('derives revival copy from the canonical slump counters', () => {
    assert.equal(
      resolveSlumpedPresentation({ isSlumped: true, slumpTurnsRemaining: 1 })?.revivalLabel,
      'REVIVES IN 1 FULL TURN',
    );
    assert.equal(
      resolveSlumpedPresentation({ isSlumped: true, slumpTurnsRemaining: 3 })?.revivalLabel,
      'REVIVES IN 3 FULL TURNS',
    );
    assert.equal(
      resolveSlumpedPresentation({
        isSlumped: true,
        slumpTurnsRemaining: 1,
        slumpGraceThisPlayerTurn: true,
      })?.revivalLabel,
      'REVIVES AFTER NEXT FULL TURN',
    );
  });

  it('gives the battlefield and Enemy Intel identical state copy', () => {
    const unit = { isSlumped: true, slumpTurnsRemaining: 2 };
    const battlefield = resolveSlumpedPresentation(unit);
    const intel = resolveSlumpedPresentation(unit);
    assert.deepEqual(battlefield, intel);
    assert.equal(battlefield?.stateLabel, 'SLUMPED');
    assert.equal(battlefield?.executableLabel, 'EXECUTABLE');
  });
});
