import assert from 'node:assert/strict';
import {
  applyCrystalLigatureFormationShards,
  applyFaultglassEdgeFault,
  applyFaultglassRuptureShards,
  applyFateOutOfPlaceReleaseBonus,
  applyFateOutOfPlaceStore,
  applyParallaxEchoTraceMovement,
  applyPhantomFacetGeneration,
  applyPrismaticRiteDeferredBeat,
  applyPrismaticRiteFinaleShards,
  applySoulglassGeneration,
  applySoulglassResidualCarry,
  applyStillglassNativeStillnessShards,
  applyTetheredOrbitArmedBonus,
  applyTetheredOrbitFormationPolarity,
  applyTurningRiteAdvance,
  applyTurningRiteDeferredBeat,
  applyTurningRiteFinaleBonus,
  armParallaxEchoFromDisplacement,
  armPrismaticRiteDeferredBeat,
  armStillglassPendingFleeting,
  armTetheredOrbitPartnerOnDisplacement,
  clearTetheredOrbitArmIfInvalid,
  consumeParallaxEchoArm,
  consumePhantomFacetArm,
  consumeStillglassPendingFleeting,
  crystalLigatureMirrorAmount,
} from './nineStrain/sector4ConvergenceEngine';
import { attemptDisplacement, createDefaultGravemarkState } from './nineStrain/gravemarkEngine';
import { createDefaultCounterfateState } from './nineStrain/counterfateEngine';
import { createDefaultFaultlineState } from './nineStrain/faultlineEngine';
import { createDefaultRitualCadenceState } from './nineStrain/ritualCadenceEngine';
import { createDefaultShardskinState } from './nineStrain/shardskinEngine';
import { createDefaultSoulwakeState } from './nineStrain/soulwakeEngine';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import type { Sector4ConvergenceRuntimeState } from '../types/convergence';
import { CONVERGENCE_IDS } from '../types/convergence';
import type { HostileIntentSnapshot } from '../types/counterfate';
import type { CanonicalRootActionContext } from '../types/nineStrain';

console.log('Stage E.3 — Sector 4 Convergence mechanic coverage');

function defaultS4(): Sector4ConvergenceRuntimeState {
  return {
    fateOutOfPlaceStoreEventId: null,
    fateOutOfPlaceReleaseBonusUsedThisEnemyCycle: false,
    turningRiteAdvanceUsedThisPlayerTurn: false,
    turningRiteDeferredBeat: false,
    turningRiteFinaleBonusAppliedRootId: null,
    parallaxEchoMovementUsedThisPlayerTurn: false,
    parallaxEchoArmUsedThisPlayerTurn: false,
    parallaxEchoArmed: false,
    storedVectorProcessedRootId: null,
    tetheredOrbitArmedPartnerId: null,
    tetheredOrbitArmedAfterRootId: null,
    tetheredOrbitBonusUsedThisPlayerTurn: false,
    tectonicShiftFaultAppliedTargetIds: [],
    tectonicShiftRuptureBonusUsedThisCombatCycle: false,
    traumaVectorUsedThisCombatCycle: false,
    fatedFacetThresholdWindowKey: null,
    fatedFacetThresholdCrossedThisWindow: false,
    fatedFacetAbsorptionLineageId: null,
    fatedFacetAbsorptionStoredThisLineage: 0,
    prismaticRiteFinaleShardsRootId: null,
    prismaticRiteDeferredBeat: false,
    prismaticRiteCathedralPendingRootId: null,
    phantomFacetGenerationUsedThisPlayerTurn: false,
    phantomFacetArmed: false,
    phantomFacetArmedRootId: null,
    stillglassAbsorptionArmedThisEnemyCycle: false,
    stillglassPendingFleeting: false,
    crystalLigatureFormationUsedThisPlayerTurn: false,
    faultglassRuptureUsedThisPlayerTurn: false,
    soulglassGenerationUsedThisPlayerTurn: false,
    impactLatticeGenerationUsedThisCombatCycle: false,
  };
}

