/**
 * Run: npx tsx --test src/data/combatActionRailPresentation.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatActionDetailTitle,
  formatRiposteModifierLabel,
  isSharedApLockDetail,
  resolveActionDetailSubject,
  resolveRailStateLine,
  shouldHoistLockToRail,
} from './combatActionRailPresentation';

describe('combatActionRailPresentation', () => {
  it('treats only the generic AP lock as shared', () => {
    assert.equal(isSharedApLockDetail('NEED 1 AP'), true);
    assert.equal(isSharedApLockDetail('NEED 2 AP'), true);
    assert.equal(isSharedApLockDetail('NEED 1 RUNIC BRAND'), false);
    assert.equal(isSharedApLockDetail('NEED AMMO'), false);
    assert.equal(isSharedApLockDetail('SELECT VALID FOE'), false);
  });

  it('keeps card-specific locks on the card', () => {
    assert.equal(shouldHoistLockToRail({ lockDetail: 'NEED 1 AP', remainingAp: 0 }), true);
    assert.equal(shouldHoistLockToRail({ lockDetail: 'NEED 1 RUNIC BRAND', remainingAp: 0 }), false);
    assert.equal(shouldHoistLockToRail({ lockDetail: 'NEED 3 ROUND', remainingAp: 0 }), false);
    assert.equal(shouldHoistLockToRail({ lockDetail: null, remainingAp: 0 }), false);
  });

  it('leaves differing AP requirements on cards while AP remains', () => {
    // 1 AP left, card needs 2: that reason is not shared by the collection.
    assert.equal(shouldHoistLockToRail({ lockDetail: 'NEED 2 AP', remainingAp: 1 }), false);
  });

  it('reads the shared modifier value from authored status copy', () => {
    assert.equal(
      formatRiposteModifierLabel('Your next successful STRIKE this turn deals +16 Kinetic.'),
      'RIPOSTE • STRIKES +16',
    );
    assert.equal(formatRiposteModifierLabel(null), 'RIPOSTE • STRIKES');
    assert.equal(formatRiposteModifierLabel(''), 'RIPOSTE • STRIKES');
  });

  it('states a shared modifier once at rail level', () => {
    const riposte = resolveRailStateLine({
      remainingAp: 2,
      riposteReady: true,
      riposteModifierLabel: 'RIPOSTE • STRIKES +16',
    });
    assert.equal(riposte?.text, 'ACTIVE: RIPOSTE • STRIKES +16');
    assert.equal(riposte?.tone, 'modifier');
  });

  it('falls back to the zero-AP notice and is otherwise silent', () => {
    assert.equal(resolveRailStateLine({ remainingAp: 0 })?.text, '0 AP • END TURN');
    assert.equal(resolveRailStateLine({ remainingAp: 0 })?.tone, 'resource');
    assert.equal(resolveRailStateLine({ remainingAp: 2 }), null);
  });

  it('pins the committed action so hover cannot replace it during targeting', () => {
    const pinned = resolveActionDetailSubject({
      selectedAbility: 'PAIRED_STRIKE',
      previewAbility: 'GUARD_BREAK',
    });
    assert.equal(pinned.abilityId, 'PAIRED_STRIKE');
    assert.equal(pinned.pinned, true);

    const preview = resolveActionDetailSubject({
      selectedAbility: null,
      previewAbility: 'GUARD_BREAK',
    });
    assert.equal(preview.abilityId, 'GUARD_BREAK');
    assert.equal(preview.pinned, false);

    const cleared = resolveActionDetailSubject({ selectedAbility: null, previewAbility: null });
    assert.equal(cleared.abilityId, null);
  });

  it('keeps the AP cost in the strip title', () => {
    assert.equal(
      formatActionDetailTitle({ name: 'Paired Strike', costImpact: 'COST: 1 AP // 5 KINETIC' }),
      'PAIRED STRIKE • 1 AP',
    );
    assert.equal(formatActionDetailTitle({ name: 'Reload', costImpact: '' }), 'RELOAD');
  });
});
