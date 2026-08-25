import { CONVERGENCE_IDS } from '../../types/convergence';
import type { Sector4ConvergenceRuntimeState } from '../../types/convergence';
import type {
  CombatDepthBand,
  CounterfateRuntimeState,
  HostileIntentSnapshot,
  ReversalReleaseResult,
} from '../../types/counterfate';
import type {
  GravemarkCollisionRecord,
  GravemarkDisplacementRecord,
  GravemarkPolarityId,
  GravemarkRuntimeState,
} from '../../types/gravemark';
import type { FaultAdditionRecord, FaultlineRuntimeState, RuptureResult } from '../../types/faultline';
import type { CanonicalRootActionContext } from '../../types/nineStrain';
import { addFault } from './faultlineEngine';
import type { RitualCadenceRuntimeState } from '../../types/ritualCadence';
import type { ShardskinRuntimeState } from '../../types/shardskin';
import type { SoulwakeRuntimeState } from '../../types/soulwake';
import type { StillpointRuntimeState } from '../../types/stillpoint';
import { attemptDisplacement, legalGravemarkHostile, mapGravemarkUnit, setGravemarkPolarity } from './gravemarkEngine';
import { storeReversal } from './counterfateEngine';
import { advanceMeasureWithoutFinale } from './ritualCadenceEngine';
import { shardskinDepthCap } from './shardskinEngine';
import { requestResidualCarry } from './soulwakeEngine';
import { grantFleetingStillness, stillnessProducerBlocked } from './stillpointEngine';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Mirrors gravemarkEngine's private collisionLegalForTarget — invulnerable/protected-phase gate. */
function collisionLegalForTarget(row: HostileIntentSnapshot): boolean {
  if (row.invulnerable) return false;
  if (row.protectedPhase) return row.authoredCounter === true;
  return true;
}

/** Applies GravemarkCollisionRecord[] (from attemptDisplacement's Collision Course path) to intents. */
export function applySector4Collisions(
  intents: readonly HostileIntentSnapshot[],
  collisions: readonly GravemarkCollisionRecord[],
): { intents: HostileIntentSnapshot[]; killedIds: string[] } {
  let next = intents.slice();
  const killedIds: string[] = [];
  for (const row of collisions) {
    const target = next.find((r) => r.unitId === row.targetId);
    if (!target || !collisionLegalForTarget(target)) continue;
    let killed = false;
    next = next.map((r) => {
      if (r.unitId !== row.targetId) return r;
      const hp = Math.max(0, r.hp - row.amount);
      killed = hp <= 0 && r.alive;
      return { ...r, hp, alive: hp > 0 && r.alive };
    });
    if (killed) killedIds.push(row.targetId);
  }
  return { intents: next, killedIds };
}

function grantShardsCapped(
  ss: ShardskinRuntimeState,
  depth: CombatDepthBand,
  amount: number,
  source: string,
): { state: ShardskinRuntimeState; generated: number } {
  if (amount <= 0) return { state: ss, generated: 0 };
  const cap = shardskinDepthCap(depth);
  const gained = Math.max(0, Math.min(amount, cap - ss.currentShards));
  if (gained <= 0) return { state: ss, generated: 0 };
  return {
    state: {
      ...ss,
      currentShards: ss.currentShards + gained,
      lastGeneration: { source, amount: gained },
      lastLog: `${source} // +${gained} SHARDS`,
    },
    generated: gained,
  };
}

// ---------------------------------------------------------------------------
// 22. Fate Out of Place (Counterfate x Gravemark)
// ---------------------------------------------------------------------------

/** Stores 8 Reversal once per displacement lineage when the Fatebound trigger owner completes a qualifying Displacement. */
export function applyFateOutOfPlaceStore(
  cv: Sector4ConvergenceRuntimeState,
  cf: CounterfateRuntimeState,
  displacement: GravemarkDisplacementRecord,
  translated: boolean,
): { cv: Sector4ConvergenceRuntimeState; cf: CounterfateRuntimeState; stored: boolean } {
  if (!cf.fateboundUnitId || displacement.triggerUnitId !== cf.fateboundUnitId) return { cv, cf, stored: false };
  if (displacement.fizzleReason != null) return { cv, cf, stored: false };
  if (displacement.kind === 'IMMOVABLE' && !translated) return { cv, cf, stored: false };
  if (displacement.sourceDefinitionId === CONVERGENCE_IDS.FATE_OUT_OF_PLACE) return { cv, cf, stored: false };
  const lineageId = displacement.sourceEventId;
  if (cv.fateOutOfPlaceStoreEventId === lineageId) return { cv, cf, stored: false };
  const stored = storeReversal(cf, 8);
  return {
    cv: { ...cv, fateOutOfPlaceStoreEventId: lineageId },
    cf: stored.cf,
    stored: stored.result.accepted > 0,
  };
}

/**
 * After a completed Reversal release, makes the surviving source Unmoored and grants one bonus
 * Displacement (once per enemy cycle) via attemptDisplacement's bonus path, which itself already
 * marks Unmoored as part of consuming the target's cap-bypassing movement.
 */
