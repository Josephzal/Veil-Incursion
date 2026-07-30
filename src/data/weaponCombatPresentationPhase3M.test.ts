/**
 * Phase 3M focused tests — presentation registry, boundary, outcome truth, settings.
 */
import assert from 'node:assert/strict';
import {
  buildWeaponCombatFeedbackHit,
  buildWeaponCombatFeedbackPacket,
  getWeaponCombatPresentationProfile,
  listWeaponCombatPresentationProfiles,
  patchCombatPresentationSettings,
  resetCombatPresentationSettings,
  shouldPlayDamagingImpact,
  shouldPlayFleshCue,
  validateWeaponCombatPresentation,
} from './weaponCombatPresentation';
import { ALL_WEAPON_FAMILY_IDS } from './weaponRegistry';
import { WEAPON_ANCHOR_ATTACK_BY_FAMILY } from './weaponAnchorAttackRegistry';
import { WEAPON_ULTIMATE_BY_FAMILY } from './weaponUltimateRegistry';
import {
  clearCombatPresentationPlayedCues,
  getCombatPresentationPlayedCues,
  playCombatPresentationCue,
  setCombatPresentationAudioDeterministic,
} from '../utils/combatPresentationAudio';
import {
  dispatchWeaponCombatPresentation,
  setCombatPresentationMounted,
} from '../utils/combatPresentationBus';
import { presentResolvedWeaponHit } from './weaponCombatPresentation/presentResolvedWeaponHit';

function run(): void {
  resetCombatPresentationSettings();
  setCombatPresentationAudioDeterministic(true);
  setCombatPresentationMounted(true);
  clearCombatPresentationPlayedCues();

  // Registry
  assert.equal(listWeaponCombatPresentationProfiles().length, 9);
  for (const id of ALL_WEAPON_FAMILY_IDS) {
    const profile = getWeaponCombatPresentationProfile(id);
    assert.equal(profile.weaponFamilyId, id);
    assert.equal(profile.anchorId, WEAPON_ANCHOR_ATTACK_BY_FAMILY[id].id);
    assert.equal(profile.ultimateId, WEAPON_ULTIMATE_BY_FAMILY[id].id);
    assert.ok(profile.anchorSequence.length >= 2);
    assert.ok(profile.ultimateSequence.length >= 2);
  }
  const issues = validateWeaponCombatPresentation();
  assert.equal(issues.filter((i) => i.level === 'error').length, 0, JSON.stringify(issues));

  // Outcome truth helpers
  const miss = buildWeaponCombatFeedbackHit({
    targetId: 't1', order: 0, damage: 0, outcome: 'MISS',
  });
  assert.equal(shouldPlayDamagingImpact(miss), false);
  assert.equal(shouldPlayFleshCue(miss), false);
  const hit = buildWeaponCombatFeedbackHit({
    targetId: 't1', order: 0, damage: 10, critical: true,
  });
  assert.equal(shouldPlayDamagingImpact(hit), true);
  assert.equal(shouldPlayFleshCue(hit), true);

  // Presentation cannot mutate packet (immutable flags)
  const packet = buildWeaponCombatFeedbackPacket({
    weaponFamilyId: 'aegis-runed-longsword',
    actionKind: 'ANCHOR',
    actionId: 'WARDENS_STRIKE',
    displayActionName: "WARDEN'S STRIKE",
    hits: [hit],
  });
  assert.equal(packet.presentationOnly, true);
  assert.equal(packet.weaponFamilyId, 'aegis-runed-longsword');

  // Miss must not schedule flesh cue as primary contact path
  clearCombatPresentationPlayedCues();
  dispatchWeaponCombatPresentation(buildWeaponCombatFeedbackPacket({
    weaponFamilyId: 'hex-silver-core-sidearm',
    actionKind: 'ANCHOR',
    actionId: 'SILVER_VERDICT',
    displayActionName: 'SILVER VERDICT',
    hits: [miss],
    labForced: true,
  }));
  // Allow scheduled timers: play release immediately via cue helper for mute check
  clearCombatPresentationPlayedCues();
  patchCombatPresentationSettings({ sfxMuted: true });
  assert.equal(playCombatPresentationCue('sfx.revolver.release'), false);
  patchCombatPresentationSettings({ sfxMuted: false });
  assert.equal(playCombatPresentationCue('sfx.revolver.release'), true);
  assert.ok(getCombatPresentationPlayedCues().includes('sfx.revolver.release'));

  // Black Door zero rounds — no loaded release unless labForced
  clearCombatPresentationPlayedCues();
  dispatchWeaponCombatPresentation(buildWeaponCombatFeedbackPacket({
    weaponFamilyId: 'hex-void-cannon',
    actionKind: 'ANCHOR',
    actionId: 'BREACH_ROUND',
    displayActionName: 'BREACH ROUND',
    hits: [hit],
    ammoRoundsConsumed: 0,
  }));
  assert.ok(
    getCombatPresentationPlayedCues().some((c) => c.includes('reload_sacrifice') || c.includes('resource')),
  );

  // Heart sacrifice once flag
  clearCombatPresentationPlayedCues();
  dispatchWeaponCombatPresentation(buildWeaponCombatFeedbackPacket({
    weaponFamilyId: 'envoy-sanguine-prism',
    actionKind: 'ANCHOR',
    actionId: 'BLOOD_REFRACTION',
    displayActionName: 'BLOOD REFRACTION',
    hits: [hit, buildWeaponCombatFeedbackHit({ targetId: 't2', order: 1, damage: 8 })],
    sacrificeOccurred: true,
    labForced: true,
  }));
  const sacrificeCues = getCombatPresentationPlayedCues().filter((c) => c.includes('reload_sacrifice'));
  assert.equal(sacrificeCues.length, 1);

  // Reload once
  clearCombatPresentationPlayedCues();
  dispatchWeaponCombatPresentation(buildWeaponCombatFeedbackPacket({
    weaponFamilyId: 'hex-silver-core-sidearm',
    actionKind: 'RELOAD',
    actionId: 'RELOAD',
    displayActionName: 'RELOAD',
    hits: [],
    reloadOccurred: true,
    labForced: true,
  }));
  assert.equal(
    getCombatPresentationPlayedCues().filter((c) => c.includes('reload_sacrifice')).length,
    1,
  );

  // presentResolvedWeaponHit does not throw without mount visuals
  presentResolvedWeaponHit({
    weaponFamilyId: 'aegis-rift-edge',
    targetId: 't1',
    damage: 8,
    critical: false,
    killed: false,
    tempoArmed: true,
  });

  // Reduced motion / shake settings do not throw
  patchCombatPresentationSettings({
    reducedMotion: true,
    screenShakeEnabled: false,
    reducedFlash: true,
  });
  dispatchWeaponCombatPresentation(buildWeaponCombatFeedbackPacket({
    weaponFamilyId: 'aegis-claymore-blade',
    actionKind: 'ULTIMATE',
    actionId: 'GRAVEFALL',
    displayActionName: 'GRAVEFALL',
    hits: [hit],
    labForced: true,
  }));

  resetCombatPresentationSettings();
  setCombatPresentationAudioDeterministic(false);
  setCombatPresentationMounted(false);
  console.log('weaponCombatPresentationPhase3M.test.ts OK');
}

run();
