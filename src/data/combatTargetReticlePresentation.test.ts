import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OTT } from '../constants/occultTacticalTerminalTheme';
import {
  FORBIDDEN_TARGET_RETICLE_HUES,
  TARGET_RETICLE_COLOR,
  isForbiddenTargetReticleHue,
  resolveEnemyTargetReticlePresentation,
  resolveTargetReticleOpacity,
  resolveTargetReticleVariant,
} from './combatTargetReticlePresentation';

describe('combatTargetReticlePresentation', () => {
  it('uses canonical cyan/mint and forbids purple/green hues', () => {
    assert.equal(TARGET_RETICLE_COLOR, OTT.cyanSelect);
    assert.ok(FORBIDDEN_TARGET_RETICLE_HUES.includes(OTT.fluxViolet));
    assert.ok(FORBIDDEN_TARGET_RETICLE_HUES.includes(OTT.terminalGreen));
    assert.equal(isForbiddenTargetReticleHue(OTT.fluxViolet), true);
    assert.equal(isForbiddenTargetReticleHue(OTT.terminalGreen), true);
    assert.equal(isForbiddenTargetReticleHue(OTT.cyanSelect), false);
  });

  it('hides player reticles during hostile turn or inactive targeting', () => {
    const hostile = resolveEnemyTargetReticlePresentation({
      targetingActive: true,
      abilityArmed: false,
      isSelected: true,
      isFocused: true,
      isTargetable: true,
      isActingEnemy: true,
    });
    assert.equal(hostile.mode, 'hidden');

    const idle = resolveEnemyTargetReticlePresentation({
      targetingActive: false,
      abilityArmed: false,
      isSelected: true,
      isFocused: false,
      isTargetable: false,
    });
    assert.equal(idle.mode, 'hidden');
  });

  it('shows only one inspect reticle when no ability is armed', () => {
    const selected = resolveEnemyTargetReticlePresentation({
      targetingActive: true,
      abilityArmed: false,
      isSelected: true,
      isFocused: false,
      isTargetable: false,
    });
    assert.equal(selected.mode, 'inspect');
    assert.equal(selected.color, OTT.cyanSelect);

    const other = resolveEnemyTargetReticlePresentation({
      targetingActive: true,
      abilityArmed: false,
      isSelected: false,
      isFocused: false,
      isTargetable: false,
      reticleHovered: true,
    });
    assert.equal(other.mode, 'hidden');
  });

  it('uses candidate ticks for non-focused valid targets while armed', () => {
    const candidate = resolveEnemyTargetReticlePresentation({
      targetingActive: true,
      abilityArmed: true,
      isSelected: false,
      isFocused: false,
      isTargetable: true,
      reticleHovered: false,
    });
    assert.equal(candidate.mode, 'candidate');
    assert.equal(candidate.showCandidateTick, true);
    assert.equal(candidate.color, OTT.cyanSelect);
    assert.equal(isForbiddenTargetReticleHue(candidate.color), false);

    const focus = resolveEnemyTargetReticlePresentation({
      targetingActive: true,
      abilityArmed: true,
      isSelected: false,
      isFocused: true,
      isTargetable: true,
      reticleHovered: false,
    });
    assert.equal(focus.mode, 'focus');
    assert.equal(focus.color, OTT.cyanSelect);
  });

  it('labels dual allocations without hue changes', () => {
    const source = resolveEnemyTargetReticlePresentation({
      targetingActive: true,
      abilityArmed: true,
      isSelected: true,
      isFocused: false,
      isTargetable: true,
      dualAllocationIndex: 1,
    });
    assert.equal(source.dualLabel, '1 • SOURCE');
    assert.equal(source.mode, 'inspect');
    assert.equal(source.color, OTT.cyanSelect);

    const destination = resolveEnemyTargetReticlePresentation({
      targetingActive: true,
      abilityArmed: true,
      isSelected: false,
      isFocused: true,
      isTargetable: true,
      dualAllocationIndex: 2,
      reticleHovered: true,
    });
    assert.equal(destination.dualLabel, '2 • DESTINATION');
    assert.equal(destination.mode, 'focus');
    assert.equal(destination.color, source.color);
  });

  it('keeps committed armed picks dim until hover intensifies them', () => {
    const committed = resolveEnemyTargetReticlePresentation({
      targetingActive: true,
      abilityArmed: true,
      isSelected: true,
      isFocused: false,
      isTargetable: true,
      reticleHovered: false,
    });
    assert.equal(committed.mode, 'inspect');

    const hovering = resolveEnemyTargetReticlePresentation({
      targetingActive: true,
      abilityArmed: true,
      isSelected: true,
      isFocused: false,
      isTargetable: true,
      reticleHovered: true,
    });
    assert.equal(hovering.mode, 'focus');
    assert.ok(
      resolveTargetReticleOpacity(committed.intensity)
        < resolveTargetReticleOpacity(hovering.intensity),
    );
  });

  it('reserves complete brackets for the active target and its confirmation', () => {
    assert.equal(resolveTargetReticleVariant('focus'), 'full');
    assert.equal(resolveTargetReticleVariant('confirm'), 'full');
    // Passive inspection and candidacy stay on short exterior ticks.
    assert.equal(resolveTargetReticleVariant('inspect'), 'candidate');
    assert.equal(resolveTargetReticleVariant('candidate'), 'candidate');
    assert.equal(resolveTargetReticleVariant('hidden'), 'candidate');
  });

  it('keeps passive inspection dimmer than an active lock', () => {
    assert.ok(resolveTargetReticleOpacity('inspect') < resolveTargetReticleOpacity('inspectFocus'));
    assert.ok(resolveTargetReticleOpacity('inspectFocus') < resolveTargetReticleOpacity('focus'));
    assert.equal(resolveTargetReticleOpacity('focus'), 1);
  });

  it('does not arm reticles for zero-target presentation inputs', () => {
    const none = resolveEnemyTargetReticlePresentation({
      targetingActive: true,
      abilityArmed: false,
      isSelected: false,
      isFocused: false,
      isTargetable: false,
    });
    assert.equal(none.mode, 'hidden');
  });
});