export function applyFateOutOfPlaceReleaseBonus(args: {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  release: ReversalReleaseResult;
  rootActionId: string | null;
  sourceEventId: string;
  procDepth: number;
  collisionCourseOwned: boolean;
  depth: CombatDepthBand;
}): {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  displacement: GravemarkDisplacementRecord | null;
  collisions: readonly GravemarkCollisionRecord[];
} {
  const noop = { cv: args.cv, gm: args.gm, intents: args.intents.slice(), displacement: null, collisions: [] };
  if (args.cv.fateOutOfPlaceReleaseBonusUsedThisEnemyCycle) return noop;
  if (args.release.packet <= 0 && args.release.interruptProgress <= 0) return noop;
  const targetId = args.release.targetUnitId;
  const target = targetId ? legalGravemarkHostile(args.intents, mapGravemarkUnit(args.gm, targetId)) : null;
  const usedCv = { ...args.cv, fateOutOfPlaceReleaseBonusUsedThisEnemyCycle: true };
  // A source killed by release cannot move — the guard is still consumed once per enemy cycle.
  if (!target) return { ...noop, cv: usedCv };
  const outcome = attemptDisplacement({
    state: args.gm,
    intents: args.intents,
    triggerUnitId: target.unitId,
    bonus: true,
    rootActionId: args.rootActionId,
    sourceEventId: args.sourceEventId,
    sourceDefinitionId: CONVERGENCE_IDS.FATE_OUT_OF_PLACE,
    procDepth: args.procDepth,
    collisionCourseOwned: args.collisionCourseOwned,
    combatDepth: args.depth,
  });
  return {
    cv: usedCv,
    gm: outcome.state,
    intents: outcome.intents,
    displacement: outcome.attempted ? outcome.record : null,
    collisions: outcome.collisions,
  };
}

// ---------------------------------------------------------------------------
// 23. Turning Rite (Ritual Cadence x Gravemark)
// ---------------------------------------------------------------------------

/**
 * First completed trigger-owner Displacement each player turn advances Measure without a
 * Finale — unless this same root is also completing a Finale, in which case the Beat is
 * deferred to begin the next Measure once the Finale closes.
 */
export function applyTurningRiteAdvance(
  cv: Sector4ConvergenceRuntimeState,
  rc: RitualCadenceRuntimeState,
  displacement: GravemarkDisplacementRecord,
  rootIsFinale: boolean,
): { cv: Sector4ConvergenceRuntimeState; rc: RitualCadenceRuntimeState } {
  if (cv.turningRiteAdvanceUsedThisPlayerTurn) return { cv, rc };
  if (displacement.fizzleReason != null) return { cv, rc };
  if (displacement.passengerUnitId === displacement.triggerUnitId) return { cv, rc };
  if (rootIsFinale) {
    return { rc, cv: { ...cv, turningRiteAdvanceUsedThisPlayerTurn: true, turningRiteDeferredBeat: true } };
  }
  return { rc: advanceMeasureWithoutFinale(rc), cv: { ...cv, turningRiteAdvanceUsedThisPlayerTurn: true } };
}

export function applyTurningRiteDeferredBeat(
  cv: Sector4ConvergenceRuntimeState,
  rc: RitualCadenceRuntimeState,
): { cv: Sector4ConvergenceRuntimeState; rc: RitualCadenceRuntimeState } {
  if (!cv.turningRiteDeferredBeat) return { cv, rc };
  return { rc: advanceMeasureWithoutFinale(rc), cv: { ...cv, turningRiteDeferredBeat: false } };
}

/** Grants the Finale's legal locked primary one bonus Displacement regardless of Polarity. */
export function applyTurningRiteFinaleBonus(args: {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  ctx: CanonicalRootActionContext;
  collisionCourseOwned: boolean;
  depth: CombatDepthBand;
}): {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  displacement: GravemarkDisplacementRecord | null;
  collisions: readonly GravemarkCollisionRecord[];
} {
  const noop = { cv: args.cv, gm: args.gm, intents: args.intents.slice(), displacement: null, collisions: [] };
  if (args.cv.turningRiteFinaleBonusAppliedRootId === args.ctx.rootActionId) return noop;
  const primaryId = args.ctx.lockedTargetIds[0] ?? null;
  const target = primaryId ? legalGravemarkHostile(args.intents, mapGravemarkUnit(args.gm, primaryId)) : null;
  const usedCv = { ...args.cv, turningRiteFinaleBonusAppliedRootId: args.ctx.rootActionId };
  if (!target) return { ...noop, cv: usedCv };
  const outcome = attemptDisplacement({
    state: args.gm,
    intents: args.intents,
    triggerUnitId: target.unitId,
    bonus: true,
    rootActionId: args.ctx.rootActionId,
    sourceEventId: `${args.ctx.rootActionId}:${CONVERGENCE_IDS.TURNING_RITE}`,
    sourceDefinitionId: CONVERGENCE_IDS.TURNING_RITE,
    procDepth: args.ctx.procDepth,
    collisionCourseOwned: args.collisionCourseOwned,
    combatDepth: args.depth,
  });
  return {
    cv: usedCv,
    gm: outcome.state,
    intents: outcome.intents,
    displacement: outcome.attempted ? outcome.record : null,
    collisions: outcome.collisions,
  };
}

// ---------------------------------------------------------------------------
// 24. Parallax Echo (Afterimage x Gravemark)
// ---------------------------------------------------------------------------

/**
 * First ordinary Core Trace each player turn resolving hostile payload against a Polarized
 * enemy grants that (already-resolved) target one bonus Displacement. Resolve the payload
 * first — callers pass already-resolved {targetId, amount} pairs in resolution order.
 */
export function applyParallaxEchoTraceMovement(args: {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  resolvedTargets: readonly { targetId: string; amount: number }[];
  rootActionId: string | null;
  sourceEventId: string;
  procDepth: number;
  collisionCourseOwned: boolean;
  depth: CombatDepthBand;
}): {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  displacement: GravemarkDisplacementRecord | null;
  collisions: readonly GravemarkCollisionRecord[];
} {
  const noop = { cv: args.cv, gm: args.gm, intents: args.intents.slice(), displacement: null, collisions: [] };
  if (args.cv.parallaxEchoMovementUsedThisPlayerTurn) return noop;
  const polarized = args.resolvedTargets.find((row) => (
    row.amount > 0 && args.gm.polarityByUnitId[mapGravemarkUnit(args.gm, row.targetId)] !== undefined
  ));
  if (!polarized) return noop;
  const target = legalGravemarkHostile(args.intents, mapGravemarkUnit(args.gm, polarized.targetId));
  const usedCv = { ...args.cv, parallaxEchoMovementUsedThisPlayerTurn: true };
  if (!target) return { ...noop, cv: usedCv };
  const outcome = attemptDisplacement({
    state: args.gm,
    intents: args.intents,
    triggerUnitId: target.unitId,
    bonus: true,
    rootActionId: args.rootActionId,
    sourceEventId: args.sourceEventId,
    sourceDefinitionId: CONVERGENCE_IDS.PARALLAX_ECHO,
    procDepth: args.procDepth,
    collisionCourseOwned: args.collisionCourseOwned,
    combatDepth: args.depth,
  });
  return {
    cv: usedCv,
    gm: outcome.state,
    intents: outcome.intents,
    displacement: outcome.attempted ? outcome.record : null,
    collisions: outcome.collisions,
  };
}

