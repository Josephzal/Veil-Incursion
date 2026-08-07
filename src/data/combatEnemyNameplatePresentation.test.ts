/**
 * Run: npx tsx --test src/data/combatEnemyNameplatePresentation.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NAMEPLATE_MAX_INDICATORS,
  NAMEPLATE_SILHOUETTE_GAP,
  formatNameplateHp,
  formatNameplateIntentLine,
  resolveEnemyNameplateDensity,
  resolveNameplateRegions,
  selectNameplateIndicators,
} from './combatEnemyNameplatePresentation';

describe('combatEnemyNameplatePresentation', () => {
  it('treats hover, focus, selection and acting as one disclosure level', () => {
    assert.equal(resolveEnemyNameplateDensity({}), 'ambient');
    assert.equal(resolveEnemyNameplateDensity({ reticleHovered: true }), 'disclosed');
    assert.equal(resolveEnemyNameplateDensity({ isFocused: true }), 'disclosed');
    assert.equal(resolveEnemyNameplateDensity({ isSelected: true }), 'disclosed');
    assert.equal(resolveEnemyNameplateDensity({ isActingEnemy: true }), 'disclosed');
  });

  it('uses compact HP normally and current/max when disclosed', () => {
    assert.equal(formatNameplateHp({ currentHp: 60, maxHp: 64, density: 'ambient' }), '60');
    assert.equal(formatNameplateHp({ currentHp: 60, maxHp: 64, density: 'disclosed' }), '60/64');
  });

  it('builds the intent line from canonical glyph copy', () => {
    assert.equal(
      formatNameplateIntentLine({ symbol: '⚔', label: 'Strike', density: 'ambient' }),
      '⚔ STRIKE',
    );
    assert.equal(
      formatNameplateIntentLine({
        symbol: '⚔',
        label: 'Strike',
        countdownLabel: 'T-2',
        density: 'disclosed',
      }),
      '⚔ STRIKE T-2',
    );
    assert.equal(formatNameplateIntentLine({ density: 'ambient' }), null);
  });

  it('marks imminent intents without relying on animation', () => {
    assert.equal(
      formatNameplateIntentLine({
        symbol: '⚔',
        label: 'Slam',
        density: 'ambient',
        imminent: true,
      }),
      '! ⚔ SLAM',
    );
  });

  it('caps indicators at three with overflow and keeps defenses first', () => {
    const selection = selectNameplateIndicators({
      kineticArmor: 2,
      occultWards: 1,
      statuses: [
        { key: 'fortified', label: 'Fortified' },
        { key: 'evading', label: 'Evade Posture' },
      ],
    });
    assert.equal(selection.visible.length, NAMEPLATE_MAX_INDICATORS);
    assert.equal(selection.overflow, 1);
    assert.deepEqual(
      selection.visible.map((indicator) => indicator.kind),
      ['kineticArmor', 'occultWard', 'status'],
    );

    const light = selectNameplateIndicators({
      statuses: [{ key: 'doomed', label: 'Doomed' }],
    });
    assert.equal(light.overflow, 0);
    assert.equal(light.visible.length, 1);
  });

  it('never lets statuses take the intent slot', () => {
    const crowded = resolveNameplateRegions({
      isSlumped: false,
      intentLine: '⚔ STRIKE 14',
      indicatorCount: 3,
      overflow: 2,
    });
    assert.equal(crowded.lowerLeft, '⚔ STRIKE 14');
    assert.equal(crowded.lowerRightCount, 3);
    assert.equal(crowded.lowerRightOverflow, 2);
    assert.equal(crowded.intentSlotOwnedByIntent, true);

    const bare = resolveNameplateRegions({
      isSlumped: false,
      intentLine: '⚔ STRIKE 14',
      indicatorCount: 0,
      overflow: 0,
    });
    // Same region, same meaning, with or without indicators.
    assert.equal(bare.lowerLeft, crowded.lowerLeft);
  });

  it('substitutes slumped tactical copy in the intent slot', () => {
    const slumped = resolveNameplateRegions({
      isSlumped: true,
      intentLine: '⚔ STRIKE 14',
      slumpedIntentLine: 'EXECUTABLE',
      indicatorCount: 1,
      overflow: 0,
    });
    assert.equal(slumped.lowerLeft, 'EXECUTABLE');
  });

  it('publishes one shared silhouette gap in the 12-16px target band', () => {
    assert.ok(NAMEPLATE_SILHOUETTE_GAP >= 12 && NAMEPLATE_SILHOUETTE_GAP <= 16);
  });
});
