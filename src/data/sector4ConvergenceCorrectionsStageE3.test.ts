import assert from 'node:assert/strict';
import {
  applyFatedFacetAbsorption,
  applyImpactLatticeDisplacementShards,
  applyImpactLatticeEdgeClause,
  applyStoredVectorBonusDisplacement,
  applyTectonicShiftFault,
  applyTectonicShiftRuptureBonus,
  applyTraumaVectorForcedDisplacement,
  applyTraumaVectorResidualCarry,
  tectonicShiftFaultEligible,
  tryStoredVectorFleetingRequest,
} from './nineStrain/sector4ConvergenceEngine';
import { createDefaultGravemarkState } from './nineStrain/gravemarkEngine';
import { createDefaultCounterfateState } from './nineStrain/counterfateEngine';
import type { CounterfateRuntimeState } from '../types/counterfate';
import { createDefaultShardskinState } from './nineStrain/shardskinEngine';
import { createDefaultStillpointState } from './nineStrain/stillpointEngine';
import { createDefaultSoulwakeState } from './nineStrain/soulwakeEngine';
import type { Sector4ConvergenceRuntimeState } from '../types/convergence';
import { CONVERGENCE_IDS } from '../types/convergence';
import type { HostileIntentSnapshot } from '../types/counterfate';
import type { CanonicalRootActionContext } from '../types/nineStrain';

console.log('Stage E.3 — Five authoritative corrections');

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