/** The first completed Displacement each player turn (not caused by Parallax Echo itself) arms +50% for the next ordinary Core Trace mint. */
export function armParallaxEchoFromDisplacement(
  cv: Sector4ConvergenceRuntimeState,
  displacement: GravemarkDisplacementRecord,
): Sector4ConvergenceRuntimeState {
  if (cv.parallaxEchoArmUsedThisPlayerTurn) return cv;
  if (displacement.fizzleReason != null) return cv;
  if (displacement.sourceDefinitionId === CONVERGENCE_IDS.PARALLAX_ECHO) return cv;
  return { ...cv, parallaxEchoArmUsedThisPlayerTurn: true, parallaxEchoArmed: true };
}

/** Consumes the armed +50% multiplier for the next ordinary Core Trace mint, if any. */
export function consumeParallaxEchoArm(
  cv: Sector4ConvergenceRuntimeState,
): { cv: Sector4ConvergenceRuntimeState; multiplier: number } {
  if (!cv.parallaxEchoArmed) return { cv, multiplier: 1 };
  return { cv: { ...cv, parallaxEchoArmed: false }, multiplier: 1.5 };
}

// ---------------------------------------------------------------------------
// 25. Stored Vector (Stillpoint x Gravemark)
// ---------------------------------------------------------------------------

/** Grants a Focused root one bonus Displacement of its legal primary target, regardless of Polarity. */
export function applyStoredVectorBonusDisplacement(args: {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  ctx: CanonicalRootActionContext;
  collisionCourseOwned: boolean;
  depth: CombatDepthBand;
}): {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  displacement: GravemarkDisplacementRecord | null;
  collisions: readonly GravemarkCollisionRecord[];
} {
  const noop = { cv: args.cv, gm: args.gm, intents: args.intents.slice(), displacement: null, collisions: [] };
  if (args.cv.storedVectorProcessedRootId === args.ctx.rootActionId) return noop;
  const primaryId = args.ctx.lockedTargetIds[0] ?? null;
  const target = primaryId ? legalGravemarkHostile(args.intents, mapGravemarkUnit(args.gm, primaryId)) : null;
  const usedCv = { ...args.cv, storedVectorProcessedRootId: args.ctx.rootActionId };
  if (!target) return { ...noop, cv: usedCv };
  const outcome = attemptDisplacement({
    state: args.gm,
    intents: args.intents,
    triggerUnitId: target.unitId,
    bonus: true,
    rootActionId: args.ctx.rootActionId,
    sourceEventId: `${args.ctx.rootActionId}:${CONVERGENCE_IDS.STORED_VECTOR}`,
    sourceDefinitionId: CONVERGENCE_IDS.STORED_VECTOR,
    procDepth: args.ctx.procDepth,
    collisionCourseOwned: args.collisionCourseOwned,
    combatDepth: args.depth,
  });
  return {
    cv: usedCv,
    gm: outcome.state,
    intents: outcome.intents,
    displacement: outcome.attempted ? outcome.record : null,
    collisions: outcome.collisions,
  };
}

/**
 * Requests one Fleeting Stillness if the Focused root caused a qualifying outcome. Never a
 * direct native refund, and skipped entirely when this same root's Stillness spend already
 * consumed Fleeting (or free Stayed Sentence Focus) — "a root that consumed Fleeting cannot
 * create another."
 */
export function tryStoredVectorFleetingRequest(
  sp: StillpointRuntimeState,
  args: { rootActionId: string; qualifies: boolean },
): { sp: StillpointRuntimeState; requested: boolean } {
  if (!args.qualifies) return { sp, requested: false };
  if (stillnessProducerBlocked(sp.focusedRoot?.chargeSource)) return { sp, requested: false };
  const granted = grantFleetingStillness(sp, CONVERGENCE_IDS.STORED_VECTOR, {
    phase: sp.playerTurnOpen ? 'PLAYER_CONTROL' : 'ENEMY_CYCLE',
    sourceRootId: args.rootActionId,
    sourceLineage: [args.rootActionId, CONVERGENCE_IDS.STORED_VECTOR],
  });
  return { sp: granted.state, requested: granted.granted || granted.refreshed };
}

// ---------------------------------------------------------------------------
// 26. Tethered Orbit (Woundweave x Gravemark)
// ---------------------------------------------------------------------------

/** Polarizes both canonical primary endpoints on formation, to the Imprint/surface that established the link, without moving them. */
export function applyTetheredOrbitFormationPolarity(
  gm: GravemarkRuntimeState,
  ctx: { rootActionId: string | null },
  endpointA: string | null,
  endpointB: string | null,
  selfLink: boolean,
  imprint: GravemarkPolarityId,
): GravemarkRuntimeState {
  let next = gm;
  if (endpointA) {
    next = setGravemarkPolarity(next, endpointA, imprint, ctx.rootActionId, CONVERGENCE_IDS.TETHERED_ORBIT).state;
  }
  if (endpointB && !selfLink) {
    next = setGravemarkPolarity(next, endpointB, imprint, ctx.rootActionId, CONVERGENCE_IDS.TETHERED_ORBIT).state;
  }
  return next;
}

