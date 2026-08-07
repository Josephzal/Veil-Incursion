/**
 * Run: npx tsx --test src/data/combatEndTurnPresentation.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveEndTurnEmphasis } from './combatEndTurnPresentation';

describe('combatEndTurnPresentation', () => {
  it('warns only when spendable AP would be discarded', () => {
    const withAp = resolveEndTurnEmphasis({ canEndTurn: true, remainingAp: 2 });
    assert.equal(withAp.tone, 'warning');
    assert.equal(withAp.warnsResourceWaste, true);
    assert.equal(withAp.label, 'END TURN • 2 AP LEFT');
    // Compact button copy stays short enough to stay legible.
    assert.equal(withAp.shortLabel, 'END TURN • 2 AP');
  });

  it('stays neutral at zero AP so End Turn is not permanently amber', () => {
    const spent = resolveEndTurnEmphasis({ canEndTurn: true, remainingAp: 0 });
    assert.equal(spent.tone, 'neutral');
    assert.equal(spent.warnsResourceWaste, false);
    assert.equal(spent.label, 'END TURN');
  });

  it('uses the interactive tone for hover and focus at zero AP', () => {
    const hovered = resolveEndTurnEmphasis({
      canEndTurn: true,
      remainingAp: 0,
      interactive: true,
    });
    assert.equal(hovered.tone, 'interactive');
    assert.equal(hovered.warnsResourceWaste, false);
  });

  it('never warns while End Turn is unavailable', () => {
    const locked = resolveEndTurnEmphasis({ canEndTurn: false, remainingAp: 3 });
    assert.equal(locked.tone, 'disabled');
    assert.equal(locked.warnsResourceWaste, false);
    assert.equal(locked.label, 'END TURN');
  });

  it('does not warn about a staged action, only canonical resources', () => {
    // Staging an ability must not by itself produce warning emphasis.
    assert.equal(
      resolveEndTurnEmphasis({ canEndTurn: true, remainingAp: 0 }).warnsResourceWaste,
      false,
    );
  });
});
