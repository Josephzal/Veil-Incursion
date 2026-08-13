/**
 * Phase 3M repair — ultimate control activation + pose calibration integration tests.
 * Proves the center ultimate circle routes to the correct interaction controller
 * and that the minigame host gate includes staged WU-4 + OFFENSE_SLICE.
 */
import assert from 'node:assert/strict';
import {
  isWeaponUltimateInteractionOpen,
  isWeaponUltimateMinigameHostActive,
  listWeaponUltimateControllerMappings,
  resolveWeaponUltimateInteractionController,
  resolveWeaponUltimateInteractionControllerById,
} from './weaponUltimateActivationEngine';
import { shouldCancelUltimateOnZeroInput } from '../utils/ultimateActivationTrace';
import {
  canFireWeaponUltimate,
  formatWeaponUltimateLogTag,
  getWeaponUltimate,
  listWeaponUltimates,
} from './weaponUltimateRegistry';
import {
  formatWeaponUltimatePingAccessibilityLabel,
  resolveWeaponUltimateDisplayName,
  isWeaponUltimateActionId,
} from './weaponUltimateSurfaceEngine';
import {
  computeContentLockedDisplaySize,
  getPoseCalibrationForFamily,
  listPoseCalibrations,
} from '../utils/combatPortraitCalibration';
import { ALL_WEAPON_FAMILY_IDS } from './weaponRegistry';
import { presentResolvedWeaponHit } from './weaponCombatPresentation/presentResolvedWeaponHit';
import {
  clearCombatPresentationPlayedCues,
  getCombatPresentationPlayedCues,
  setCombatPresentationAudioDeterministic,
} from '../utils/combatPresentationAudio';
import {
  registerCombatPresentationPacketListener,
  setCombatPresentationMounted,
} from '../utils/combatPresentationBus';
import type { WeaponCombatFeedbackPacket } from '../types/weaponCombatPresentation';
import type { WeaponFamilyId } from '../types/weapon';

const EXPECTED: Array<{
  weaponFamilyId: WeaponFamilyId;
  displayName: string;
  controller: string;
}> = [
  { weaponFamilyId: 'aegis-longsword', displayName: 'ABYSSAL VERDICT', controller: 'THREEFOLD_BRAND_SLICE' },
  { weaponFamilyId: 'aegis-paired-blades', displayName: 'REND THE VEIL', controller: 'WU4_STAGED' },
  { weaponFamilyId: 'aegis-claymore', displayName: 'GRAVEFALL', controller: 'WU4_STAGED' },
  { weaponFamilyId: 'hex-revolver', displayName: 'SIXTH SEAL', controller: 'WU4_STAGED' },
  { weaponFamilyId: 'hex-carbine', displayName: 'ZERO PROTOCOL', controller: 'ZERO_PROTOCOL_GRID' },
  { weaponFamilyId: 'hex-shotgun', displayName: 'LAST KNOCK', controller: 'WU4_STAGED' },
  { weaponFamilyId: 'envoy-vambrace', displayName: 'FUNERAL KNOT', controller: 'WU4_STAGED' },
  { weaponFamilyId: 'envoy-scythe', displayName: 'NULL CIRCUIT', controller: 'NULL_CIRCUIT_SIGIL' },
  { weaponFamilyId: 'envoy-sanguine-prism', displayName: 'CRIMSON REFRACTION', controller: 'WU4_STAGED' },
];