/** When a Woundlink endpoint is Displaced, its partner becomes Unmoored (without moving) and armed for a later native root. */
export function armTetheredOrbitPartnerOnDisplacement(
  cv: Sector4ConvergenceRuntimeState,
  gm: GravemarkRuntimeState,
  displacement: GravemarkDisplacementRecord,
  partnerId: string | null,
): { cv: Sector4ConvergenceRuntimeState; gm: GravemarkRuntimeState } {
  if (displacement.fizzleReason != null) return { cv, gm };
  if (!partnerId || partnerId === displacement.triggerUnitId) return { cv, gm };
  const nextGm: GravemarkRuntimeState = {
    ...gm,
    unmooredExpiryByUnitId: { ...gm.unmooredExpiryByUnitId, [partnerId]: gm.playerTurnIndex + 1 },
  };
  return {
    gm: nextGm,
    cv: { ...cv, tetheredOrbitArmedPartnerId: partnerId, tetheredOrbitArmedAfterRootId: displacement.rootActionId ?? null },
  };
}

/** The next later native-direct root actually dealing direct damage to the armed partner grants it one bonus Displacement. */
export function applyTetheredOrbitArmedBonus(args: {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  ctx: CanonicalRootActionContext;
  collisionCourseOwned: boolean;
  depth: CombatDepthBand;
}): {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  displacement: GravemarkDisplacementRecord | null;
  collisions: readonly GravemarkCollisionRecord[];
} {
  const noop = { cv: args.cv, gm: args.gm, intents: args.intents.slice(), displacement: null, collisions: [] };
  const armedId = args.cv.tetheredOrbitArmedPartnerId;
  if (!armedId) return noop;
  if (args.cv.tetheredOrbitBonusUsedThisPlayerTurn) return noop;
  if (args.cv.tetheredOrbitArmedAfterRootId === args.ctx.rootActionId) return noop;
  const hitRow = args.ctx.nativeByTarget.find((row) => row.targetId === armedId && row.nativeDirectDamage > 0);
  if (!hitRow) return noop;
  const target = legalGravemarkHostile(args.intents, mapGravemarkUnit(args.gm, armedId));
  const usedCv: Sector4ConvergenceRuntimeState = {
    ...args.cv,
    tetheredOrbitBonusUsedThisPlayerTurn: true,
    tetheredOrbitArmedPartnerId: null,
    tetheredOrbitArmedAfterRootId: null,
  };
  if (!target) return { ...noop, cv: usedCv };
  const outcome = attemptDisplacement({
    state: args.gm,
    intents: args.intents,
    triggerUnitId: target.unitId,
    bonus: true,
    rootActionId: args.ctx.rootActionId,
    sourceEventId: `${args.ctx.rootActionId}:${CONVERGENCE_IDS.TETHERED_ORBIT}`,
    sourceDefinitionId: CONVERGENCE_IDS.TETHERED_ORBIT,
    procDepth: args.ctx.procDepth,
    collisionCourseOwned: args.collisionCourseOwned,
    combatDepth: args.depth,
  });
  return {
    cv: usedCv,
    gm: outcome.state,
    intents: outcome.intents,
    displacement: outcome.attempted ? outcome.record : null,
    collisions: outcome.collisions,
  };
}

/** Clears the Tethered Orbit arm if the armed partner is no longer legal. */
export function clearTetheredOrbitArmIfInvalid(
  cv: Sector4ConvergenceRuntimeState,
  intents: readonly HostileIntentSnapshot[],
): Sector4ConvergenceRuntimeState {
  if (!cv.tetheredOrbitArmedPartnerId) return cv;
  if (legalGravemarkHostile(intents, cv.tetheredOrbitArmedPartnerId)) return cv;
  return { ...cv, tetheredOrbitArmedPartnerId: null, tetheredOrbitArmedAfterRootId: null };
}

// ---------------------------------------------------------------------------
// 27. Tectonic Shift (Faultline x Gravemark)
// ---------------------------------------------------------------------------

/** Each target's first normal completed Displacement per combat cycle qualifies for 2 Convergence Fault (applied by the caller via addFault). */
export function tectonicShiftFaultEligible(
  cv: Sector4ConvergenceRuntimeState,
  displacement: GravemarkDisplacementRecord,
): { cv: Sector4ConvergenceRuntimeState; eligible: boolean } {
  if (displacement.fizzleReason != null || displacement.bonus) return { cv, eligible: false };
  if (displacement.passengerUnitId === displacement.triggerUnitId) return { cv, eligible: false };
  if (displacement.sourceDefinitionId === CONVERGENCE_IDS.TECTONIC_SHIFT) return { cv, eligible: false };
  if (cv.tectonicShiftFaultAppliedTargetIds.includes(displacement.triggerUnitId)) return { cv, eligible: false };
  return {
    cv: { ...cv, tectonicShiftFaultAppliedTargetIds: [...cv.tectonicShiftFaultAppliedTargetIds, displacement.triggerUnitId] },
    eligible: true,
  };
}

/** Applies the 2 Convergence Fault for a target that just passed tectonicShiftFaultEligible. */
export function applyTectonicShiftFault(
  fl: FaultlineRuntimeState,
  intents: HostileIntentSnapshot[],
  ctx: CanonicalRootActionContext,
  targetId: string,
  depth: CombatDepthBand,
): { fl: FaultlineRuntimeState; intents: HostileIntentSnapshot[]; addition: FaultAdditionRecord; rupture: RuptureResult | null } {
  const applied = addFault({
    state: fl,
    intents,
    ctx,
    targetId,
    amount: 2,
    origin: 'CONVERGENCE',
    classificationIfRupture: 'CONVERGENCE',
    sourceDefinitionId: CONVERGENCE_IDS.TECTONIC_SHIFT,
    sourceEventId: `${ctx.rootActionId}:${CONVERGENCE_IDS.TECTONIC_SHIFT}`,
    depth,
    allowRupture: true,
  });
  return { fl: applied.state, intents: applied.intents, addition: applied.addition, rupture: applied.rupture };
}