let seq = 0;
function liveIntent(unitId: string, slot: 'FL_0' | 'FL_1' | 'BL_0' | 'BL_1', extra: Partial<HostileIntentSnapshot> = {}): HostileIntentSnapshot {
  seq += 1;
  return {
    ...hostileSnapshotInput({ unitId, intentKind: 'STRIKE', hostileTurnOrder: seq, slot, hp: 40, maxHp: 40 }),
    intentInstanceId: `intent-${seq}`,
    ...extra,
  };
}

function ctx(extra: Partial<CanonicalRootActionContext> = {}): CanonicalRootActionContext {
  return {
    rootActionId: 'root-1',
    actionSurface: 'WEAPON',
    classification: 'NATIVE_DIRECT',
    procDepth: 0,
    lockedTargetIds: ['enemy-a'],
    nativeByTarget: [],
    committed: true,
    wakePowered: false,
    wakeValueAtCommit: 0,
    kills: 0,
    intentCountered: false,
    selectedAmmoType: null,
    ...extra,
  } as CanonicalRootActionContext;
}

// ---------------------------------------------------------------------------
// 22. Fate Out of Place — store on qualifying Displacement (once per lineage), no store from
// passenger movement or its own release bonus; release bonus once per enemy cycle, Unmoored.
// ---------------------------------------------------------------------------
{
  const cf = { ...createDefaultCounterfateState(), fateboundUnitId: 'enemy-a', fateboundInstanceId: 'intent-1' };
  const displacement = {
    triggerUnitId: 'enemy-a', passengerUnitId: null, bonus: false, fizzleReason: null,
    sourceDefinitionId: null, kind: 'NORMAL' as const, rootActionId: 'root-1', sourceEventId: 'evt-1',
  };
  const stored = applyFateOutOfPlaceStore(defaultS4(), cf, displacement as any, false);
  assert.equal(stored.stored, true, 'Fate Out of Place stores 8 Reversal on a qualifying trigger-owner Displacement');
  assert.equal(stored.cf.rawReversal, 8);

  // Once per lineage: replaying the same event id stores nothing further.
  const replay = applyFateOutOfPlaceStore(stored.cv, stored.cf, displacement as any, false);
  assert.equal(replay.stored, false, 'Fate Out of Place stores at most once per displacement lineage');

  // Passenger movement never qualifies — the Fatebound unit riding along as a swap passenger is
  // not the Displacement's trigger owner, so it is not treated as completing a Displacement.
  const passengerDisplacement = { ...displacement, triggerUnitId: 'enemy-a', passengerUnitId: 'enemy-b', sourceEventId: 'evt-2' };
  const passengerCf = { ...cf, fateboundUnitId: 'enemy-b' };
  const passengerResult = applyFateOutOfPlaceStore(defaultS4(), passengerCf, passengerDisplacement as any, false);
  assert.equal(passengerResult.stored, false, 'passenger movement never stores Fate Out of Place Reversal');

  // A Displacement whose provenance is Fate Out of Place's own release bonus cannot store the 8.
  const ownBonusDisplacement = { ...displacement, sourceDefinitionId: CONVERGENCE_IDS.FATE_OUT_OF_PLACE, sourceEventId: 'evt-3' };
  const ownBonusResult = applyFateOutOfPlaceStore(defaultS4(), cf, ownBonusDisplacement as any, false);
  assert.equal(ownBonusResult.stored, false, 'Fate Out of Place release-bonus Displacement cannot store its own Reversal (no self-funding)');

  // Release bonus: makes the surviving source Unmoored and grants one bonus Displacement, once per enemy cycle.
  const gm = createDefaultGravemarkState();
  const intents = [liveIntent('enemy-c', 'FL_0')];
  const release = { targetUnitId: 'enemy-c', packet: 5, interruptProgress: 0 } as any;
  const bonus = applyFateOutOfPlaceReleaseBonus({
    cv: defaultS4(), gm, intents, release, rootActionId: 'r1', sourceEventId: 'fop-release', procDepth: 0, collisionCourseOwned: false, depth: 1,
  });
  assert.equal(bonus.cv.fateOutOfPlaceReleaseBonusUsedThisEnemyCycle, true, 'the release-bonus guard is consumed');
  assert.ok(bonus.displacement, 'a legal surviving release source receives a bonus Displacement');
  assert.equal(bonus.displacement!.bonus, true, 'the release bonus bypasses the normal cap regardless of Polarity');
  assert.ok(bonus.gm.unmooredExpiryByUnitId['enemy-c'] > 0, 'the source is made Unmoored');

  // A second release this same enemy cycle grants nothing further.
  const secondBonus = applyFateOutOfPlaceReleaseBonus({
    cv: bonus.cv, gm: bonus.gm, intents: bonus.intents, release, rootActionId: 'r2', sourceEventId: 'fop-release-2', procDepth: 0, collisionCourseOwned: false, depth: 1,
  });
  assert.equal(secondBonus.displacement, null, 'the release bonus is granted at most once per enemy cycle');

  // A source killed by release cannot move — the guard still consumes.
  const deadSourceIntents = [liveIntent('enemy-d', 'FL_1', { alive: false, hp: 0 })];
  const deadRelease = { targetUnitId: 'enemy-d', packet: 5, interruptProgress: 0 } as any;
  const deadOutcome = applyFateOutOfPlaceReleaseBonus({
    cv: defaultS4(), gm: createDefaultGravemarkState(), intents: deadSourceIntents, release: deadRelease,
    rootActionId: 'r3', sourceEventId: 'fop-release-dead', procDepth: 0, collisionCourseOwned: false, depth: 1,
  });
  assert.equal(deadOutcome.displacement, null, 'a source killed by release resolution cannot move');
  assert.equal(deadOutcome.cv.fateOutOfPlaceReleaseBonusUsedThisEnemyCycle, true, 'the guard is still consumed once even when movement fizzles');
}