function run(): void {
  console.log('Phase 3M repair — ultimate activation + pose integration');

  const mappings = listWeaponUltimateControllerMappings();
  assert.equal(mappings.length, 9);
  assert.equal(listWeaponUltimates().filter((u) => u.status === 'WIRED').length, 9);
  for (const expected of EXPECTED) {
    const ultimate = getWeaponUltimate(expected.weaponFamilyId);
    assert.equal(ultimate.displayName, expected.displayName);
    assert.equal(
      resolveWeaponUltimateInteractionController(expected.weaponFamilyId),
      expected.controller,
    );
    assert.equal(
      resolveWeaponUltimateInteractionControllerById(ultimate.id),
      expected.controller,
    );
    assert.equal(canFireWeaponUltimate(expected.weaponFamilyId), true);
    assert.ok(!formatWeaponUltimateLogTag(expected.weaponFamilyId).includes('The Black Door'));
    assert.ok(
      formatWeaponUltimatePingAccessibilityLabel(expected.weaponFamilyId)
        .includes(expected.displayName),
    );
    assert.equal(resolveWeaponUltimateDisplayName(expected.weaponFamilyId), expected.displayName);
  }

  assert.notEqual(
    resolveWeaponUltimateInteractionController('aegis-paired-blades'),
    resolveWeaponUltimateInteractionController('aegis-longsword'),
  );

  assert.equal(
    isWeaponUltimateMinigameHostActive({
      zeroProtocolVisible: false,
      cataclysmSigilVisible: false,
      catalyticConsoleVisible: false,
      activeReloadVisible: false,
      stagedWeaponUltimateId: null,
      cycleState: 'TEXT_COMBAT',
    }),
    false,
  );
  for (const id of [
    'GRAVEFALL',
    'REND_THE_VEIL',
    'SIXTH_SEAL',
    'LAST_KNOCK',
    'FUNERAL_KNOT',
    'CRIMSON_REFRACTION',
  ] as const) {
    assert.equal(
      isWeaponUltimateMinigameHostActive({ stagedWeaponUltimateId: id, cycleState: 'TEXT_COMBAT' }),
      true,
      `host must mount for ${id}`,
    );
  }
  assert.equal(isWeaponUltimateMinigameHostActive({ zeroProtocolVisible: true }), true);
  assert.equal(isWeaponUltimateMinigameHostActive({ cataclysmSigilVisible: true }), true);
  assert.equal(isWeaponUltimateMinigameHostActive({ cycleState: 'OFFENSE_SLICE' }), true);
  assert.equal(
    isWeaponUltimateInteractionOpen({ cycleState: 'OFFENSE_SLICE' }),
    true,
  );

  // Zero-input windows must cancel, never commit.
  assert.equal(shouldCancelUltimateOnZeroInput({ hitCount: 0 }), true);
  assert.equal(shouldCancelUltimateOnZeroInput({ tapCount: 0 }), true);
  assert.equal(shouldCancelUltimateOnZeroInput({ nodesCompleted: 0 }), true);
  assert.equal(shouldCancelUltimateOnZeroInput({ stageScores: [0, 0, 0] }), true);
  assert.equal(shouldCancelUltimateOnZeroInput({ hitCount: 1 }), false);
  assert.equal(shouldCancelUltimateOnZeroInput({ tapCount: 2 }), false);
  assert.equal(shouldCancelUltimateOnZeroInput({ nodesCompleted: 1 }), false);
  assert.equal(shouldCancelUltimateOnZeroInput({ stageScores: [0, 0.2, 0] }), false);
  assert.equal(shouldCancelUltimateOnZeroInput({ interacted: true, stageScores: [0, 0, 0] }), false);

  assert.equal(
    isWeaponUltimateInteractionOpen({ stagedWeaponUltimateId: 'GRAVEFALL' }),
    true,
  );
  assert.equal(
    isWeaponUltimateInteractionOpen({
      zeroProtocolVisible: false,
      cataclysmSigilVisible: false,
      stagedWeaponUltimateId: null,
      cycleState: 'TEXT_COMBAT',
    }),
    false,
  );

  setCombatPresentationAudioDeterministic(true);
  setCombatPresentationMounted(true);
  clearCombatPresentationPlayedCues();
  let packets: WeaponCombatFeedbackPacket[] = [];
  registerCombatPresentationPacketListener((p) => { packets.push(p); });
  assert.equal(packets.length, 0);
  assert.equal(getCombatPresentationPlayedCues().length, 0);

  packets = [];
  presentResolvedWeaponHit({
    weaponFamilyId: 'aegis-claymore',
    abilityId: 'EVISCERATE',
    targetId: 'e1',
    damage: 20,
    critical: false,
    killed: false,
  });
  assert.equal(packets.length, 1);
  assert.equal(packets[0].actionKind, 'ULTIMATE');
  assert.equal(isWeaponUltimateActionId('EVISCERATE'), true);
  assert.equal(isWeaponUltimateActionId('ZERO_PROTOCOL'), true);
  assert.equal(isWeaponUltimateActionId('CATACLYSM_SIGIL'), true);

  packets = [];
  presentResolvedWeaponHit({
    weaponFamilyId: 'aegis-longsword',
    abilityId: 'WARDENS_STRIKE',
    targetId: 'e1',
    damage: 10,
    critical: false,
    killed: false,
  });
  assert.equal(packets[0].actionKind, 'ANCHOR');

  packets = [];
  clearCombatPresentationPlayedCues();
  assert.equal(packets.length, 0);

  packets = [];
  presentResolvedWeaponHit({
    weaponFamilyId: 'aegis-paired-blades',
    abilityId: 'EVISCERATE',
    targetId: 'e1',
    damage: 8,
    critical: false,
    killed: false,
  });
  presentResolvedWeaponHit({
    weaponFamilyId: 'aegis-paired-blades',
    abilityId: 'EVISCERATE',
    targetId: 'e1',
    damage: 8,
    critical: false,
    killed: false,
  });
  assert.equal(packets.length, 1);

  const calibrations = listPoseCalibrations();
  assert.equal(calibrations.length, 9);
  // Size lock: every pose contentH scales to the same Vambrace idle target height.
  const REF_CONTENT_H = 1714; // envoy-vambrace idle
  const referenceContentDisplayH = 400; // arbitrary on-screen target
  const samples: Array<{ id: string; contentH: number }> = [
    { id: 'envoy-vambrace-idle', contentH: 1714 },
    { id: 'envoy-vambrace-attack', contentH: 1469 },
    { id: 'aegis-longsword-idle', contentH: 1140 },
    { id: 'aegis-paired-attack', contentH: 1340 },
    { id: 'aegis-unmaker-idle', contentH: 1533 },
    { id: 'hex-revolver-idle', contentH: 1205 },
    { id: 'hex-carbine-attack', contentH: 1675 },
    { id: 'scythe-attack', contentH: 1349 },
    { id: 'heart-attack', contentH: 1182 },
  ];
  for (const sample of samples) {
    const display = computeContentLockedDisplaySize({
      canvasW: 1000,
      canvasH: sample.contentH,
      contentH: sample.contentH,
      referenceContentDisplayH,
    });
    const onScreenContentH = sample.contentH * display.scale;
    assert.ok(
      Math.abs(onScreenContentH - referenceContentDisplayH) < 0.01,
      `${sample.id} content height mismatch`,
    );
  }
  assert.equal(REF_CONTENT_H, 1714);
  for (const id of ALL_WEAPON_FAMILY_IDS) {
    const idleCal = getPoseCalibrationForFamily(id, 'idle');
    const attackCal = getPoseCalibrationForFamily(id, 'attack');
    assert.ok(idleCal.releasePoint.x >= 0 && idleCal.releasePoint.x <= 1);
    assert.ok(attackCal.releasePoint.x >= 0 && attackCal.releasePoint.x <= 1);
  }

  // Placement + size: visualScale is the per-image tune knob.
  assert.ok(getPoseCalibrationForFamily('envoy-vambrace', 'idle').visualScale > 0.9);
  assert.ok(getPoseCalibrationForFamily('aegis-longsword', 'idle').visualScale > 0);
  assert.ok(getPoseCalibrationForFamily('envoy-scythe', 'attack').visualScale < 1);
  assert.ok(getPoseCalibrationForFamily('envoy-sanguine-prism', 'attack').visualScale < 1);

  // visualScale must affect display size
  const base = computeContentLockedDisplaySize({
    canvasW: 1000, canvasH: 1000, contentH: 1000, referenceContentDisplayH: 400,
  });
  const tuned = computeContentLockedDisplaySize({
    canvasW: 1000, canvasH: 1000, contentH: 1000, referenceContentDisplayH: 400, visualScale: 0.8,
  });
  assert.ok(Math.abs(tuned.height - base.height * 0.8) < 0.01);

  const snap = 'hex-shotgun' as WeaponFamilyId;
  assert.equal(resolveWeaponUltimateDisplayName(snap), 'LAST KNOCK');
  assert.equal(resolveWeaponUltimateInteractionController(snap), 'WU4_STAGED');

  registerCombatPresentationPacketListener(null);
  setCombatPresentationMounted(false);

  console.log('Phase 3M repair OK — host gate, nine controllers, cancel/commit boundaries, pose calibration');
}

run();
