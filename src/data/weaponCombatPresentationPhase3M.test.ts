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
  setHexReloadSuppressesAttackSfx,
} from '../utils/combatPresentationAudio';
import {
  dispatchWeaponCombatPresentation,
  setCombatPresentationMounted,
  clearCombatPresentationTimers,
} from '../utils/combatPresentationBus';
import { presentResolvedWeaponHit } from './weaponCombatPresentation/presentResolvedWeaponHit';

async function run(): Promise<void> {
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

  // Reload once — reload cue only, never attack/release
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
  assert.equal(
    getCombatPresentationPlayedCues().filter((c) => c.includes('.release') || c.includes('.attack')).length,
    0,
  );

  // Hex reload gate blocks attack cues even if something tries to fire them mid-reload
  clearCombatPresentationPlayedCues();
  setHexReloadSuppressesAttackSfx(true);
  assert.equal(playCombatPresentationCue('sfx.revolver.release'), false);
  assert.equal(playCombatPresentationCue('sfx.blackdoor.release'), false);
  assert.equal(playCombatPresentationCue('sfx.carbine.release'), false);
  assert.equal(playCombatPresentationCue('sfx.revolver.reload_sacrifice'), true);
  assert.ok(!getCombatPresentationPlayedCues().some((c) => c.endsWith('.release')));
  setHexReloadSuppressesAttackSfx(false);
  assert.equal(playCombatPresentationCue('sfx.revolver.release'), true);

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

  // Aegis miss/evade: miss cue replaces attack release (all Aegis weapons).
  patchCombatPresentationSettings({
    reducedMotion: false,
    screenShakeEnabled: true,
    reducedFlash: false,
  });
  const aegisAttackByFamily: Record<string, string> = {
    'aegis-runed-longsword': 'sfx.aegis.attack',
    'aegis-rift-edge': 'sfx.paired.attack',
    'aegis-claymore-blade': 'sfx.unmaker.attack',
  };
  for (const [familyId, attackCue] of Object.entries(aegisAttackByFamily)) {
    clearCombatPresentationTimers();
    clearCombatPresentationPlayedCues();
    dispatchWeaponCombatPresentation(buildWeaponCombatFeedbackPacket({
      weaponFamilyId: familyId as keyof typeof aegisAttackByFamily,
      actionKind: 'ANCHOR',
      actionId: 'STRIKE',
      displayActionName: 'STRIKE',
      hits: [miss],
      labForced: true,
    }));
    await new Promise((r) => setTimeout(r, 280));
    const cues = getCombatPresentationPlayedCues();
    assert.ok(cues.includes('sfx.aegis.miss'), `${familyId} miss cue`);
    assert.ok(!cues.includes(attackCue), `${familyId} must not play ${attackCue} on miss`);
  }

  clearCombatPresentationTimers();
  clearCombatPresentationPlayedCues();
  dispatchWeaponCombatPresentation(buildWeaponCombatFeedbackPacket({
    weaponFamilyId: 'aegis-runed-longsword',
    actionKind: 'ANCHOR',
    actionId: 'STRIKE',
    displayActionName: 'STRIKE',
    hits: [hit],
    labForced: true,
  }));
  await new Promise((r) => setTimeout(r, 280));
  const hitCues = getCombatPresentationPlayedCues();
  assert.ok(hitCues.includes('sfx.aegis.attack'), 'hit keeps attack cue');
  assert.ok(!hitCues.includes('sfx.aegis.miss'), 'hit must not play miss');

  resetCombatPresentationSettings();
  setCombatPresentationAudioDeterministic(false);
  setCombatPresentationMounted(false);
  console.log('weaponCombatPresentationPhase3M.test.ts OK');
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