/** Each target's first actual Rupture per combat cycle grants one bonus Displacement beyond the normal cap. */
export function applyTectonicShiftRuptureBonus(args: {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  rupture: RuptureResult;
  depth: CombatDepthBand;
  collisionCourseOwned: boolean;
}): {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  displacement: GravemarkDisplacementRecord | null;
  collisions: readonly GravemarkCollisionRecord[];
} {
  const noop = { cv: args.cv, gm: args.gm, intents: args.intents.slice(), displacement: null, collisions: [] };
  if (args.cv.tectonicShiftRuptureBonusUsedThisCombatCycle) return noop;
  if (args.rupture.sourceDefinitionId === CONVERGENCE_IDS.TECTONIC_SHIFT) return noop;
  const usedCv = { ...args.cv, tectonicShiftRuptureBonusUsedThisCombatCycle: true };
  const target = legalGravemarkHostile(args.intents, mapGravemarkUnit(args.gm, args.rupture.targetId));
  // Rupture killing/removing the target still consumes the guard, but movement fizzles.
  if (!target) return { ...noop, cv: usedCv };
  const outcome = attemptDisplacement({
    state: args.gm,
    intents: args.intents,
    triggerUnitId: target.unitId,
    bonus: true,
    rootActionId: null,
    sourceEventId: `${args.rupture.sourceEventId}:${CONVERGENCE_IDS.TECTONIC_SHIFT}`,
    sourceDefinitionId: CONVERGENCE_IDS.TECTONIC_SHIFT,
    procDepth: 0,
    collisionCourseOwned: args.collisionCourseOwned,
    combatDepth: args.depth,
  });
  return {
    cv: usedCv,
    gm: outcome.state,
    intents: outcome.intents,
    displacement: outcome.attempted ? outcome.record : null,
    collisions: outcome.collisions,
  };
}

// ---------------------------------------------------------------------------
// 28. Trauma Vector (Soulwake x Gravemark)
// ---------------------------------------------------------------------------

/** The first legal Wake-powered committed root each combat cycle forces one normal Displacement of its primary target. */
export function applyTraumaVectorForcedDisplacement(args: {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  ctx: CanonicalRootActionContext;
  fallbackHostileId: string | null;
  collisionCourseOwned: boolean;
  depth: CombatDepthBand;
}): {
  cv: Sector4ConvergenceRuntimeState;
  gm: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  displacement: GravemarkDisplacementRecord | null;
  collisions: readonly GravemarkCollisionRecord[];
} {
  const noop = { cv: args.cv, gm: args.gm, intents: args.intents.slice(), displacement: null, collisions: [] };
  if (args.cv.traumaVectorUsedThisCombatCycle) return noop;
  if (!args.ctx.wakePowered) return noop;
  const primaryId = args.ctx.lockedTargetIds[0] ?? args.fallbackHostileId;
  const target = primaryId ? legalGravemarkHostile(args.intents, mapGravemarkUnit(args.gm, primaryId)) : null;
  const usedCv = { ...args.cv, traumaVectorUsedThisCombatCycle: true };
  if (!target) return { ...noop, cv: usedCv };
  const outcome = attemptDisplacement({
    state: args.gm,
    intents: args.intents,
    triggerUnitId: target.unitId,
    bonus: false,
    rootActionId: args.ctx.rootActionId,
    sourceEventId: `${args.ctx.rootActionId}:${CONVERGENCE_IDS.TRAUMA_VECTOR}`,
    sourceDefinitionId: CONVERGENCE_IDS.TRAUMA_VECTOR,
    procDepth: args.ctx.procDepth,
    collisionCourseOwned: args.collisionCourseOwned,
    combatDepth: args.depth,
  });
  return {
    cv: usedCv,
    gm: outcome.state,
    intents: outcome.intents,
    displacement: outcome.attempted ? outcome.record : null,
    collisions: outcome.collisions,
  };
}

export function applyTraumaVectorResidualCarry(
  sw: SoulwakeRuntimeState,
  wakeValueAtCommit: number,
): { sw: SoulwakeRuntimeState; accepted: boolean; amount: number } {
  if (wakeValueAtCommit <= 0) return { sw, accepted: false, amount: 0 };
  const requested = Math.floor(wakeValueAtCommit * 0.5);
  const result = requestResidualCarry(sw, {
    sourceId: CONVERGENCE_IDS.TRAUMA_VECTOR,
    amount: requested,
    triggerId: CONVERGENCE_IDS.TRAUMA_VECTOR,
    sourceWakeKind: sw.activeWakeKind === 'NONE' ? 'NORMAL' : sw.activeWakeKind,
  });
  if (!result.accepted) return { sw: result.state, accepted: false, amount: 0 };
  return { sw: result.state, accepted: true, amount: result.amount };
}

// ---------------------------------------------------------------------------
// 29. Fated Facet (Counterfate x Shardskin)
// ---------------------------------------------------------------------------

/**
 * Shards absorbing damage from the exact currently Fatebound hostile intent store equal
 * Reversal (capped at 12 per intent lineage), then check for a first <10 -> >=10 crossing
 * within the current enemy-cycle window, generating 5 Shards on that crossing only.
 */