// ---------------------------------------------------------------------------
// 23. Turning Rite — first trigger-owner Displacement per player turn advances one Beat without
// a Finale; deferred when the same root also completes a Finale; Finale close grants a bonus
// Displacement to the legal locked primary.
// ---------------------------------------------------------------------------
{
  const rc = createDefaultRitualCadenceState();
  const displacement = {
    triggerUnitId: 'enemy-a', passengerUnitId: null, bonus: false, fizzleReason: null,
    sourceDefinitionId: null, kind: 'NORMAL' as const, rootActionId: 'root-1', sourceEventId: 'evt-1',
  };
  const advanced = applyTurningRiteAdvance(defaultS4(), rc, displacement as any, false);
  assert.equal(advanced.cv.turningRiteAdvanceUsedThisPlayerTurn, true, 'the once-per-player-turn advance guard is consumed');
  assert.equal(rc.measure, 'EMPTY');
  assert.equal(advanced.rc.measure, 'BEAT_I', 'the first trigger-owner Displacement advances one Beat without a Finale');
  assert.equal(advanced.rc.previousSurface, null, 'Turning Rite ignores surface matching and does not replace previousSurface');

  // A second Displacement this player turn does not advance again.
  const second = applyTurningRiteAdvance(advanced.cv, advanced.rc, { ...displacement, sourceEventId: 'evt-2' } as any, false);
  assert.deepEqual(second.rc, advanced.rc, 'only the first trigger-owner Displacement per player turn advances a Beat');

  // Passenger movement never advances.
  const passengerAdvance = applyTurningRiteAdvance(
    defaultS4(), rc,
    { ...displacement, triggerUnitId: 'enemy-b', passengerUnitId: 'enemy-b', sourceEventId: 'evt-3' } as any,
    false,
  );
  assert.equal(passengerAdvance.cv.turningRiteAdvanceUsedThisPlayerTurn, false, 'passenger movement never advances the Beat or consumes the guard');

  // When the same root also completes a Finale, the Beat defers to begin the next Measure.
  const deferred = applyTurningRiteAdvance(defaultS4(), rc, displacement as any, true);
  assert.equal(deferred.cv.turningRiteDeferredBeat, true, 'a Finale-completing root defers the Turning Rite Beat');
  assert.deepEqual(deferred.rc, rc, 'the deferred Beat does not apply immediately');
  const resolved = applyTurningRiteDeferredBeat(deferred.cv, deferred.rc);
  assert.equal(resolved.cv.turningRiteDeferredBeat, false, 'the deferred Beat is cleared once applied');

  // Finale close grants a bonus Displacement to the legal locked primary.
  const gm = createDefaultGravemarkState();
  const intents = [liveIntent('enemy-a', 'FL_0')];
  const finaleBonus = applyTurningRiteFinaleBonus({
    cv: defaultS4(), gm, intents, ctx: ctx({ lockedTargetIds: ['enemy-a'] }), collisionCourseOwned: false, depth: 1,
  });
  assert.ok(finaleBonus.displacement, 'Finale close grants the legal locked primary one bonus Displacement');
  assert.equal(finaleBonus.displacement!.bonus, true);
  // The same root cannot grant this bonus twice.
  const secondFinaleBonus = applyTurningRiteFinaleBonus({
    cv: finaleBonus.cv, gm: finaleBonus.gm, intents: finaleBonus.intents, ctx: ctx({ lockedTargetIds: ['enemy-a'] }), collisionCourseOwned: false, depth: 1,
  });
  assert.equal(secondFinaleBonus.displacement, null, 'the Finale bonus applies at most once per Finale root');
}