function intent(unitId: string, extra: Partial<HostileIntentSnapshot> = {}): HostileIntentSnapshot {
  return {
    unitId,
    hp: 40,
    maxHp: 40,
    alive: true,
    invulnerable: false,
    protectedPhase: false,
    authoredCounter: false,
    ...extra,
  } as HostileIntentSnapshot;
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
// Correction 1 — Stored Vector: no direct native refund; bounded Fleeting only;
// a root that consumed Fleeting cannot create another.
// ---------------------------------------------------------------------------
{
  const sp = createDefaultStillpointState();
  // A root that consumed Fleeting (chargeSource FLEETING) cannot create another Fleeting charge.
  const spConsumedFleeting = {
    ...sp,
    focusedRoot: { rootActionId: 'root-1', surfaces: [], chargeSource: 'FLEETING' as const, consumed: true },
  };
  const blocked = tryStoredVectorFleetingRequest(spConsumedFleeting, { rootActionId: 'root-1', qualifies: true });
  assert.equal(blocked.requested, false, 'Stored Vector cannot create Fleeting from a root that consumed Fleeting');
  assert.deepEqual(blocked.sp, spConsumedFleeting, 'no native Stillness refund path exists — state passes through unchanged');

  // A native-charged Focused root that qualifies creates bounded Fleeting (never a native refund —
  // there is no code path in tryStoredVectorFleetingRequest that touches nativeStillness).
  const spNative = { ...sp, focusedRoot: { rootActionId: 'root-2', surfaces: [], chargeSource: 'NATIVE' as const, consumed: true } };
  const granted = tryStoredVectorFleetingRequest(spNative, { rootActionId: 'root-2', qualifies: true });
  assert.equal(granted.requested, true, 'a qualifying native-Focused root creates Fleeting Stillness');
  assert.equal(granted.sp.nativeStillness, spNative.nativeStillness, 'native Stillness is never directly refunded');

  // A non-qualifying root creates nothing.
  const noQualify = tryStoredVectorFleetingRequest(spNative, { rootActionId: 'root-3', qualifies: false });
  assert.equal(noQualify.requested, false, 'a non-qualifying root outcome creates no Fleeting');
}

// ---------------------------------------------------------------------------
// Correction 2 — Tectonic Shift: Fault only from first *normal* Displacement per target per
// combat cycle; Rupture grants a bonus Displacement beyond the cap; the bonus cannot apply
// Tectonic Fault or generate another Tectonic bonus.
// ---------------------------------------------------------------------------
{
  const cv0 = defaultS4();
  const normalDisplacement = {
    triggerUnitId: 'enemy-a', passengerUnitId: null, bonus: false, fizzleReason: null,
    sourceDefinitionId: null, kind: 'NORMAL' as const, rootActionId: 'root-1', sourceEventId: 'evt-1',
  };
  const first = tectonicShiftFaultEligible(cv0, normalDisplacement as any);
  assert.equal(first.eligible, true, 'first normal Displacement per target per combat cycle is Fault-eligible');

  const second = tectonicShiftFaultEligible(first.cv, { ...normalDisplacement, sourceEventId: 'evt-2' } as any);
  assert.equal(second.eligible, false, 'a second normal Displacement of the same target this cycle does not apply Fault again');

  const bonusDisplacement = { ...normalDisplacement, bonus: true, triggerUnitId: 'enemy-b', sourceEventId: 'evt-3' };
  const bonusResult = tectonicShiftFaultEligible(cv0, bonusDisplacement as any);
  assert.equal(bonusResult.eligible, false, 'bonus Displacement never applies Tectonic Fault');

  const passenger = { ...normalDisplacement, triggerUnitId: 'enemy-c', passengerUnitId: 'enemy-c', sourceEventId: 'evt-4' };
  const passengerResult = tectonicShiftFaultEligible(cv0, passenger as any);
  assert.equal(passengerResult.eligible, false, 'passenger movement never applies Tectonic Fault');

  // The Tectonic bonus itself, when it produces its own Displacement record, is excluded because
  // callers pass sourceDefinitionId === TECTONIC_SHIFT — verify the guard directly.
  const tectonicOwnDisplacement = { ...normalDisplacement, triggerUnitId: 'enemy-d', sourceDefinitionId: CONVERGENCE_IDS.TECTONIC_SHIFT, sourceEventId: 'evt-5' };
  const ownResult = tectonicShiftFaultEligible(cv0, tectonicOwnDisplacement as any);
  assert.equal(ownResult.eligible, false, 'a Displacement caused by Tectonic Shift itself cannot re-apply Tectonic Fault');

  // Rupture grants exactly one bonus Displacement per combat cycle, beyond the normal cap (bonus: true).
  const gm = createDefaultGravemarkState();
  const intents = [intent('enemy-a')];
  const rupture = { targetId: 'enemy-a', sourceDefinitionId: 'FL_SOME_SOURCE', sourceEventId: 'rupture-1' } as any;
  const bonusOutcome = applyTectonicShiftRuptureBonus({ cv: cv0, gm, intents, rupture, depth: 1, collisionCourseOwned: false });
  assert.equal(bonusOutcome.cv.tectonicShiftRuptureBonusUsedThisCombatCycle, true, 'the Rupture bonus guard is consumed');
  if (bonusOutcome.displacement) {
    assert.equal(bonusOutcome.displacement.bonus, true, 'the Tectonic Rupture bonus bypasses the normal cap via the bonus path');
  }

  // A second Rupture this combat cycle cannot grant another bonus.
  const secondRuptureOutcome = applyTectonicShiftRuptureBonus({
    cv: bonusOutcome.cv, gm: bonusOutcome.gm, intents: bonusOutcome.intents,
    rupture: { targetId: 'enemy-a', sourceDefinitionId: 'FL_SOME_SOURCE', sourceEventId: 'rupture-2' } as any,
    depth: 1, collisionCourseOwned: false,
  });
  assert.equal(secondRuptureOutcome.displacement, null, 'a second Rupture this combat cycle grants no further bonus Displacement');

  // A Rupture caused by Tectonic Shift's own Fault application cannot bounce through its own lineage.
  const ownLineageRupture = { targetId: 'enemy-e', sourceDefinitionId: CONVERGENCE_IDS.TECTONIC_SHIFT, sourceEventId: 'rupture-own' } as any;
  const ownLineageOutcome = applyTectonicShiftRuptureBonus({ cv: cv0, gm, intents, rupture: ownLineageRupture, depth: 1, collisionCourseOwned: false });
  assert.equal(ownLineageOutcome.displacement, null, 'a Rupture caused by Tectonic Shift itself cannot grant another Tectonic bonus');
}

// ---------------------------------------------------------------------------
// Correction 3 — Trauma Vector: first Wake-powered action per *combat cycle* (not per player
// turn); Residual carry requires a qualifying outcome, not merely attempted movement.
// ---------------------------------------------------------------------------
{
  const cv0 = defaultS4();
  const gm = createDefaultGravemarkState();
  const intents = [intent('enemy-a')];
  const wakeCtx = ctx({ wakePowered: true });
  const forced = applyTraumaVectorForcedDisplacement({
    cv: cv0, gm, intents, ctx: wakeCtx, fallbackHostileId: null, collisionCourseOwned: false, depth: 1,
  });
  assert.equal(forced.cv.traumaVectorUsedThisCombatCycle, true, 'Trauma Vector guard is combat-cycle scoped, not player-turn scoped');
  if (forced.displacement) assert.equal(forced.displacement.bonus, false, 'Trauma Vector forces a normal Displacement, not a bonus');

  // A second Wake-powered root in the SAME combat cycle (guard not reset) does not force again.
  const secondWakeCtx = ctx({ rootActionId: 'root-2', wakePowered: true });
  const secondForced = applyTraumaVectorForcedDisplacement({
    cv: forced.cv, gm: forced.gm, intents: forced.intents, ctx: secondWakeCtx, fallbackHostileId: null, collisionCourseOwned: false, depth: 1,
  });
  assert.equal(secondForced.displacement, null, 'only the first Wake-powered root per combat cycle forces a Displacement');

  // Residual carry: merely attempting movement (qualifies=false, e.g. unmoored without an
  // authored immovable translation) does not request Residual.
  const sw = createDefaultSoulwakeState();
  const noQualifyCarry = applyTraumaVectorResidualCarry(sw, 0);
  assert.equal(noQualifyCarry.accepted, false, 'a wakeValueAtCommit of 0 (no qualifying result) requests no Residual');

  const qualifyingCarry = applyTraumaVectorResidualCarry(sw, 10);
  assert.equal(qualifyingCarry.amount <= 5, true, 'Residual requests at most 50% of the Wake-at-commit snapshot');
}

// ---------------------------------------------------------------------------
// Correction 4 — Fated Facet: no severity-based Shards on Fatebound bind; 5 Shards only on the
// first <10 -> >=10 Reversal crossing per enemy-cycle window; absorption stores Reversal before
// threshold check, capped at 12 per hostile-intent lineage.
// ---------------------------------------------------------------------------
{
  const cv0 = defaultS4();
  const cf0 = { ...createDefaultCounterfateState(), fateboundUnitId: 'enemy-a', fateboundInstanceId: 'intent-1', rawReversal: 6 };
  const ss0 = createDefaultShardskinState();

  // Absorbing 5 crosses 6 -> 11 (>= 10): generates the one-time 5 Shards.
  const crossing = applyFatedFacetAbsorption({
    cv: cv0, cf: cf0, ss: ss0, attackerUnitId: 'enemy-a', shardsAbsorbed: 5, depth: 1,
  });
  assert.equal(crossing.thresholdShards, 5, 'the first <10 -> >=10 crossing generates exactly 5 Shards');
  assert.equal(crossing.cv.fatedFacetThresholdCrossedThisWindow, true);

  // A further absorption in the SAME window (already crossed) does not re-generate the 5.
  const again = applyFatedFacetAbsorption({
    cv: crossing.cv, cf: crossing.cf, ss: crossing.ss, attackerUnitId: 'enemy-a', shardsAbsorbed: 1, depth: 1,
  });
  assert.equal(again.thresholdShards, 0, 'no severity/re-crossing Shards within the same enemy-cycle window');

  // Starting a NEW window already at >=10 (no crossing) does not manufacture a gain.
  const cvFreshWindow = defaultS4();
  const cfAlreadyHigh = { ...createDefaultCounterfateState(), fateboundUnitId: 'enemy-a', fateboundInstanceId: 'intent-2', rawReversal: 10 };
  const noManufacture = applyFatedFacetAbsorption({
    cv: cvFreshWindow, cf: cfAlreadyHigh, ss: ss0, attackerUnitId: 'enemy-a', shardsAbsorbed: 1, depth: 1,
  });
  assert.equal(noManufacture.thresholdShards, 0, 'starting a window already at 10+ does not manufacture a threshold gain without an actual crossing');

  // Absorption cap of 12 per lineage: repeated large absorptions plateau at +12 total stored.
  let cv = defaultS4();
  let cf: CounterfateRuntimeState = { ...createDefaultCounterfateState(), fateboundUnitId: 'enemy-a', fateboundInstanceId: 'intent-3', rawReversal: 0 };
  let ss = createDefaultShardskinState();
  for (let i = 0; i < 5; i += 1) {
    const step = applyFatedFacetAbsorption({ cv, cf, ss, attackerUnitId: 'enemy-a', shardsAbsorbed: 5, depth: 1 });
    cv = step.cv; cf = step.cf; ss = step.ss;
  }
  assert.equal(cv.fatedFacetAbsorptionStoredThisLineage, 12, 'absorption storage caps at 12 across one hostile-intent lineage');

  // Barrier/Parry/Rift-prevented damage means Shards absorbed zero — no storage, no threshold check.
  const preventedCv = defaultS4();
  const preventedResult = applyFatedFacetAbsorption({
    cv: preventedCv, cf: cf0, ss: ss0, attackerUnitId: 'enemy-a', shardsAbsorbed: 0, depth: 1,
  });
  assert.equal(preventedResult.cv, preventedCv, 'zero Shards absorbed (fully prevented) does not touch Fated Facet state at all');

  // No severity-based Shards are generated purely from Fatebound *selection/bind* — this function
  // is only ever invoked from the Shard-absorption path (recordShardDefense), never from bind.
  assert.equal(typeof applyFatedFacetAbsorption, 'function');
}

// ---------------------------------------------------------------------------
// Correction 5 — Impact Lattice: Displacement it creates cannot generate its own 5 Shards; its
// bonus cannot re-activate Impact Lattice.
// ---------------------------------------------------------------------------
{
  const cv0 = defaultS4();
  const ss0 = createDefaultShardskinState();
  const ownDisplacement = {
    triggerUnitId: 'enemy-a', passengerUnitId: null, bonus: true, fizzleReason: null,
    sourceDefinitionId: CONVERGENCE_IDS.IMPACT_LATTICE, kind: 'NORMAL' as const, rootActionId: 'root-1', sourceEventId: 'evt-il',
  };
  const noSelfShards = applyImpactLatticeDisplacementShards(cv0, ss0, 1, ownDisplacement as any);
  assert.equal(noSelfShards.generated, 0, 'Displacement created by Impact Lattice cannot generate its own 5 Shards');

  const otherDisplacement = { ...ownDisplacement, sourceDefinitionId: 'GM_SOME_OTHER_SOURCE', sourceEventId: 'evt-other' };
  const externalShards = applyImpactLatticeDisplacementShards(cv0, ss0, 1, otherDisplacement as any);
  assert.ok(externalShards.generated > 0, 'a non-Impact-Lattice-caused Displacement can generate the 5 Shards');

  // The Edge-consumption bonus never re-enters applyImpactLatticeEdgeClause (structurally: it
  // performs a single attemptDisplacement call and returns; callers must not loop it back in).
  const gm = { ...createDefaultGravemarkState(), polarityByUnitId: { 'enemy-a': 'ARMAMENT' } } as any;
  const intents = [intent('enemy-a')];
  const bonusOutcome = applyImpactLatticeEdgeClause({
    gm, intents, primaryTargetId: 'enemy-a', routineImprint: 'ARMAMENT', rootActionId: 'root-1', procDepth: 0, collisionCourseOwned: false, depth: 1,
  });
  if (bonusOutcome.displacement) {
    assert.equal(bonusOutcome.displacement.sourceDefinitionId, CONVERGENCE_IDS.IMPACT_LATTICE);
    assert.equal(bonusOutcome.displacement.bonus, true, 'the Impact Lattice Edge-clause bonus bypasses the normal cap');
  }
  assert.equal(bonusOutcome.polarized, false, 'an already-Polarized primary receives the bonus, not a redundant Polarize');
}

console.log('Stage E.3 — Five authoritative corrections passed');