export function applyFatedFacetAbsorption(args: {
  cv: Sector4ConvergenceRuntimeState;
  cf: CounterfateRuntimeState;
  ss: ShardskinRuntimeState;
  attackerUnitId: string | null | undefined;
  shardsAbsorbed: number;
  depth: CombatDepthBand;
}): { cv: Sector4ConvergenceRuntimeState; cf: CounterfateRuntimeState; ss: ShardskinRuntimeState; thresholdShards: number } {
  const noop = { cv: args.cv, cf: args.cf, ss: args.ss, thresholdShards: 0 };
  if (args.shardsAbsorbed <= 0) return noop;
  if (!args.cf.fateboundInstanceId || !args.cf.fateboundUnitId) return noop;
  if (args.attackerUnitId !== args.cf.fateboundUnitId) return noop;
  const lineageId = args.cf.fateboundInstanceId;
  let cv = args.cv;
  const alreadyStored = cv.fatedFacetAbsorptionLineageId === lineageId ? cv.fatedFacetAbsorptionStoredThisLineage : 0;
  const room = Math.max(0, 12 - alreadyStored);
  const storeAmount = Math.min(room, args.shardsAbsorbed);
  if (storeAmount <= 0) {
    cv = { ...cv, fatedFacetAbsorptionLineageId: lineageId, fatedFacetAbsorptionStoredThisLineage: alreadyStored };
    return { ...noop, cv };
  }
  const before = args.cf.rawReversal;
  const stored = storeReversal(args.cf, storeAmount);
  const after = stored.cf.rawReversal;
  cv = {
    ...cv,
    fatedFacetAbsorptionLineageId: lineageId,
    fatedFacetAbsorptionStoredThisLineage: alreadyStored + stored.result.accepted,
  };
  const windowKey = args.cf.fateboundInstanceId;
  if (cv.fatedFacetThresholdWindowKey !== windowKey) {
    cv = { ...cv, fatedFacetThresholdWindowKey: windowKey, fatedFacetThresholdCrossedThisWindow: false };
  }
  if (!cv.fatedFacetThresholdCrossedThisWindow && before < 10 && after >= 10) {
    cv = { ...cv, fatedFacetThresholdCrossedThisWindow: true };
    const granted = grantShardsCapped(args.ss, args.depth, 5, CONVERGENCE_IDS.FATED_FACET);
    return { cv, cf: stored.cf, ss: granted.state, thresholdShards: granted.generated };
  }
  return { cv, cf: stored.cf, ss: args.ss, thresholdShards: 0 };
}

// ---------------------------------------------------------------------------
// 30. Prismatic Rite (Ritual Cadence x Shardskin)
// ---------------------------------------------------------------------------

export function applyPrismaticRiteFinaleShards(
  cv: Sector4ConvergenceRuntimeState,
  ss: ShardskinRuntimeState,
  depth: CombatDepthBand,
  rootActionId: string | null,
): { cv: Sector4ConvergenceRuntimeState; ss: ShardskinRuntimeState; generated: number } {
  if (rootActionId && cv.prismaticRiteFinaleShardsRootId === rootActionId) return { cv, ss, generated: 0 };
  const granted = grantShardsCapped(ss, depth, 6, CONVERGENCE_IDS.PRISMATIC_RITE);
  return {
    cv: { ...cv, prismaticRiteFinaleShardsRootId: rootActionId },
    ss: granted.state,
    generated: granted.generated,
  };
}

/** Queues one additional Beat (no Finale, clamped at Beat II) once positive Edge is consumed by a root. */
export function armPrismaticRiteDeferredBeat(
  cv: Sector4ConvergenceRuntimeState,
): Sector4ConvergenceRuntimeState {
  return { ...cv, prismaticRiteDeferredBeat: true };
}

export function applyPrismaticRiteDeferredBeat(
  cv: Sector4ConvergenceRuntimeState,
  rc: RitualCadenceRuntimeState,
): { cv: Sector4ConvergenceRuntimeState; rc: RitualCadenceRuntimeState } {
  if (!cv.prismaticRiteDeferredBeat) return { cv, rc };
  return { rc: advanceMeasureWithoutFinale(rc), cv: { ...cv, prismaticRiteDeferredBeat: false } };
}

/** Cathedral Break's own Edge consumption queues the Beat only once its ultimate root fully finishes. */
export function armPrismaticRiteCathedralPending(
  cv: Sector4ConvergenceRuntimeState,
  rootActionId: string,
): Sector4ConvergenceRuntimeState {
  return { ...cv, prismaticRiteCathedralPendingRootId: rootActionId };
}

export function resolvePrismaticRiteCathedralPending(
  cv: Sector4ConvergenceRuntimeState,
  rootActionId: string,
): Sector4ConvergenceRuntimeState {
  if (cv.prismaticRiteCathedralPendingRootId !== rootActionId) return cv;
  return { ...cv, prismaticRiteCathedralPendingRootId: null, prismaticRiteDeferredBeat: true };
}

// ---------------------------------------------------------------------------
// 31. Phantom Facet (Afterimage x Shardskin)
// ---------------------------------------------------------------------------

export function applyPhantomFacetGeneration(
  cv: Sector4ConvergenceRuntimeState,
  ss: ShardskinRuntimeState,
  depth: CombatDepthBand,
  effectiveTracePower: number,
): { cv: Sector4ConvergenceRuntimeState; ss: ShardskinRuntimeState; generated: number } {
  if (cv.phantomFacetGenerationUsedThisPlayerTurn) return { cv, ss, generated: 0 };
  const usedCv = { ...cv, phantomFacetGenerationUsedThisPlayerTurn: true };
  const amount = Math.min(6, Math.floor(Math.max(0, effectiveTracePower) * 0.25));
  const granted = grantShardsCapped(ss, depth, amount, CONVERGENCE_IDS.PHANTOM_FACET);
  return { cv: usedCv, ss: granted.state, generated: granted.generated };
}

/** Arms +50% for the next ordinary Core Trace minted this same player turn. Expires unused at turn end. */
export function armPhantomFacetFromEdge(
  cv: Sector4ConvergenceRuntimeState,
  rootActionId: string | null,
): Sector4ConvergenceRuntimeState {
  return { ...cv, phantomFacetArmed: true, phantomFacetArmedRootId: rootActionId };
}