// ---------------------------------------------------------------------------
// 24. Parallax Echo — first ordinary Core Trace hostile-resolved payload against a Polarized
// enemy grants a bonus Displacement to the resolved target; first completed Displacement arms a
// non-stacking +50% charge for the next ordinary Core Trace mint; a Displacement created by
// Parallax Echo cannot arm its own second clause.
// ---------------------------------------------------------------------------
{
  const gm = { ...createDefaultGravemarkState(), polarityByUnitId: { 'enemy-a': 'ARMAMENT' as const } };
  const intents = [liveIntent('enemy-a', 'FL_0')];
  const movement = applyParallaxEchoTraceMovement({
    cv: defaultS4(), gm, intents, resolvedTargets: [{ targetId: 'enemy-a', amount: 10 }],
    rootActionId: 'root-1', sourceEventId: 'pe-1', procDepth: 0, collisionCourseOwned: false, depth: 1,
  });
  assert.ok(movement.displacement, 'the first Trace hostile payload against a Polarized target grants a bonus Displacement');
  assert.equal(movement.cv.parallaxEchoMovementUsedThisPlayerTurn, true);
  // A second qualifying Trace this player turn grants nothing further.
  const secondMovement = applyParallaxEchoTraceMovement({
    cv: movement.cv, gm: movement.gm, intents: movement.intents, resolvedTargets: [{ targetId: 'enemy-a', amount: 10 }],
    rootActionId: 'root-2', sourceEventId: 'pe-2', procDepth: 0, collisionCourseOwned: false, depth: 1,
  });
  assert.equal(secondMovement.displacement, null, 'Parallax Echo movement is granted at most once per player turn');

  // Second clause: first completed Displacement arms a single, non-stacking +50% charge.
  const displacement = {
    triggerUnitId: 'enemy-a', passengerUnitId: null, bonus: false, fizzleReason: null,
    sourceDefinitionId: null, kind: 'NORMAL' as const, rootActionId: 'root-1', sourceEventId: 'evt-1',
  };
  const armed = armParallaxEchoFromDisplacement(defaultS4(), displacement as any);
  assert.equal(armed.parallaxEchoArmed, true);
  const consumed = consumeParallaxEchoArm(armed);
  assert.equal(consumed.multiplier, 1.5, 'the armed charge applies a +50% multiplier at Trace mint');
  const afterConsume = consumeParallaxEchoArm(consumed.cv);
  assert.equal(afterConsume.multiplier, 1, 'the charge does not persist after being consumed once');

  // A second Displacement this player turn cannot arm a second charge (arm guard already used).
  const secondArm = armParallaxEchoFromDisplacement(armed, { ...displacement, sourceEventId: 'evt-2' } as any);
  assert.equal(secondArm.parallaxEchoArmed, armed.parallaxEchoArmed, 'the arm charge never stacks — at most one stored charge');

  // A Displacement created by Parallax Echo itself cannot arm its own second clause.
  const ownDisplacement = { ...displacement, sourceDefinitionId: CONVERGENCE_IDS.PARALLAX_ECHO, sourceEventId: 'evt-own' };
  const ownArm = armParallaxEchoFromDisplacement(defaultS4(), ownDisplacement as any);
  assert.equal(ownArm.parallaxEchoArmed, false, 'a Parallax Echo bonus Displacement cannot arm its own Trace-empowerment charge');
}

