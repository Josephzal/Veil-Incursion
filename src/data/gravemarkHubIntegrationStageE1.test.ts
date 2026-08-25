import assert from 'node:assert/strict';
import { GRAVEMARK_CORE_IDS } from '../types/gravemark';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { applyGravemarkMovementToSquad } from './nineStrain/gravemarkHubConsumer';
import type { TargetNativeResult } from '../types/nineStrain';
import type { CombatGridSlotId } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import type { GravemarkPendingMovementEffect } from '../types/gravemark';

console.log('Stage E.1 — Gravemark Hub integration');

const live = getLiveUniversalBoonDefinitions();

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  return runtime;
}

function hostiles(
  runtime: ReturnType<typeof rt>,
  rows: ReadonlyArray<{ id: string; slot: CombatGridSlotId; hp?: number }>,
) {
  runtime.syncHostileIntents(rows.map((row, index) => hostileSnapshotInput({
    unitId: row.id,
    intentKind: 'STRIKE',
    hostileTurnOrder: index,
    slot: row.slot,
    designation: row.id,
    hp: row.hp ?? 80,
    maxHp: row.hp ?? 80,
  })));
}

function native(targetId: string, damage: number, extra: Partial<TargetNativeResult> = {}): TargetNativeResult {
  return {
    targetId, hits: 1, misses: 0, crits: 0, nativeDirectDamage: damage, defenseDamage: 0, defenseBreaks: 0,
    fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0, ...extra,
  };
}

function strike(runtime: ReturnType<typeof rt>, rootActionId: string, targets: TargetNativeResult[], extra: Parameters<typeof weaponFamilyExecutionContext>[1] = {}) {
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId,
    actionSurface: extra.actionSurface ?? 'WEAPON',
    nativeByTarget: targets,
    lockedTargetIds: extra.lockedTargetIds ?? targets.map((row) => row.targetId),
    ...extra,
  }));
}

function unit(id: string, slot: CombatGridSlotId): EnemyCombatProfile {
  return {
    unitId: id,
    gridSlot: slot,
    class: 'GREMLIN',
    designation: id,
    maxHp: 80,
    currentHp: 80,
    baseDamage: 5,
    intent: 'STRIKE',
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex: 0,
    scale: 1,
  };
}

// =====================================================================================
// applyGravemarkMovementToSquad — the sole atomic move/swap adapter used by execution,
// preview, and the Hub. No second grid model: this operates on the exact same
// EnemyCombatProfile[] / unitPlacedAtSlot / swapUnitGridSlots primitives as the live squad.
// =====================================================================================

// --- Empty destination move ---
{
  const squad = [unit('a', 'FL_0'), unit('b', 'FL_1')];
  const effect: GravemarkPendingMovementEffect = {
    id: 'gm:1', triggerUnitId: 'a', passengerUnitId: null, fromSlot: 'FL_0', toSlot: 'BL_0', kind: 'MOVE', createdOrder: 1,
  };
  const result = applyGravemarkMovementToSquad(squad, [effect]);
  assert.equal(result.squad.find((u) => u.unitId === 'a')?.gridSlot, 'BL_0');
  assert.equal(result.squad.find((u) => u.unitId === 'b')?.gridSlot, 'FL_1', 'untouched unit unaffected');
  assert.equal(result.applied.length, 1);
  assert.equal(result.skipped.length, 0);
}

// --- Occupied atomic swap ---
{
  const squad = [unit('a', 'FL_0'), unit('b', 'BL_0')];
  const effect: GravemarkPendingMovementEffect = {
    id: 'gm:1', triggerUnitId: 'a', passengerUnitId: 'b', fromSlot: 'FL_0', toSlot: 'BL_0', kind: 'SWAP', createdOrder: 1,
  };
  const result = applyGravemarkMovementToSquad(squad, [effect]);
  assert.equal(result.squad.find((u) => u.unitId === 'a')?.gridSlot, 'BL_0');
  assert.equal(result.squad.find((u) => u.unitId === 'b')?.gridSlot, 'FL_0');
  assert.equal(result.applied.length, 1);
}

// --- Trigger unit no longer present (dead/removed since queuing) -> skipped, not invented ---
{
  const squad = [unit('b', 'BL_0')];
  const effect: GravemarkPendingMovementEffect = {
    id: 'gm:1', triggerUnitId: 'a', passengerUnitId: null, fromSlot: 'FL_0', toSlot: 'BL_0', kind: 'MOVE', createdOrder: 1,
  };
  const result = applyGravemarkMovementToSquad(squad, [effect]);
  assert.equal(result.applied.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.squad.find((u) => u.unitId === 'b')?.gridSlot, 'BL_0', 'unaffected unit untouched');
}

// --- Passenger no longer present -> degrades to a plain move for the trigger unit ---
{
  const squad = [unit('a', 'FL_0')];
  const effect: GravemarkPendingMovementEffect = {
    id: 'gm:1', triggerUnitId: 'a', passengerUnitId: 'b', fromSlot: 'FL_0', toSlot: 'BL_0', kind: 'SWAP', createdOrder: 1,
  };
  const result = applyGravemarkMovementToSquad(squad, [effect]);
  assert.equal(result.squad.find((u) => u.unitId === 'a')?.gridSlot, 'BL_0');
  assert.equal(result.applied.length, 1);
}

// --- Stable creation order regardless of array order ---
{
  const squad = [unit('a', 'FL_0'), unit('b', 'FL_1')];
  const effects: GravemarkPendingMovementEffect[] = [
    { id: 'gm:2', triggerUnitId: 'b', passengerUnitId: null, fromSlot: 'FL_1', toSlot: 'BL_1', kind: 'MOVE', createdOrder: 2 },
    { id: 'gm:1', triggerUnitId: 'a', passengerUnitId: null, fromSlot: 'FL_0', toSlot: 'BL_0', kind: 'MOVE', createdOrder: 1 },
  ];
  const result = applyGravemarkMovementToSquad(squad, effects);
  assert.equal(result.applied[0]?.id, 'gm:1', 'applied in createdOrder, not array order');
  assert.equal(result.applied[1]?.id, 'gm:2');
}