export function consumePhantomFacetArm(
  cv: Sector4ConvergenceRuntimeState,
): { cv: Sector4ConvergenceRuntimeState; multiplier: number } {
  if (!cv.phantomFacetArmed) return { cv, multiplier: 1 };
  return { cv: { ...cv, phantomFacetArmed: false, phantomFacetArmedRootId: null }, multiplier: 1.5 };
}

// ---------------------------------------------------------------------------
// 32. Stillglass (Stillpoint x Shardskin)
// ---------------------------------------------------------------------------

export function applyStillglassNativeStillnessShards(
  ss: ShardskinRuntimeState,
  depth: CombatDepthBand,
): { ss: ShardskinRuntimeState; generated: number } {
  const granted = grantShardsCapped(ss, depth, 5, CONVERGENCE_IDS.STILLGLASS);
  return { ss: granted.state, generated: granted.generated };
}

/** First time Shards absorb positive damage each enemy cycle, arms a pending Fleeting for the next player-turn start. */
export function armStillglassPendingFleeting(
  cv: Sector4ConvergenceRuntimeState,
): Sector4ConvergenceRuntimeState {
  if (cv.stillglassAbsorptionArmedThisEnemyCycle) return cv;
  return { ...cv, stillglassAbsorptionArmedThisEnemyCycle: true, stillglassPendingFleeting: true };
}

export function consumeStillglassPendingFleeting(
  cv: Sector4ConvergenceRuntimeState,
): { cv: Sector4ConvergenceRuntimeState; shouldCreate: boolean } {
  if (!cv.stillglassPendingFleeting) return { cv, shouldCreate: false };
  return { cv: { ...cv, stillglassPendingFleeting: false }, shouldCreate: true };
}

// ---------------------------------------------------------------------------
// 33. Crystal Ligature (Woundweave x Shardskin)
// ---------------------------------------------------------------------------

export function applyCrystalLigatureFormationShards(
  cv: Sector4ConvergenceRuntimeState,
  ss: ShardskinRuntimeState,
  depth: CombatDepthBand,
): { cv: Sector4ConvergenceRuntimeState; ss: ShardskinRuntimeState; generated: number } {
  if (cv.crystalLigatureFormationUsedThisPlayerTurn) return { cv, ss, generated: 0 };
  const usedCv = { ...cv, crystalLigatureFormationUsedThisPlayerTurn: true };
  const granted = grantShardsCapped(ss, depth, 4, CONVERGENCE_IDS.CRYSTAL_LIGATURE);
  return { cv: usedCv, ss: granted.state, generated: granted.generated };
}

/** Mirrors 50% of the actual Edge damage dealt to the primary's Woundlink partner, once, non-repeating. */
export function crystalLigatureMirrorAmount(edgeDamageDealt: number, selfLink: boolean): number {
  const half = Math.floor(edgeDamageDealt * 0.5);
  if (half <= 0) return 0;
  return selfLink ? Math.floor(half * 0.4) : half;
}

// ---------------------------------------------------------------------------
// 34. Faultglass (Faultline x Shardskin)
// ---------------------------------------------------------------------------

/**
 * On positive Edge consumption: 2 Fault to the legal locked primary, 1 Fault to every other
 * distinct enemy that received native direct damage from the root (the frozen native target
 * map — no fallback for missing splash), applied from the EDGE_CONSUMED-equivalent CONVERGENCE
 * lineage before Edge/Scatterglass packet outcomes. May cause one legal Rupture, which itself
 * cannot consume/recreate Edge (callers must not route this Rupture back into Edge consumption).
 */
export function applyFaultglassEdgeFault(
  fl: FaultlineRuntimeState,
  intents: HostileIntentSnapshot[],
  ctx: CanonicalRootActionContext,
  primaryTargetId: string | null,
  depth: CombatDepthBand,
): { fl: FaultlineRuntimeState; intents: HostileIntentSnapshot[]; additions: FaultAdditionRecord[]; ruptures: RuptureResult[] } {
  let flState = fl;
  let liveIntents = intents;
  const additions: FaultAdditionRecord[] = [];
  const ruptures: RuptureResult[] = [];
  const seen = new Set<string>();
  const order: { targetId: string; amount: number }[] = [];
  if (primaryTargetId) {
    order.push({ targetId: primaryTargetId, amount: 2 });
    seen.add(primaryTargetId);
  }
  for (const row of ctx.nativeByTarget) {
    if (row.nativeDirectDamage <= 0 || seen.has(row.targetId)) continue;
    seen.add(row.targetId);
    order.push({ targetId: row.targetId, amount: 1 });
  }
  for (const row of order) {
    if (!legalGravemarkHostile(liveIntents, row.targetId)) continue;
    const applied = addFault({
      state: flState,
      intents: liveIntents,
      ctx,
      targetId: row.targetId,
      amount: row.amount,
      origin: 'CONVERGENCE',
      classificationIfRupture: 'CONVERGENCE',
      sourceDefinitionId: CONVERGENCE_IDS.FAULTGLASS,
      sourceEventId: `${ctx.rootActionId}:${CONVERGENCE_IDS.FAULTGLASS}:${row.targetId}`,
      depth,
      allowRupture: true,
    });
    flState = applied.state;
    liveIntents = applied.intents;
    additions.push(applied.addition);
    if (applied.rupture) ruptures.push(applied.rupture);
  }
  return { fl: flState, intents: liveIntents, additions, ruptures };
}

