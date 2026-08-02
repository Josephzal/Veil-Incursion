/**
 * Warden's Strike presentation — Step 2 / 2B / 2C focused tests.
 * Run: npx --yes tsx src/data/wardenStrikePresentation.test.ts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  AEGIS_LONGSWORD_POSE_REGISTRATION,
  buildLongswordSweptBladeSamples,
  computeAnatomyRegisteredLayouts,
  mapRegisteredSourcePointToActorBox,
  sweptBladeSamplesWithinActorBox,
} from '../utils/combatPoseRegistration';
import {
  WARDEN_STRIKE_ART_CALIBRATION,
  authoredSlashRotationDeg,
  beginWardenStrikePresentation,
  cancelWardenStrikePresentation,
  computeSwingSmearPlacement,
  isWardenStrikeInputGuarded,
  isWardenStrikePresentationActive,
  shouldSuppressWardenCritImpactSlash,
  shouldSuppressWardenPrimedIdleAura,
  shouldUseWardenStrikePresentation,
  subscribeWardenStrikeContact,
  subscribeWardenStrikePresentation,
  WARDEN_STRIKE_TIMELINE_MS,
  WARDEN_STRIKE_VFX_LAYER_TOGGLES,
  WARDEN_STRIKE_REPLAY_FIXTURES,
  WARDEN_STRIKE_WRAPPER_MOTION_MS,
} from './wardenStrikePresentation';
import {
  approachAlignsBladeToTarget,
  artBoxLocalToWindow,
  computeBladeContactPoint,
  computeWardenApproachTranslation,
  registerWardenEnemyContactAnchor,
  registerWardenPlayerArtBox,
  resolveWardenApproachTranslation,
  WARDEN_BLADE_CONTACT_T,
} from './wardenStrikeApproach';

const ART_PATHS = [
  'assets/vfx/aegis/longsword/warden-strike-swing-smear.png',
  'assets/vfx/aegis/longsword/warden-strike-contact-burst.png',
  'assets/vfx/aegis/longsword/warden-strike-incision.png',
  'assets/vfx/aegis/longsword/warden-strike-fracture-crack.png',
] as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, '../..');
  for (const rel of ART_PATHS) {
    const full = path.join(repoRoot, rel);
    assert.ok(fs.existsSync(full), `missing asset ${rel}`);
    const buf = fs.readFileSync(full);
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50);
  }

  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredSwingSmear, false);
  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.swingTrail, false);
  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.proceduralSwingComparison, false);
  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredContactBurst, true);
  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.proceduralContactComparison, false);
  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.proceduralSparks, false);

  const box = { width: 304.5, height: 360 };
  const layouts = computeAnatomyRegisteredLayouts(box);
  assert.ok(layouts);

  {
    const idleHilt = mapRegisteredSourcePointToActorBox(
      layouts!.idle,
      AEGIS_LONGSWORD_POSE_REGISTRATION.idle.weaponHilt,
    );
    const idleTip = mapRegisteredSourcePointToActorBox(
      layouts!.idle,
      AEGIS_LONGSWORD_POSE_REGISTRATION.idle.weaponTip,
    );
    const atkHilt = mapRegisteredSourcePointToActorBox(
      layouts!.attack,
      AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponHilt,
    );
    const atkTip = mapRegisteredSourcePointToActorBox(
      layouts!.attack,
      AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponTip,
    );
    assert.ok(idleTip.y < idleHilt.y, 'idle blade is vertical / tip above hilt');
    assert.ok(atkTip.x > atkHilt.x, 'attack tip is screen-right of hilt');
    assert.ok(atkTip.y > idleTip.y, 'attack tip lower than idle tip (descending swing)');
  }

  {
    const samples = buildLongswordSweptBladeSamples(layouts!.idle, layouts!.attack, 4);
    assert.equal(samples.length, 4);
    assert.ok(samples[samples.length - 1].tip.x > samples[0].tip.x);
    assert.ok(samples[samples.length - 1].tip.y > samples[0].tip.y);
    assert.equal(
      sweptBladeSamplesWithinActorBox(samples, box, 28),
      true,
      'trail geometry stays player-local',
    );
    const facing = AEGIS_LONGSWORD_POSE_REGISTRATION.attack.targetFacing;
    const place = computeSwingSmearPlacement(
      samples,
      facing.x,
      facing.y,
      WARDEN_STRIKE_ART_CALIBRATION.swingSmear,
      box.width,
    );
    assert.ok(place);
    assert.ok(place!.width >= 260 && place!.width <= 340, 'smear width in battlefield band');
    assert.ok(place!.imageWidth > place!.width, 'source crop leaves image wider than clip');
    assert.ok(
      place!.left + place!.width <= place!.sampleBounds.maxX + 20,
      'smear does not extend far past blade tip',
    );
    assert.ok(place!.centerX > -40 && place!.centerX < box.width + 40);
    assert.ok(place!.centerY > -40 && place!.centerY < box.height + 40);
    const rot = authoredSlashRotationDeg(facing.x, facing.y, 45);
    assert.ok(Number.isFinite(rot));
  }

  {
    const layouts2 = computeAnatomyRegisteredLayouts(box)!;
    const hilt = mapRegisteredSourcePointToActorBox(
      layouts2.attack,
      AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponHilt,
    );
    const tip = mapRegisteredSourcePointToActorBox(
      layouts2.attack,
      AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponTip,
    );
    const blade = computeBladeContactPoint(hilt, tip, WARDEN_BLADE_CONTACT_T);
    assert.ok(blade.x > hilt.x && blade.x < tip.x + 1);
    assert.ok(Math.abs(blade.x - (hilt.x + (tip.x - hilt.x) * 0.91)) < 0.01);

    // Near target (small gap)
    const artWindow = { x: 40, y: 200, width: box.width, height: box.height };
    registerWardenPlayerArtBox(artWindow, box);
    const nearTarget = artBoxLocalToWindow(
      { x: blade.x + 70, y: blade.y },
      artWindow,
      box,
    );
    registerWardenEnemyContactAnchor('near-enemy', nearTarget);
    const nearDelta = resolveWardenApproachTranslation('near-enemy', blade)!;
    assert.ok(nearDelta.x > 40 && nearDelta.x < 120, `near approach x=${nearDelta.x}`);
    const nearAfter = artBoxLocalToWindow(
      { x: blade.x + nearDelta.x, y: blade.y + nearDelta.y },
      artWindow,
      box,
    );
    assert.ok(
      approachAlignsBladeToTarget({
        bladeContactAfterTranslation: nearAfter,
        targetContact: nearTarget,
        tolerancePx: 8,
      }),
      'near blade aligns to target',
    );

    // Far target
    const farTarget = artBoxLocalToWindow(
      { x: blade.x + 220, y: blade.y - 10 },
      artWindow,
      box,
    );
    registerWardenEnemyContactAnchor('far-enemy', farTarget);
    const farDelta = resolveWardenApproachTranslation('far-enemy', blade)!;
    assert.ok(farDelta.x > nearDelta.x, 'far target needs larger approach');
    const farAfter = artBoxLocalToWindow(
      { x: blade.x + farDelta.x, y: blade.y + farDelta.y },
      artWindow,
      box,
    );
    assert.ok(
      approachAlignsBladeToTarget({
        bladeContactAfterTranslation: farAfter,
        targetContact: farTarget,
        tolerancePx: 8,
      }),
      'far blade aligns to target',
    );
    const farLocal = computeWardenApproachTranslation({
      bladeContactLocal: blade,
      targetContactWindow: farTarget,
      artBoxWindow: artWindow,
      logicalSize: box,
    });
    assert.equal(farLocal.x, farDelta.x);
  }

  {
    const a = computeAnatomyRegisteredLayouts(box)!;
    for (let i = 0; i < 12; i += 1) {
      const b = computeAnatomyRegisteredLayouts(box)!;
      assert.equal(b.attack.left, a.attack.left);
      assert.equal(b.attack.top, a.attack.top);
      assert.equal(b.attack.scale, a.attack.scale);
      const tipA = mapRegisteredSourcePointToActorBox(
        a.attack,
        AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponTip,
      );
      const tipB = mapRegisteredSourcePointToActorBox(
        b.attack,
        AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponTip,
      );
      assert.equal(tipA.x, tipB.x);
      assert.equal(tipA.y, tipB.y);
    }
  }

  assert.equal(
    shouldUseWardenStrikePresentation({
      weaponFamilyId: 'aegis-runed-longsword',
      abilityId: 'STRIKE',
    }),
    true,
  );
  assert.equal(
    shouldUseWardenStrikePresentation({
      weaponFamilyId: 'aegis-runed-longsword',
      abilityId: 'VEIL_PIERCER',
    }),
    false,
  );
  assert.equal(
    shouldUseWardenStrikePresentation({
      weaponFamilyId: 'aegis-rift-edge',
      abilityId: 'STRIKE',
    }),
    false,
    'authored swing routed only for Longsword Warden Strike',
  );

  cancelWardenStrikePresentation();
  assert.equal(shouldSuppressWardenCritImpactSlash(), false, 'other attacks keep crit slash');
  beginWardenStrikePresentation({
    presentationId: 'suppress-yellow',
    targetId: 'u0',
    damage: 10,
    critical: true,
    killed: false,
    outcome: 'HIT',
    defenseMaterial: 'NONE',
    fractureApplied: false,
    replayOnly: true,
  });
  assert.equal(shouldSuppressWardenCritImpactSlash(), true);
  cancelWardenStrikePresentation();
  assert.equal(shouldSuppressWardenCritImpactSlash(), false);

  {
    const phases: string[] = [];
    let contacts = 0;
    const unsub = subscribeWardenStrikePresentation((e) => {
      phases.push(e.phase);
    });
    const unsubContact = subscribeWardenStrikeContact((result) => {
      contacts += 1;
      assert.equal(result.outcome, 'HIT');
      assert.equal(result.fractureApplied, true);
    });
    const ok = beginWardenStrikePresentation({
      presentationId: 'test-1',
      targetId: 'u1',
      damage: 12,
      critical: false,
      killed: false,
      outcome: 'HIT',
      defenseMaterial: 'NONE',
      fractureApplied: true,
    });
    assert.equal(ok, true);
    assert.equal(isWardenStrikePresentationActive(), true);
    assert.equal(isWardenStrikeInputGuarded(), true);
    assert.equal(beginWardenStrikePresentation({
      presentationId: 'test-2',
      targetId: 'u1',
      damage: 12,
      critical: false,
      killed: false,
      outcome: 'HIT',
      defenseMaterial: 'NONE',
      fractureApplied: false,
    }), false);
    await delay(WARDEN_STRIKE_TIMELINE_MS.doneAt + 80);
    assert.equal(contacts, 1);
    assert.ok(phases.includes('anticipation'));
    assert.ok(phases.includes('release'));
    assert.ok(phases.includes('contact'));
    assert.ok(phases.includes('done'));
    unsub();
    unsubContact();
  }

  {
    cancelWardenStrikePresentation();
    let missOutcome: string | null = null;
    const unsub = subscribeWardenStrikeContact((result) => {
      missOutcome = result.outcome;
    });
    beginWardenStrikePresentation({
      presentationId: 'test-miss',
      targetId: 'u2',
      damage: 0,
      critical: false,
      killed: false,
      outcome: 'EVADE',
      defenseMaterial: 'NONE',
      fractureApplied: false,
    });
    await delay(WARDEN_STRIKE_TIMELINE_MS.contactAt + 40);
    assert.equal(missOutcome, 'EVADE', 'miss omits target-contact art');
    unsub();
  }

  {
    cancelWardenStrikePresentation();
    let armorMat: string | null = null;
    const unsub = subscribeWardenStrikeContact((result) => {
      armorMat = result.defenseMaterial;
    });
    beginWardenStrikePresentation({
      presentationId: 'armor',
      targetId: 'uA',
      damage: 4,
      critical: false,
      killed: false,
      outcome: 'HIT',
      defenseMaterial: 'KINETIC_ARMOR',
      fractureApplied: false,
      replayOnly: true,
    });
    await delay(WARDEN_STRIKE_TIMELINE_MS.contactAt + 40);
    assert.equal(armorMat, 'KINETIC_ARMOR');
    unsub();
  }

  {
    cancelWardenStrikePresentation();
    let fractureHits = 0;
    let noFractureHits = 0;
    const unsub = subscribeWardenStrikeContact((result) => {
      if (result.fractureApplied) fractureHits += 1;
      else noFractureHits += 1;
    });
    beginWardenStrikePresentation({
      presentationId: 'fx-on',
      targetId: 'u3',
      damage: 10,
      critical: false,
      killed: false,
      outcome: 'HIT',
      defenseMaterial: 'NONE',
      fractureApplied: true,
      replayOnly: true,
    });
    await delay(WARDEN_STRIKE_TIMELINE_MS.contactAt + 40);
    beginWardenStrikePresentation({
      presentationId: 'fx-off',
      targetId: 'u3',
      damage: 10,
      critical: false,
      killed: false,
      outcome: 'HIT',
      defenseMaterial: 'NONE',
      fractureApplied: false,
      replayOnly: true,
    });
    await delay(WARDEN_STRIKE_TIMELINE_MS.contactAt + 40);
    assert.equal(fractureHits, 1);
    assert.equal(noFractureHits, 1);
    unsub();
  }

  {
    beginWardenStrikePresentation({
      presentationId: 'cancel-me',
      targetId: 'u4',
      damage: 1,
      critical: false,
      killed: false,
      outcome: 'HIT',
      defenseMaterial: 'NONE',
      fractureApplied: false,
      replayOnly: true,
    });
    assert.equal(isWardenStrikePresentationActive(), true);
    cancelWardenStrikePresentation();
    assert.equal(isWardenStrikePresentationActive(), false);
  }

  assert.ok(
    WARDEN_STRIKE_ART_CALIBRATION.contactBurst.reducedFlashPeakOpacity
      < WARDEN_STRIKE_ART_CALIBRATION.contactBurst.peakOpacity,
  );
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.doneAt <= 950);
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.approachEnd <= WARDEN_STRIKE_TIMELINE_MS.contactAt);
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.smearStart <= WARDEN_STRIKE_TIMELINE_MS.critStingAt);
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.critStingAt <= WARDEN_STRIKE_TIMELINE_MS.feedbackAt);
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.feedbackAt <= WARDEN_STRIKE_TIMELINE_MS.contactAt);
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.returnStart >= WARDEN_STRIKE_TIMELINE_MS.holdEnd);
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.recoveryStart >= WARDEN_STRIKE_TIMELINE_MS.returnEnd);
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.doneAt > WARDEN_STRIKE_TIMELINE_MS.recoveryStart);
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.smearStart >= WARDEN_STRIKE_TIMELINE_MS.approachStart);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.swingSmear.peakOpacity >= 0.66);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.swingSmear.peakOpacity <= 0.74);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.swingSmear.sourceCropRight <= 0.8);
  assert.equal(WARDEN_STRIKE_ART_CALIBRATION.swingSmear.sourceCropRight, 0.78);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.contactBurst.logicalWidthPx >= 200);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.contactBurst.logicalWidthPx <= 210);
  const burstLife = WARDEN_STRIKE_ART_CALIBRATION.contactBurst.popInMs
    + WARDEN_STRIKE_ART_CALIBRATION.contactBurst.holdMs
    + WARDEN_STRIKE_ART_CALIBRATION.contactBurst.fadeMs;
  assert.ok(burstLife >= 200);
  assert.ok(burstLife <= 320);
  assert.equal(
    WARDEN_STRIKE_ART_CALIBRATION.incision.logicalLengthPx,
    WARDEN_STRIKE_ART_CALIBRATION.contactBurst.logicalWidthPx,
  );
  assert.equal(WARDEN_STRIKE_ART_CALIBRATION.incision.offsetX, 0);
  assert.equal(WARDEN_STRIKE_ART_CALIBRATION.incision.offsetY, 0);
  assert.ok((WARDEN_STRIKE_ART_CALIBRATION.incision.delayMs ?? 0) >= 30);
  assert.ok((WARDEN_STRIKE_ART_CALIBRATION.incision.delayMs ?? 0) <= 45);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.fractureCrack.logicalWidthPx >= 75);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.fractureCrack.delayMs >= 50);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.swingSmear.maxLogicalWidthPx <= 300);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.swingSmear.minLogicalWidthPx >= 220);
  assert.equal(WARDEN_STRIKE_WRAPPER_MOTION_MS.holdMs, 500);
  assert.equal(WARDEN_STRIKE_TIMELINE_MS.hitStop, 70);
  const motionTotal = WARDEN_STRIKE_WRAPPER_MOTION_MS.homeHoldMs
    + WARDEN_STRIKE_WRAPPER_MOTION_MS.outMs
    + WARDEN_STRIKE_WRAPPER_MOTION_MS.holdMs
    + WARDEN_STRIKE_WRAPPER_MOTION_MS.returnMs;
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.doneAt >= motionTotal);
  assert.equal(
    WARDEN_STRIKE_TIMELINE_MS.holdEnd - WARDEN_STRIKE_TIMELINE_MS.contactAt,
    WARDEN_STRIKE_WRAPPER_MOTION_MS.holdMs,
  );
  assert.ok((WARDEN_STRIKE_ART_CALIBRATION.incision.delayMs ?? 0) >= 30);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.fractureCrack.delayMs >= 80);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.incision.lifetimeMs >= 280);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.incision.lifetimeMs <= 400);
  assert.ok(WARDEN_STRIKE_ART_CALIBRATION.fractureCrack.lifetimeMs >= 240);
  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.swingTrail, false);
  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredSwingSmear, false);
  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.proceduralSwingComparison, false);
  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.contactBoundsDebug, false);
  assert.equal(WARDEN_STRIKE_VFX_LAYER_TOGGLES.primedIdleAuraForceShow, false);
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.enemyRecoilPx >= 20);
  assert.ok(WARDEN_STRIKE_TIMELINE_MS.enemyRecoilPx <= 24);
  assert.ok(
    shouldSuppressWardenPrimedIdleAura === undefined
      || typeof shouldSuppressWardenPrimedIdleAura === 'function',
  );

  {
    cancelWardenStrikePresentation();
    assert.equal(shouldSuppressWardenPrimedIdleAura(), false);
    beginWardenStrikePresentation({
      presentationId: 'aura-suppress',
      targetId: 'uAura',
      damage: 10,
      critical: false,
      killed: false,
      outcome: 'HIT',
      defenseMaterial: 'NONE',
      fractureApplied: false,
      replayOnly: true,
    });
    assert.equal(shouldSuppressWardenPrimedIdleAura(), true);
    cancelWardenStrikePresentation();
    assert.equal(shouldSuppressWardenPrimedIdleAura(), false);
  }

  {
    // Pose scale: idle and attack share actor-box scale; approach wrapper uses scale:1.
    const layoutsH = computeAnatomyRegisteredLayouts(box)!;
    const idleH = layoutsH.idle.renderedBodyHeight;
    const attackH = layoutsH.attack.renderedBodyHeight;
    const ratio = attackH / idleH;
    assert.ok(Math.abs(ratio - 1) < 0.02, `idle/attack body height ratio ${ratio}`);
    assert.equal(layoutsH.idle.footX, layoutsH.attack.footX);
    assert.equal(layoutsH.idle.footY, layoutsH.attack.footY);
  }

  assert.equal(
    shouldUseWardenStrikePresentation({
      weaponFamilyId: 'aegis-runed-longsword',
      abilityId: 'STRIKE',
      actionKind: 'RIPOSTE',
      playerActionKind: 'RIPOSTE',
    }),
    false,
    'Standalone Riposte must not arm Warden presentation',
  );
  assert.equal(
    shouldUseWardenStrikePresentation({
      weaponFamilyId: 'aegis-runed-longsword',
      abilityId: 'STRIKE',
      actionKind: 'RIPOSTE',
      playerActionKind: 'STRIKE',
    }),
    true,
    'Riposte cash-out during Warden Strike still owns one Warden presentation',
  );
  assert.equal(
    shouldUseWardenStrikePresentation({
      weaponFamilyId: 'aegis-runed-longsword',
      abilityId: 'STRIKE',
      playerActionKind: 'STRIKE',
      nestedPresentation: true,
    }),
    false,
    'Nested damage sources cannot start another approach',
  );

  {
    cancelWardenStrikePresentation();
    let armorDamage = -1;
    let armorMat = '';
    const unsub = subscribeWardenStrikeContact((result) => {
      armorDamage = result.damage;
      armorMat = result.defenseMaterial;
    });
    beginWardenStrikePresentation({
      presentationId: 'armor-dmg',
      targetId: 'uArmor',
      damage: 16,
      critical: false,
      killed: false,
      outcome: 'HIT',
      defenseMaterial: 'KINETIC_ARMOR',
      fractureApplied: false,
      replayOnly: true,
    });
    await delay(WARDEN_STRIKE_TIMELINE_MS.contactAt + 40);
    assert.equal(armorDamage, 16, 'Armor break with positive HP damage');
    assert.equal(armorMat, 'KINETIC_ARMOR');
    unsub();
  }

  {
    const { replayWardenStrikeFixture, WARDEN_STRIKE_REPLAY_FIXTURES } = await import(
      './wardenStrikePresentation'
    );
    assert.ok(WARDEN_STRIKE_REPLAY_FIXTURES.cleanHit);
    assert.ok(WARDEN_STRIKE_REPLAY_FIXTURES.armorBreakWithDamage.damage > 0);
    assert.equal(WARDEN_STRIKE_REPLAY_FIXTURES.armorBreakWithDamage.defenseMaterial, 'KINETIC_ARMOR');
    assert.ok(WARDEN_STRIKE_REPLAY_FIXTURES.riposteCashOut);
    assert.ok(WARDEN_STRIKE_REPLAY_FIXTURES.smearIsolation);
    cancelWardenStrikePresentation();
    assert.equal(replayWardenStrikeFixture('miss'), true);
    await delay(40);
    cancelWardenStrikePresentation();
  }

  {
    // Step 2F — single owner, identical translation, no accumulate.
    const {
      beginWardenStrikePresentation: begin,
      cancelWardenStrikePresentation: cancel,
      contributeWardenStrikeContactDamage,
      getWardenPresentationInstanceCountForAction,
      getWardenStrikeActiveApproachGeometry,
      lockWardenApproachGeometry,
    } = await import('./wardenStrikePresentation');
    const {
      buildWardenApproachGeometrySnapshot,
      registerWardenEnemyContactAnchor,
      registerWardenPlayerArtBox,
      computeWardenApproachTranslation,
      approachAlignsBladeToTarget,
      artBoxLocalToWindow,
    } = await import('./wardenStrikeApproach');

    cancel();
    registerWardenPlayerArtBox(
      { x: 40, y: 200, width: 160, height: 200 },
      { width: 304.5, height: 360 },
    );
    registerWardenEnemyContactAnchor('uSame', { x: 220, y: 260 });
    const hilt = mapRegisteredSourcePointToActorBox(
      layouts!.attack,
      AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponHilt,
    );
    const tip = mapRegisteredSourcePointToActorBox(
      layouts!.attack,
      AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponTip,
    );
    const snap = buildWardenApproachGeometrySnapshot({
      targetId: 'uSame',
      hiltLocal: hilt,
      tipLocal: tip,
    });
    assert.ok(snap);
    const deltas: Array<{ x: number; y: number }> = [];
    for (const outcome of [
      { outcome: 'HIT' as const, defenseMaterial: 'NONE' as const, damage: 16 },
      { outcome: 'HIT' as const, defenseMaterial: 'KINETIC_ARMOR' as const, damage: 8 },
      { outcome: 'HIT' as const, defenseMaterial: 'OCCULT_WARD' as const, damage: 0 },
      { outcome: 'MISS' as const, defenseMaterial: 'NONE' as const, damage: 0 },
      { outcome: 'HIT' as const, defenseMaterial: 'NONE' as const, damage: 28, resultSource: 'warden-with-riposte' },
    ]) {
      cancel();
      const playerActionId = `pa-same-target-${outcome.outcome}-${outcome.defenseMaterial}-${outcome.damage}`;
      const ok = begin({
        presentationId: `own-${outcome.outcome}-${outcome.defenseMaterial}-${outcome.damage}`,
        resolvedResultId: `rr-${outcome.outcome}-${outcome.damage}`,
        playerActionId,
        sourceActionKind: 'STRIKE',
        sourceAbilityId: 'STRIKE',
        resultSource: outcome.resultSource ?? 'player-action',
        targetId: 'uSame',
        damage: outcome.damage,
        critical: false,
        killed: false,
        outcome: outcome.outcome,
        defenseMaterial: outcome.defenseMaterial,
        fractureApplied: false,
        approachGeometry: snap!,
        replayOnly: true,
      });
      assert.equal(ok, true);
      const locked = lockWardenApproachGeometry(snap!);
      deltas.push(locked.translationLocal);
      assert.equal(getWardenPresentationInstanceCountForAction(), 1);
      const contributed = contributeWardenStrikeContactDamage({
        playerActionId,
        damage: 3,
      });
      // Nested contribute allowed; must not create a second presentation.
      assert.equal(contributed, true);
      assert.equal(
        begin({
          presentationId: 'nested-should-fail',
          resolvedResultId: 'rr-nested',
          playerActionId,
          sourceActionKind: 'STRIKE',
          sourceAbilityId: 'STRIKE',
          resultSource: 'nested',
          targetId: 'uSame',
          damage: 4,
          critical: false,
          killed: false,
          outcome: 'HIT',
          defenseMaterial: 'NONE',
          fractureApplied: false,
          approachGeometry: snap!,
        }),
        false,
        'Exactly one Warden presentation per player action',
      );
      cancel();
    }
    for (let i = 1; i < deltas.length; i += 1) {
      assert.equal(deltas[i].x, deltas[0].x, 'identical translation across result types');
      assert.equal(deltas[i].y, deltas[0].y, 'identical translation across result types');
    }
    const bladeAfter = {
      x: snap!.bladeContactLocal.x + snap!.translationLocal.x,
      y: snap!.bladeContactLocal.y + snap!.translationLocal.y,
    };
    const bladeWindow = artBoxLocalToWindow(
      bladeAfter,
      snap!.playerStartWindow,
      snap!.logicalSize,
    );
    assert.ok(
      approachAlignsBladeToTarget({
        bladeContactAfterTranslation: bladeWindow,
        targetContact: snap!.targetContactWindow,
        tolerancePx: 12,
      })
      || Math.abs(snap!.translationLocal.x) <= Math.max(96, snap!.logicalSize.width * 0.92),
      'blade contact within approach tolerance / body-left cap',
    );
    const again = computeWardenApproachTranslation({
      bladeContactLocal: snap!.bladeContactLocal,
      targetContactWindow: snap!.targetContactWindow,
      artBoxWindow: snap!.playerStartWindow,
      logicalSize: snap!.logicalSize,
    });
    assert.equal(again.x, snap!.translationLocal.x, 'translation cannot accumulate');
    assert.equal(getWardenStrikeActiveApproachGeometry(), null);
  }

  {
    // Step 2G — callout lanes never intersect; Brand plane below Warden player.
    const {
      resolveWardenCalloutLanes,
      calloutRectsIntersect,
      WARDEN_CALLOUT_MIN_GAP_PX,
      WARDEN_CALLOUT_HOTSPOT_AVOID_Y,
    } = await import('./wardenCalloutLayout');
    const { brandPlaneIsBelowWardenPlayer, WARDEN_ARENA_PLANE } = await import('./wardenArenaPlanes');
    const { mayPublishCriticalCallout } = await import('./wardenCalloutOwnership');

    const fixtures = [
      { name: 'armor-zero', hasDamage: false, hasDefense: true, hasCritical: false },
      { name: 'armor-damage', hasDamage: true, hasDefense: true, hasCritical: false },
      { name: 'ward-zero', hasDamage: false, hasDefense: true, hasCritical: false },
      { name: 'ward-damage', hasDamage: true, hasDefense: true, hasCritical: false },
      { name: 'crit-damage', hasDamage: true, hasDefense: false, hasCritical: true },
    ] as const;

    for (const fixture of fixtures) {
      const plan = resolveWardenCalloutLanes({
        hasDamage: fixture.hasDamage,
        hasDefense: fixture.hasDefense,
        hasCritical: fixture.hasCritical,
        damageSize: { width: 40, height: 20 },
        defenseSize: { width: 118, height: 16 },
        criticalSize: { width: 78, height: 16 },
        minGapPx: WARDEN_CALLOUT_MIN_GAP_PX,
        hotspotAvoidOffsetY: WARDEN_CALLOUT_HOTSPOT_AVOID_Y,
      });
      const rects = [plan.damage, plan.defense, plan.critical].filter(Boolean);
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          assert.equal(
            calloutRectsIntersect(rects[i]!, rects[j]!),
            false,
            `${fixture.name}: lanes must not intersect`,
          );
        }
      }
      if (plan.damage && plan.defense) {
        assert.ok(plan.damageDefenseGapPx >= WARDEN_CALLOUT_MIN_GAP_PX, fixture.name);
      }
      if (plan.damage) {
        assert.ok(
          plan.damage.top + plan.damage.height / 2 < 0,
          `${fixture.name}: damage sits above click hotspot origin`,
        );
      }
    }

    const plan = resolveWardenCalloutLanes({
      hasDamage: true,
      hasDefense: true,
      damageSize: { width: 40, height: 20 },
      defenseSize: { width: 118, height: 16 },
      minGapPx: WARDEN_CALLOUT_MIN_GAP_PX,
    });
    assert.ok(plan.damage);
    assert.ok(plan.defense);
    assert.ok(plan.damageDefenseGapPx >= WARDEN_CALLOUT_MIN_GAP_PX);
    assert.equal(calloutRectsIntersect(plan.damage!, plan.defense!), false);
    assert.ok(plan.defense!.top + plan.defense!.height <= plan.damage!.top - WARDEN_CALLOUT_MIN_GAP_PX + 0.001);

    const armorOnly = resolveWardenCalloutLanes({ hasDamage: false, hasDefense: true });
    assert.equal(armorOnly.damage, null);
    assert.ok(armorOnly.defense);

    const dmgOnly = resolveWardenCalloutLanes({ hasDamage: true, hasDefense: false });
    assert.ok(dmgOnly.damage);
    assert.equal(dmgOnly.defense, null);

    assert.equal(brandPlaneIsBelowWardenPlayer(), true);
    assert.ok(WARDEN_ARENA_PLANE.brandAndEnemyArt < WARDEN_ARENA_PLANE.wardenPlayer);
    assert.ok(WARDEN_ARENA_PLANE.wardenPlayer < WARDEN_ARENA_PLANE.responseText);
    assert.ok(WARDEN_ARENA_PLANE.responseText < WARDEN_ARENA_PLANE.globalHud);

    assert.ok(WARDEN_STRIKE_TIMELINE_MS.enemyRecoilPx >= 20);
    assert.ok(WARDEN_STRIKE_TIMELINE_MS.enemyRecoilPx <= 24);
    assert.ok(WARDEN_STRIKE_TIMELINE_MS.enemyRecoilDeg >= 0.65);
    assert.ok(WARDEN_STRIKE_TIMELINE_MS.enemyRecoilDeg <= 0.85);
    assert.ok(WARDEN_STRIKE_TIMELINE_MS.enemyRecoilOutMs >= 45);
    assert.ok(WARDEN_STRIKE_TIMELINE_MS.enemyRecoilOutMs <= 55);
    assert.ok(WARDEN_STRIKE_TIMELINE_MS.enemyRecoilReturnMs >= 95);
    assert.ok(WARDEN_STRIKE_TIMELINE_MS.enemyRecoilReturnMs <= 115);

    // Step 2H — CRITICAL may only publish for the matching critical result target.
    assert.equal(
      mayPublishCriticalCallout({
        resultTargetId: 'scuttler',
        resultCritical: false,
        calloutTargetId: 'thrall',
      }),
      false,
      'Non-critical Warden must never publish CRITICAL on Thrall',
    );
    assert.equal(
      mayPublishCriticalCallout({
        resultTargetId: 'scuttler',
        resultCritical: false,
        calloutTargetId: 'scuttler',
      }),
      false,
      'Non-critical Warden must never publish CRITICAL on Scuttler',
    );
    assert.equal(
      mayPublishCriticalCallout({
        resultTargetId: 'scuttler',
        resultCritical: true,
        calloutTargetId: 'thrall',
      }),
      false,
      'Critical on Scuttler must not place CRITICAL on Thrall',
    );
    assert.equal(
      mayPublishCriticalCallout({
        resultTargetId: 'scuttler',
        resultCritical: true,
        calloutTargetId: 'scuttler',
      }),
      true,
      'Critical Warden result publishes CRITICAL on its own target',
    );
    assert.equal(
      mayPublishCriticalCallout({
        resultTargetId: 'scuttler',
        resultCritical: true,
        calloutTargetId: 'scuttler',
        resultDamage: 0,
      }),
      false,
      'Critical roll with zero damage must not publish CRITICAL',
    );

    assert.ok(WARDEN_STRIKE_REPLAY_FIXTURES.armorBreakNoDamage);
    assert.equal(WARDEN_STRIKE_REPLAY_FIXTURES.armorBreakNoDamage.damage, 0);
    assert.ok(WARDEN_STRIKE_REPLAY_FIXTURES.wardResponseWithDamage.damage > 0);
    assert.ok(WARDEN_STRIKE_REPLAY_FIXTURES.recoilIsolation);
    assert.equal(WARDEN_STRIKE_ART_CALIBRATION.swingSmear.peakOpacity, 0.70);
  }

  console.log('[warden strike] presentation tests passed (Step 2K acceptance)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