// =====================================================================================
// Runtime-level consume-once proofs
// =====================================================================================

// --- Runtime movement updates the rendered grid exactly once: empty move ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true, associatedHostileUnitId: 'enemy-a' });

  let squad = [unit('enemy-a', 'FL_0')];
  const firstDrain = runtime.consumeGravemarkPendingMovement();
  assert.equal(firstDrain.length, 1, 'exactly one queued movement effect');
  const applied = applyGravemarkMovementToSquad(squad, firstDrain);
  squad = applied.squad as EnemyCombatProfile[];
  assert.equal(squad.find((u) => u.unitId === 'enemy-a')?.gridSlot, 'BL_0', 'live grid actually moved');

  // No replay after acknowledgement, no duplicate application after a (simulated) rerender.
  const secondDrain = runtime.consumeGravemarkPendingMovement();
  assert.equal(secondDrain.length, 0, 'consume-once: nothing left to drain');
  const reapplied = applyGravemarkMovementToSquad(squad, secondDrain);
  assert.equal(reapplied.squad.find((u) => u.unitId === 'enemy-a')?.gridSlot, 'BL_0', 'idempotent no-op rerender');
}

// --- Runtime movement updates the rendered grid exactly once: occupied swap ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-b', slot: 'BL_0' }]);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true, associatedHostileUnitId: 'enemy-a' });

  let squad = [unit('enemy-a', 'FL_0'), unit('enemy-b', 'BL_0')];
  const drained = runtime.consumeGravemarkPendingMovement();
  assert.equal(drained.length, 1);
  assert.equal(drained[0]?.kind, 'SWAP');
  const applied = applyGravemarkMovementToSquad(squad, drained);
  squad = applied.squad as EnemyCombatProfile[];
  assert.equal(squad.find((u) => u.unitId === 'enemy-a')?.gridSlot, 'BL_0');
  assert.equal(squad.find((u) => u.unitId === 'enemy-b')?.gridSlot, 'FL_0');
  assert.equal(runtime.consumeGravemarkPendingMovement().length, 0, 'consume-once after swap');
}

// --- Save/resume with an unconsumed pending movement survives the round-trip ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true, associatedHostileUnitId: 'enemy-a' });
  // Do NOT consume — simulate a save immediately after the Displacement was queued.
  const saved = runtime.serialize();

  const resumed = rt();
  resumed.hydrate(saved);
  const drained = resumed.consumeGravemarkPendingMovement();
  assert.equal(drained.length, 1, 'the unconsumed pending movement survived the save/resume round-trip');
  assert.equal(resumed.consumeGravemarkPendingMovement().length, 0, 'still consume-once after resume');
}

// --- Folded Space AP refund: consume-once, including across a save/resume ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  runtime.grantFixture(GRAVEMARK_CORE_IDS.FOLDED_SPACE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true, associatedHostileUnitId: 'enemy-a' });
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  strike(runtime, 'technique', [native('enemy-a', 6)], { actionSurface: 'TECHNIQUE', actualCostsPaid: { ap: 2 } });

  const saved = runtime.serialize();
  const resumed = rt();
  resumed.hydrate(saved);
  const refund = resumed.consumeGravemarkApRefund();
  assert.equal(refund, 1, 'refund survives save/resume unconsumed, then drains');
  assert.equal(resumed.consumeGravemarkApRefund(), 0, 'consume-once: drained exactly once');
}

// =====================================================================================
// Preview leaves live state unchanged; preview/execution parity
// =====================================================================================

{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 5)]);
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true, associatedHostileUnitId: 'enemy-a' });
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });

  const beforeState = runtime.getState();
  const beforeIntents = runtime.hostileIntents();
  const ctx = weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'weapon:preview',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 20)],
    lockedTargetIds: ['enemy-a'],
  });
  const preview = runtime.previewGravemark(ctx);

  // Preview leaves live state and intents completely unchanged.
  assert.deepEqual(runtime.getState().gravemark, beforeState.gravemark, 'preview did not mutate live Gravemark state');
  assert.deepEqual(runtime.hostileIntents(), beforeIntents, 'preview did not mutate live hostile intents');

  // Preview predicts exactly what execution will do: same target, same from/to slots, same cap use.
  assert.equal(preview.deltas.length, 1);
  const delta = preview.deltas[0];
  assert.equal(delta.targetId, 'enemy-a');
  assert.equal(delta.polarityBefore, 'INSTINCT');
  assert.equal(delta.polarityAfter, 'ARMAMENT');
  assert.equal(delta.displaced, true);
  assert.equal(delta.fromSlot, 'BL_0');
  assert.equal(delta.toSlot, 'FL_0');
  assert.equal(delta.swapUnitId, null);

  runtime.commitRootAction(ctx);
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], delta.polarityAfter, 'execution matches preview Polarity');
  assert.equal(runtime.hostileIntents().find((row) => row.unitId === 'enemy-a')?.gridSlot, delta.toSlot, 'execution matches preview destination slot');
  assert.equal(runtime.getState().gravemark.displacementCountByUnitId['enemy-a'], 1, 'execution matches preview cap use');
  assert.equal(runtime.getState().gravemark.lastCollision?.amount, Math.floor(20 * 0.25), 'execution damage matches Impact Vector math the preview would have predicted');
}

console.log('Stage E.1 — Gravemark Hub integration passed');