// ---------------------------------------------------------------------------
// 26. Tethered Orbit — canonical formation Polarizes both endpoints without moving them;
// Displacing one endpoint makes its partner Unmoored and arms it for a later native root
// (never the displacing root itself); Self-Link produces one endpoint/arm only.
// ---------------------------------------------------------------------------
{
  const gm0 = createDefaultGravemarkState();
  const polarized = applyTetheredOrbitFormationPolarity(gm0, { rootActionId: 'form-1' }, 'enemy-a', 'enemy-b', false, 'ARMAMENT');
  assert.equal(polarized.polarityByUnitId['enemy-a'], 'ARMAMENT');
  assert.equal(polarized.polarityByUnitId['enemy-b'], 'ARMAMENT');
  assert.equal(polarized.displacementCountByUnitId['enemy-a'] ?? 0, 0, 'Polarity application alone never causes a Displacement or consumes the cap');

  // Self-Link: only one endpoint is Polarized, never a duplicate second application.
  const selfLinked = applyTetheredOrbitFormationPolarity(gm0, { rootActionId: 'form-2' }, 'enemy-c', 'enemy-c', true, 'DISCIPLINE');
  assert.equal(selfLinked.polarityByUnitId['enemy-c'], 'DISCIPLINE');

  const displacement = {
    triggerUnitId: 'enemy-a', passengerUnitId: null, bonus: false, fizzleReason: null,
    sourceDefinitionId: null, kind: 'NORMAL' as const, rootActionId: 'root-1', sourceEventId: 'evt-1',
  };
  const armed = armTetheredOrbitPartnerOnDisplacement(defaultS4(), gm0, displacement as any, 'enemy-b');
  assert.equal(armed.cv.tetheredOrbitArmedPartnerId, 'enemy-b');
  assert.equal(armed.cv.tetheredOrbitArmedAfterRootId, 'root-1');
  assert.ok(armed.gm.unmooredExpiryByUnitId['enemy-b'] > 0, 'the partner becomes Unmoored without moving');
  assert.equal(armed.gm.displacementCountByUnitId['enemy-b'] ?? 0, 0, 'the partner does not consume its own Displacement cap');

  // The displacing root itself cannot consume the arm it just created.
  const sameRootCtx = ctx({ rootActionId: 'root-1', nativeByTarget: [{ targetId: 'enemy-b', nativeDirectDamage: 10 } as any] });
  const intents = [liveIntent('enemy-b', 'FL_0')];
  const sameRootBonus = applyTetheredOrbitArmedBonus({ cv: armed.cv, gm: armed.gm, intents, ctx: sameRootCtx, collisionCourseOwned: false, depth: 1 });
  assert.equal(sameRootBonus.displacement, null, 'the arming root cannot consume its own arm');

  // A LATER native root that deals direct damage to the armed partner grants it a bonus Displacement.
  const laterRootCtx = ctx({ rootActionId: 'root-2', nativeByTarget: [{ targetId: 'enemy-b', nativeDirectDamage: 10 } as any] });
  const laterBonus = applyTetheredOrbitArmedBonus({ cv: armed.cv, gm: armed.gm, intents, ctx: laterRootCtx, collisionCourseOwned: false, depth: 1 });
  assert.ok(laterBonus.displacement, 'a later native-direct root grants the armed partner a bonus Displacement');
  assert.equal(laterBonus.cv.tetheredOrbitArmedPartnerId, null, 'the arm is cleared after use');

  // Clearing an invalid arm.
  const clearedArm = clearTetheredOrbitArmIfInvalid(armed.cv, []);
  assert.equal(clearedArm.tetheredOrbitArmedPartnerId, null, 'an arm on a no-longer-legal partner is cleared');
}