export function applyFaultglassRuptureShards(
  cv: Sector4ConvergenceRuntimeState,
  ss: ShardskinRuntimeState,
  depth: CombatDepthBand,
): { cv: Sector4ConvergenceRuntimeState; ss: ShardskinRuntimeState; generated: number } {
  if (cv.faultglassRuptureUsedThisPlayerTurn) return { cv, ss, generated: 0 };
  const usedCv = { ...cv, faultglassRuptureUsedThisPlayerTurn: true };
  const granted = grantShardsCapped(ss, depth, 6, CONVERGENCE_IDS.FAULTGLASS);
  return { cv: usedCv, ss: granted.state, generated: granted.generated };
}

// ---------------------------------------------------------------------------
// 35. Soulglass (Soulwake x Shardskin)
// ---------------------------------------------------------------------------

export function applySoulglassGeneration(
  cv: Sector4ConvergenceRuntimeState,
  ss: ShardskinRuntimeState,
  depth: CombatDepthBand,
  wakeValueAtCommit: number,
): { cv: Sector4ConvergenceRuntimeState; ss: ShardskinRuntimeState; generated: number } {
  if (cv.soulglassGenerationUsedThisPlayerTurn) return { cv, ss, generated: 0 };
  const usedCv = { ...cv, soulglassGenerationUsedThisPlayerTurn: true };
  const amount = Math.min(8, Math.floor(Math.max(0, wakeValueAtCommit) * 0.5));
  const granted = grantShardsCapped(ss, depth, amount, CONVERGENCE_IDS.SOULGLASS);
  return { cv: usedCv, ss: granted.state, generated: granted.generated };
}

export function applySoulglassResidualCarry(
  sw: SoulwakeRuntimeState,
  wakeValueAtCommit: number,
): { sw: SoulwakeRuntimeState; accepted: boolean; amount: number } {
  if (wakeValueAtCommit <= 0) return { sw, accepted: false, amount: 0 };
  const requested = Math.floor(wakeValueAtCommit * 0.5);
  const result = requestResidualCarry(sw, {
    sourceId: CONVERGENCE_IDS.SOULGLASS,
    amount: requested,
    triggerId: CONVERGENCE_IDS.SOULGLASS,
    sourceWakeKind: sw.activeWakeKind === 'NONE' ? 'NORMAL' : sw.activeWakeKind,
  });
  if (!result.accepted) return { sw: result.state, accepted: false, amount: 0 };
  return { sw: result.state, accepted: true, amount: result.amount };
}

// ---------------------------------------------------------------------------
// 36. Impact Lattice (Gravemark x Shardskin)
// ---------------------------------------------------------------------------

export function applyImpactLatticeDisplacementShards(
  cv: Sector4ConvergenceRuntimeState,
  ss: ShardskinRuntimeState,
  depth: CombatDepthBand,
  displacement: GravemarkDisplacementRecord,
): { cv: Sector4ConvergenceRuntimeState; ss: ShardskinRuntimeState; generated: number } {
  if (cv.impactLatticeGenerationUsedThisCombatCycle) return { cv, ss, generated: 0 };
  if (displacement.fizzleReason != null) return { cv, ss, generated: 0 };
  if (displacement.passengerUnitId === displacement.triggerUnitId) return { cv, ss, generated: 0 };
  if (displacement.sourceDefinitionId === CONVERGENCE_IDS.IMPACT_LATTICE) return { cv, ss, generated: 0 };
  const usedCv = { ...cv, impactLatticeGenerationUsedThisCombatCycle: true };
  const granted = grantShardsCapped(ss, depth, 5, CONVERGENCE_IDS.IMPACT_LATTICE);
  return { cv: usedCv, ss: granted.state, generated: granted.generated };
}

/**
 * On positive Edge consumption: Polarizes an unpolarized, non-Unmoored locked primary to the
 * consuming root's routine Imprint without movement, or — if already Polarized/Unmoored —
 * grants one bonus Displacement bypassing the normal cap. The bonus never re-enters this
 * function (callers must not route its own attemptDisplacement result back through it).
 */
export function applyImpactLatticeEdgeClause(args: {
  gm: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  primaryTargetId: string | null;
  routineImprint: GravemarkPolarityId | null;
  rootActionId: string | null;
  procDepth: number;
  collisionCourseOwned: boolean;
  depth: CombatDepthBand;
}): {
  gm: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  displacement: GravemarkDisplacementRecord | null;
  collisions: readonly GravemarkCollisionRecord[];
  polarized: boolean;
} {
  const noop = { gm: args.gm, intents: args.intents.slice(), displacement: null, collisions: [], polarized: false };
  if (!args.primaryTargetId) return noop;
  const mapped = mapGravemarkUnit(args.gm, args.primaryTargetId);
  const target = legalGravemarkHostile(args.intents, mapped);
  if (!target) return noop;
  const unmoored = (args.gm.unmooredExpiryByUnitId[mapped] ?? 0) > args.gm.playerTurnIndex;
  const polarized = args.gm.polarityByUnitId[mapped] !== undefined;
  if (polarized || unmoored) {
    const outcome = attemptDisplacement({
      state: args.gm,
      intents: args.intents,
      triggerUnitId: mapped,
      bonus: true,
      rootActionId: args.rootActionId,
      sourceEventId: `${args.rootActionId ?? 'edge'}:${CONVERGENCE_IDS.IMPACT_LATTICE}`,
      sourceDefinitionId: CONVERGENCE_IDS.IMPACT_LATTICE,
      procDepth: args.procDepth,
      collisionCourseOwned: args.collisionCourseOwned,
      combatDepth: args.depth,
    });
    return {
      gm: outcome.state,
      intents: outcome.intents,
      displacement: outcome.attempted ? outcome.record : null,
      collisions: outcome.collisions,
      polarized: false,
    };
  }
  if (!args.routineImprint) return noop;
  const result = setGravemarkPolarity(args.gm, mapped, args.routineImprint, args.rootActionId, CONVERGENCE_IDS.IMPACT_LATTICE);
  return { gm: result.state, intents: args.intents.slice(), displacement: null, collisions: [], polarized: true };
}