// ---------------------------------------------------------------------------
// 30. Prismatic Rite — Finale generates 6 Shards; positive Edge consumption queues one
// additional no-Finale Beat clamped at Beat II; Cathedral Break defers the Beat until its
// ultimate root finishes.
// ---------------------------------------------------------------------------
{
  const ss = createDefaultShardskinState();
  const finaleShards = applyPrismaticRiteFinaleShards(defaultS4(), ss, 1, 'root-1');
  assert.ok(finaleShards.generated > 0, 'completing a Finale generates Shards subject to the normal cap');
  const repeatFinale = applyPrismaticRiteFinaleShards(finaleShards.cv, finaleShards.ss, 1, 'root-1');
  assert.equal(repeatFinale.generated, 0, 'the same Finale root cannot regenerate Prismatic Rite Shards');

  const rc = createDefaultRitualCadenceState();
  const armed = armPrismaticRiteDeferredBeat(defaultS4());
  assert.equal(armed.prismaticRiteDeferredBeat, true);
  const resolved = applyPrismaticRiteDeferredBeat(armed, rc);
  assert.equal(resolved.rc.measure, 'BEAT_I', 'the queued Beat advances the Measure without a Finale');
  assert.equal(resolved.cv.prismaticRiteDeferredBeat, false, 'the deferred Beat guard is cleared once applied');
}

// ---------------------------------------------------------------------------
// 31. Phantom Facet — first ordinary Core Trace each player turn generates
// min(6, floor(power*0.25)) Shards (guard consumed even at zero net gain); Edge consumption
// arms +50% for the next ordinary Core Trace mint this player turn.
// ---------------------------------------------------------------------------
{
  const ss = createDefaultShardskinState();
  const gen = applyPhantomFacetGeneration(defaultS4(), ss, 1, 40);
  assert.equal(gen.generated, Math.min(6, Math.floor(40 * 0.25)), 'Phantom Facet generation uses floor(power*0.25) capped at 6');
  const secondGen = applyPhantomFacetGeneration(gen.cv, gen.ss, 1, 40);
  assert.equal(secondGen.generated, 0, 'the once-per-player-turn guard is consumed even when a second Trace resolves');

  const armed = armPhantomFacetFromEdgeHelper();
  assert.equal(armed.phantomFacetArmed, true);
  const consumed = consumePhantomFacetArm(armed);
  assert.equal(consumed.multiplier, 1.5);
  const afterConsume = consumePhantomFacetArm(consumed.cv);
  assert.equal(afterConsume.multiplier, 1, 'the Phantom Facet Trace-empowerment charge does not persist after use');
}
function armPhantomFacetFromEdgeHelper(): Sector4ConvergenceRuntimeState {
  return { ...defaultS4(), phantomFacetArmed: true, phantomFacetArmedRootId: 'root-1' };
}

// ---------------------------------------------------------------------------
// 32. Stillglass — native Stillness gain generates 5 Shards; first Shard-absorption each enemy
// cycle arms one pending Fleeting for the next player-turn start (not from the Fleeting gain
// itself); multiple absorbed hits do not arm multiple charges.
// ---------------------------------------------------------------------------
{
  const ss = createDefaultShardskinState();
  const gen = applyStillglassNativeStillnessShards(ss, 1);
  assert.ok(gen.generated > 0, 'native Stillness gain generates Stillglass Shards');

  const armed = armStillglassPendingFleeting(defaultS4());
  assert.equal(armed.stillglassAbsorptionArmedThisEnemyCycle, true);
  assert.equal(armed.stillglassPendingFleeting, true);
  // A second absorbed hit this enemy cycle does not arm a second charge.
  const secondArm = armStillglassPendingFleeting(armed);
  assert.deepEqual(secondArm, armed, 'only the first absorption each enemy cycle arms the pending Fleeting');
  const consumed = consumeStillglassPendingFleeting(armed);
  assert.equal(consumed.shouldCreate, true);
  assert.equal(consumed.cv.stillglassPendingFleeting, false, 'the pending Fleeting flag is cleared once consumed at turn start');
}

// ---------------------------------------------------------------------------
// 33. Crystal Ligature — canonical Woundlink formation generates 4 Shards once per player turn;
// mirror is 50% of actual Edge damage dealt, Self-Link routes through the existing 40%
// translation once (never doubled).
// ---------------------------------------------------------------------------
{
  const ss = createDefaultShardskinState();
  const gen = applyCrystalLigatureFormationShards(defaultS4(), ss, 1);
  assert.ok(gen.generated > 0, 'canonical Woundlink formation generates Crystal Ligature Shards');
  const second = applyCrystalLigatureFormationShards(gen.cv, gen.ss, 1);
  assert.equal(second.generated, 0, 'Crystal Ligature formation Shards are granted at most once per player turn');

  assert.equal(crystalLigatureMirrorAmount(20, false), 10, 'the mirror is 50% of the actual Edge damage dealt');
  assert.equal(crystalLigatureMirrorAmount(20, true), 4, 'Self-Link routes the mirror through the existing 40% translation exactly once (10 * 0.4)');
  assert.equal(crystalLigatureMirrorAmount(0, false), 0);
}

// ---------------------------------------------------------------------------
// 34. Faultglass — first Rupture each player turn generates 6 Shards; positive Edge consumption
// applies 2 Fault to the locked primary and 1 to every other distinct native-hit enemy, from the
// frozen native target map, once per target/root.
// ---------------------------------------------------------------------------
{
  const fl = createDefaultFaultlineState();
  const intents = [liveIntent('enemy-a', 'FL_0'), liveIntent('enemy-b', 'FL_1')];
  const edgeCtx = ctx({
    rootActionId: 'edge-root',
    nativeByTarget: [
      { targetId: 'enemy-a', nativeDirectDamage: 10 } as any,
      { targetId: 'enemy-b', nativeDirectDamage: 5 } as any,
    ],
  });
  const applied = applyFaultglassEdgeFault(fl, intents, edgeCtx, 'enemy-a', 1);
  assert.equal(applied.additions.length, 2, 'Fault is applied to the locked primary and every other distinct native-hit target');
  const primaryFault = applied.additions.find((row) => row.targetId === 'enemy-a');
  const otherFault = applied.additions.find((row) => row.targetId === 'enemy-b');
  assert.equal(primaryFault?.amountApplied, 2, 'the locked primary receives 2 Fault');
  assert.equal(otherFault?.amountApplied, 1, 'every other distinct native-hit enemy receives 1 Fault');

  const ss = createDefaultShardskinState();
  const ruptureShards = applyFaultglassRuptureShards(defaultS4(), ss, 1);
  assert.ok(ruptureShards.generated > 0, 'the first Rupture each player turn generates Faultglass Shards');
  const secondRupture = applyFaultglassRuptureShards(ruptureShards.cv, ruptureShards.ss, 1);
  assert.equal(secondRupture.generated, 0, 'Faultglass Rupture Shards are granted at most once per player turn');
}

// ---------------------------------------------------------------------------
// 35. Soulglass — first Wake-powered committed root each player turn generates
// min(8, floor(wake*0.5)) Shards; positive Edge consumption while Wake is active requests 50%
// Residual Wake through the shared max/non-additive carry API.
// ---------------------------------------------------------------------------
{
  const ss = createDefaultShardskinState();
  const gen = applySoulglassGeneration(defaultS4(), ss, 1, 20);
  assert.equal(gen.generated, Math.min(8, Math.floor(20 * 0.5)), 'Soulglass generation uses floor(wake*0.5) capped at 8');
  const second = applySoulglassGeneration(gen.cv, gen.ss, 1, 20);
  assert.equal(second.generated, 0, 'Soulglass generation is granted at most once per player turn');

  const sw = createDefaultSoulwakeState();
  const carry = applySoulglassResidualCarry(sw, 10);
  assert.equal(carry.accepted, true);
  assert.equal(carry.amount, 5, 'Soulglass Residual carry requests 50% of the Wake-at-commit snapshot');
}

console.log('Stage E.3 — Sector 4 Convergence mechanic coverage passed');
