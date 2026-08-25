import assert from 'node:assert/strict';
import {
  GRAVEMARK_CORE_IDS,
  GRAVEMARK_MANIFESTATION_ID,
  GRAVEMARK_SUPPORT_IDS,
  GRAVEMARK_VERDICT_ID,
} from '../types/gravemark';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import {
  createNineStrainRuntime,
  instinctInputForClass,
  majorCurrentInput,
  ordinaryCurrentInput,
  weaponFamilyExecutionContext,
} from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import type { TargetNativeResult } from '../types/nineStrain';
import type { CombatGridSlotId } from '../types/combatGrid';

console.log('Stage E.1 — Gravemark');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 108);
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(getProductionOfferDefinitions(3).length, 77);
// Impact Lattice (Gravemark x Shardskin, Stage E.3) is the one Sector 4 Convergence whose
// primary strainId is GRAVEMARK, so the raw filter is 8 family definitions + 1 Convergence.
assert.equal(live.filter((row) => row.strainId === 'GRAVEMARK' && row.role !== 'CONVERGENCE').length, 8);
assert.equal(live.filter((row) => row.strainId === 'GRAVEMARK').length, 9);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  return runtime;
}

function native(targetId: string, damage: number, extra: Partial<TargetNativeResult> = {}): TargetNativeResult {
  return {
    targetId,
    hits: damage > 0 || extra.killed || extra.statusesApplied ? 1 : 0,
    misses: damage <= 0 && !extra.killed && !extra.statusesApplied && extra.misses == null ? 1 : 0,
    crits: 0,
    nativeDirectDamage: damage,
    defenseDamage: 0,
    defenseBreaks: 0,
    fractures: 0,
    statusesApplied: 0,
    killed: false,
    healingDealt: 0,
    movement: 0,
    ...extra,
  };
}

function hostiles(
  runtime: ReturnType<typeof rt>,
  rows: ReadonlyArray<{ id: string; slot: CombatGridSlotId; hp?: number; immovable?: boolean; protectedPhase?: boolean; authoredCounter?: boolean }>,
  jammed = false,
) {
  runtime.syncHostileIntents(rows.map((row, index) => hostileSnapshotInput({
    unitId: row.id,
    intentKind: 'STRIKE',
    hostileTurnOrder: index,
    slot: row.slot,
    designation: row.id,
    hp: row.hp ?? 80,
    maxHp: row.hp ?? 80,
    immovable: row.immovable,
    protectedPhase: row.protectedPhase,
    authoredCounter: row.authoredCounter,
  })), jammed);
}

function strike(
  runtime: ReturnType<typeof rt>,
  rootActionId: string,
  targets: TargetNativeResult[],
  extra: Parameters<typeof weaponFamilyExecutionContext>[1] = {},
) {
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId,
    actionSurface: extra.actionSurface ?? 'WEAPON',
    nativeByTarget: targets,
    lockedTargetIds: extra.lockedTargetIds ?? targets.map((row) => row.targetId),
    totalNativeDirectDamage: targets.reduce((sum, row) => sum + row.nativeDirectDamage, 0),
    ...extra,
  }));
}

function slot(runtime: ReturnType<typeof rt>, unitId: string): CombatGridSlotId | undefined {
  return runtime.hostileIntents().find((row) => row.unitId === unitId)?.gridSlot;
}

// --- 1. First Polarity application, same-Polarity repeat, different-Polarity Displacement ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-b', slot: 'FL_1' }]);
  runtime.runTurnStart();
  // First application: no prior Polarity -> no ordinary Displacement even though slot is free.
  strike(runtime, 'r1', [native('enemy-a', 10)]);
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'ARMAMENT');
  assert.equal(slot(runtime, 'enemy-a'), 'FL_0', 'no displacement on first Polarity application');
  assert.equal(runtime.getState().gravemark.displacementCountByUnitId['enemy-a'] ?? 0, 0);

  // Same Polarity repeat -> retained, still no Displacement.
  strike(runtime, 'r2', [native('enemy-a', 10)]);
  assert.equal(slot(runtime, 'enemy-a'), 'FL_0', 'same Polarity does not Displace');
  assert.equal(runtime.getState().gravemark.displacementCountByUnitId['enemy-a'] ?? 0, 0);
}

// --- 2. Normal cap, combat-cycle reset, Unmoored expiry, persistent Polarity ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-b', slot: 'FL_1' }]);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 10)]);
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'ARMAMENT');

  // Different Polarity via Instinct -> attempts a normal Displacement (empty BL_0).
  runtime.resolveInstinct({ ...instinctInputForClass('AEGIS'), perfectParry: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'INSTINCT');
  assert.equal(slot(runtime, 'enemy-a'), 'BL_0', 'Displacement moved enemy-a to the empty corresponding slot');
  assert.equal(runtime.getState().gravemark.displacementCountByUnitId['enemy-a'], 1);
  assert.ok(runtime.getState().gravemark.unmooredExpiryByUnitId['enemy-a'] > runtime.getState().gravemark.playerTurnIndex);

  // Cap: a further Polarity change this cycle must not Displace again.
  strike(runtime, 'r3', [native('enemy-a', 10)]);
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'ARMAMENT');
  assert.equal(slot(runtime, 'enemy-a'), 'BL_0', 'cap reached — no second Displacement this cycle');
  assert.equal(runtime.getState().gravemark.displacementCountByUnitId['enemy-a'], 1);
  assert.equal(runtime.getState().gravemark.lastCapBlock?.reason, 'CAP_REACHED');

  // Polarity persists across a player turn boundary.
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'ARMAMENT', 'Polarity persists until changed');

  // Unmoored expires at the very start of the next PLAYER_TURN_STARTED.
  assert.equal(runtime.getState().gravemark.unmooredExpiryByUnitId['enemy-a'], undefined);

  // Combat-cycle reset (ENEMY_CYCLE_STARTED) clears the Displacement cap.
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  assert.equal(runtime.getState().gravemark.displacementCountByUnitId['enemy-a'], undefined);
  runtime.resolveInstinct({ ...instinctInputForClass('AEGIS'), perfectParry: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(slot(runtime, 'enemy-a'), 'FL_0', 'cap reset allows a fresh Displacement');
}

// --- 3. Empty-slot movement, occupied atomic swap, passenger ownership ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-c', slot: 'BL_0' }]);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 10)]);
  // Different Polarity via a second weapon-surface strike is impossible (same imprint) — use
  // Reversal Field-free swap check instead: grant Reversal Field for a class-Polarity flip.
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  runtime.resolveInstinct({ ...instinctInputForClass('AEGIS'), perfectParry: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(slot(runtime, 'enemy-a'), 'BL_0', 'trigger owner swapped into the occupied slot');
  assert.equal(slot(runtime, 'enemy-c'), 'FL_0', 'passenger swapped into the vacated slot');
  assert.equal(runtime.getState().gravemark.displacementCountByUnitId['enemy-c'] ?? 0, 0, 'passenger does not consume its own cap');
  assert.equal(runtime.getState().gravemark.unmooredExpiryByUnitId['enemy-c'], undefined, 'passenger is not Unmoored without Collision Course');
}

// --- 4. Stable multi-target processing without hit/animation-order dependence ---
{
  const runtimeA = rt();
  runtimeA.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  hostiles(runtimeA, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-b', slot: 'FL_1' }]);
  runtimeA.runTurnStart();
  strike(runtimeA, 'r1', [native('enemy-a', 10), native('enemy-b', 10)], { lockedTargetIds: ['enemy-a', 'enemy-b'] });

  const runtimeB = rt();
  runtimeB.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  hostiles(runtimeB, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-b', slot: 'FL_1' }]);
  runtimeB.runTurnStart();
  // Reversed nativeByTarget array order, same locked pattern — result must be identical.
  strike(runtimeB, 'r1', [native('enemy-b', 10), native('enemy-a', 10)], { lockedTargetIds: ['enemy-a', 'enemy-b'] });

  assert.deepEqual(runtimeA.getState().gravemark.polarityByUnitId, runtimeB.getState().gravemark.polarityByUnitId);
}

// --- 5. Miss, selection-only, derivative, invalid, canceled, and unpaid exclusions ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  // Pure miss: no damage, no status, no movement, no kill -> not directly affected.
  strike(runtime, 'miss', [native('enemy-a', 0)]);
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], undefined, 'miss alone does not apply Polarity');

  // Uncommitted (canceled/invalid) root does not apply Polarity.
  strike(runtime, 'cancel', [native('enemy-a', 10)], { committed: false });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], undefined, 'uncommitted root excluded');

  // Derivative classification does not apply routine Polarity.
  strike(runtime, 'deriv', [native('enemy-a', 10)], { classification: 'DERIVATIVE' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], undefined, 'derivative classification excluded');

  // Ordinary ultimate surface does not apply routine Polarity (Verdict handles ultimates separately).
  strike(runtime, 'ult', [native('enemy-a', 10)], { sourceKind: 'ULTIMATE', actionSurface: 'ULTIMATE' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], undefined, 'ordinary ultimate surface excluded');

  // A legal committed weapon strike does apply Polarity, proving the exclusions above were real gates.
  strike(runtime, 'legal', [native('enemy-a', 10)]);
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'ARMAMENT');
}

// --- 6/7. Impact Vector target-specific math, mixed-channel preservation, per-target (not total) damage ---
// Note: `hp` on a HostileIntentSnapshot is Nine-Strain "shadow" HP for eligibility/derivative-packet
// bookkeeping only (see runtime.ts docs) — raw nativeByTarget damage is applied to the *live* squad by
// the Hub, never auto-mirrored here. Only Gravemark's own derivative packets mutate shadow hp, so a hp
// diff below isolates exactly the Impact Vector packet amount.
function hp(runtime: ReturnType<typeof rt>, unitId: string): number {
  return runtime.hostileIntents().find((row) => row.unitId === unitId)?.hp ?? 0;
}

{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-b', slot: 'FL_1' }], false);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 10), native('enemy-b', 10)], { lockedTargetIds: ['enemy-a', 'enemy-b'] });
  // Flip enemy-a's Polarity so the next weapon root actually Displaces it (forced cap consumption).
  runtime.resolveInstinct({ ...instinctInputForClass('AEGIS'), perfectParry: true, associatedHostileUnitId: 'enemy-a' });
  // Fresh combat cycle: cap resets for both units, Polarity (enemy-a=INSTINCT, enemy-b=ARMAMENT) persists.
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  const hpBeforeA = hp(runtime, 'enemy-a');
  const hpBeforeB = hp(runtime, 'enemy-b');
  // enemy-a is INSTINCT (differs -> will Displace), enemy-b is ARMAMENT (unchanged -> will not).
  // Spread strike deals different per-target damage (Carbine-style hits) with a mixed damage channel.
  strike(runtime, 'spread', [native('enemy-a', 20, { hits: 3 }), native('enemy-b', 4, { hits: 1 })], {
    lockedTargetIds: ['enemy-a', 'enemy-b'],
    targetPattern: 'SPREAD',
    damageChannels: ['KINETIC', 'OCCULT'],
  });
  // enemy-a Displaced -> Impact Vector packet = floor(0.25 * its OWN native damage 20) = 5, not the combined 24.
  assert.equal(hpBeforeA - hp(runtime, 'enemy-a'), Math.floor(20 * 0.25), 'Impact Vector reads the target-specific native damage, not the total');
  assert.equal(runtime.getState().gravemark.lastCollision?.amount, 5);
  // enemy-b Polarity unchanged -> no Displacement -> no packet at all, despite taking native damage.
  assert.equal(hpBeforeB - hp(runtime, 'enemy-b'), 0, 'no Displacement -> no Impact Vector packet for enemy-b');
}

{
  // Mixed Kinetic/Occult channel preservation: native ratio wins over damageChannels when present.
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }], false);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 10)]);
  runtime.resolveInstinct({ ...instinctInputForClass('AEGIS'), perfectParry: true, associatedHostileUnitId: 'enemy-a' });
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  // 75% kinetic / 25% occult native split on 20 total damage -> packet 5, split 3/2 (floor(5*0.75)=3).
  strike(runtime, 'mixed', [native('enemy-a', 20, { kineticNativeDamage: 15, occultNativeDamage: 5 })]);
  const collision = runtime.getState().gravemark.lastCollision;
  assert.equal(collision?.amount, 5);
  assert.equal(collision?.kinetic, 3);
  assert.equal(collision?.occult, 2);
  assert.equal((collision?.kinetic ?? 0) + (collision?.occult ?? 0), collision?.amount, 'channel split preserves the total packet amount');
}

// --- 8. No packet for zero target-specific native direct damage; at most one packet per target/root ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  runtime.grantFixture(GRAVEMARK_MANIFESTATION_ID);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }], false);
  runtime.runTurnStart();
  // Manufacture an Unmoored enemy-a from a prior root so Event Horizon can grant a bonus this root.
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  strike(runtime, 'seed', [native('enemy-a', 5)]);
  runtime.resolveInstinct({ ...instinctInputForClass('AEGIS'), perfectParry: true, associatedHostileUnitId: 'enemy-a' });
  assert.ok(runtime.getState().gravemark.unmooredExpiryByUnitId['enemy-a'] > runtime.getState().gravemark.playerTurnIndex);
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  const hpBefore = hp(runtime, 'enemy-a');
  // ARMAMENT unchanged from seed -> normal cap Displacement is skipped, but Event Horizon still
  // grants exactly one bonus Displacement (bypassing the cap) -> still only one Impact Vector packet.
  strike(runtime, 'root2', [native('enemy-a', 10)]);
  assert.equal(hpBefore - hp(runtime, 'enemy-a'), Math.floor(10 * 0.25), 'exactly one Impact Vector packet even with a bonus Displacement');
}

{
  // Zero target-specific native direct damage -> no packet, even if the target Displaced.
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }], false);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 10)]);
  runtime.resolveInstinct({ ...instinctInputForClass('AEGIS'), perfectParry: true, associatedHostileUnitId: 'enemy-a' });
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  const hpBefore = hp(runtime, 'enemy-a');
  // A status-only weapon root (0 native damage, but a status applied) is still directly affected and
  // still Displaces, but must not manufacture an Impact Vector packet out of zero damage.
  strike(runtime, 'statusOnly', [native('enemy-a', 0, { statusesApplied: 1 })]);
  assert.equal(hpBefore - hp(runtime, 'enemy-a'), 0, 'zero native damage produces no Impact Vector packet');
}

// --- 9. Folded Space: hostile + non-hostile fallback, consume-once refund, cap-blocked exclusion ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.FOLDED_SPACE);
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 5)], { actionSurface: 'TECHNIQUE' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'DISCIPLINE');
  // Flip Polarity via Instinct so the next Technique/Flex root actually causes a Displacement.
  runtime.resolveInstinct({ ...instinctInputForClass('AEGIS'), perfectParry: true, associatedHostileUnitId: 'enemy-a' });
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  strike(runtime, 'flex1', [native('enemy-a', 5)], { actionSurface: 'FLEX', actualCostsPaid: { ap: 2 }, lockedTargetIds: ['enemy-a'] });
  assert.equal(runtime.getState().gravemark.lastApRefund, 1, 'refund capped at 1 AP even though 2 were paid');

  // Consume-once: draining the refund clears it, and a second Technique/Flex root this same
  // player turn does not refund again even if it also Displaces.
  const drained = runtime.consumeGravemarkApRefund();
  assert.equal(drained, 1);
  assert.equal(runtime.consumeGravemarkApRefund(), 0, 'second drain in the same call is empty');
  strike(runtime, 'flex2', [native('enemy-a', 5)], { actionSurface: 'FLEX', actualCostsPaid: { ap: 1 } });
  assert.equal(runtime.getState().gravemark.lastApRefund, 0, 'only the first qualifying Technique/Flex root each player turn refunds');
}

{
  // Non-hostile Technique/Flex fallback: applies Discipline Polarity to the deterministic fallback hostile.
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.FOLDED_SPACE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  strike(runtime, 'nonhostile', [], {
    actionSurface: 'FLEX',
    lockedTargetIds: [],
    directlyAffectedTargetIds: [],
    nativeByTarget: [],
    totalNativeDirectDamage: 0,
  });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'DISCIPLINE', 'non-hostile Flex used the Gravemark fallback hostile');
}

{
  // A zero-AP action cannot manufacture a refund.
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.FOLDED_SPACE);
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 5)], { actionSurface: 'TECHNIQUE', actualCostsPaid: { ap: 0 } });
  runtime.resolveInstinct({ ...instinctInputForClass('AEGIS'), perfectParry: true, associatedHostileUnitId: 'enemy-a' });
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  strike(runtime, 'flex0', [native('enemy-a', 5)], { actionSurface: 'FLEX', actualCostsPaid: { ap: 0 } });
  assert.equal(runtime.getState().gravemark.lastApRefund, 0, 'zero-AP action cannot manufacture AP');
}

// --- 10. Reversal Field across all three classes and grades ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  // FAILED: no Polarity, guard not consumed.
  runtime.resolveInstinct({ classId: 'AEGIS', parryAttempted: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], undefined);
  assert.equal(runtime.getState().gravemark.reversalFieldUsedThisCombatCycle, false);
  // STANDARD (AEGIS voidWardPrevented): Polarity only, no Displacement.
  runtime.resolveInstinct({ classId: 'AEGIS', voidWardPrevented: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'INSTINCT');
  assert.equal(slot(runtime, 'enemy-a'), 'FL_0');
  assert.equal(runtime.getState().gravemark.reversalFieldUsedThisCombatCycle, true, 'first positive resolution consumes the combat-cycle guard');
}

{
  // CLEAN attempts Displacement only when Polarity actually changed.
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 5)]);
  runtime.resolveInstinct({ classId: 'AEGIS', wraithParrySuccess: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'INSTINCT');
  assert.equal(slot(runtime, 'enemy-a'), 'BL_0', 'CLEAN Displaced on an actual Polarity change');
}

{
  // PERFECT (Envoy) forces one normal Displacement regardless of prior Polarity (same INSTINCT again).
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'ENVOY', riftPreventedDamage: 10, riftWouldReachHp: 10, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'INSTINCT');
  assert.equal(slot(runtime, 'enemy-a'), 'BL_0', 'PERFECT forces a Displacement even on first Polarity application');
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  runtime.resolveInstinct({ classId: 'ENVOY', riftPreventedDamage: 10, riftWouldReachHp: 10, associatedHostileUnitId: 'enemy-a' });
  // Trigger owner always resolves the *corresponding opposite-lane* slot, so a second forced
  // Displacement from BL_0 swings it back to FL_0 rather than repeating BL_0.
  assert.equal(slot(runtime, 'enemy-a'), 'FL_0', 'PERFECT forces a Displacement even with unchanged Polarity');
  assert.equal(runtime.getState().gravemark.displacementCountByUnitId['enemy-a'], 1, 'fresh combat-cycle cap consumed once');
}

{
  // Envoy STANDARD grade (ratio 0.3).
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'ENVOY', riftPreventedDamage: 3, riftWouldReachHp: 10, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'INSTINCT');
  assert.equal(slot(runtime, 'enemy-a'), 'FL_0', 'STANDARD applies Polarity only');
}

{
  // Hex uses the deterministic jammed-safe fallback hostile.
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }], true);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'HEX_SHOT', reloadQuality: 'CLEAN' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'INSTINCT', 'Hex uses the jammed-safe fallback hostile');
}

{
  // Coalescing: one Instinct root cannot apply duplicate Instinct Polarity/movement.
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, associatedHostileUnitId: 'enemy-a' });
  const count = runtime.getState().gravemark.displacementCountByUnitId['enemy-a'] ?? 0;
  assert.equal(count, 1, 'a single Instinct root produced exactly one Displacement attempt');
}

// --- 11. Mass Transfer: ordinary/major coalescing, fallback, cap interaction, refill exclusion ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.MASS_TRANSFER);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  strike(runtime, 'root', [native('enemy-a', 5)], { lockedTargetIds: ['enemy-a'] });
  runtime.resolveCurrent({ ...ordinaryCurrentInput('AEGIS'), associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'CURRENT');
  assert.equal(slot(runtime, 'enemy-a'), 'FL_0', 'first Current application never Displaces (no prior Polarity)');
  // A second ordinary event this turn is a no-op (once-per-player-turn coalescing).
  runtime.resolveCurrent({ ...ordinaryCurrentInput('AEGIS'), associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.massTransferUsedThisPlayerTurn, true);
}

{
  // Major forces a Displacement regardless of prior Polarity; major wins over ordinary in one root.
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.MASS_TRANSFER);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 5)]);
  runtime.resolveCurrent({ ...ordinaryCurrentInput('AEGIS'), associatedHostileUnitId: 'enemy-a' });
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  runtime.resolveCurrent({ ...majorCurrentInput('AEGIS'), associatedHostileUnitId: 'enemy-a' });
  assert.equal(slot(runtime, 'enemy-a'), 'BL_0', 'major threshold forces a Displacement even with unchanged CURRENT Polarity');
}

{
  // No associated hostile and no locked target -> deterministic jammed-safe fallback.
  // (resolveCurrent needs a prior committed root to establish ctx, matching Faultline's convention.)
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.MASS_TRANSFER);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }], true);
  runtime.runTurnStart();
  strike(runtime, 'seed', [], { lockedTargetIds: [] });
  runtime.resolveCurrent(ordinaryCurrentInput('AEGIS'));
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'CURRENT');
}

{
  // Ultimate-owned magazine refill remains excluded from Mass Transfer.
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.MASS_TRANSFER);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  strike(runtime, 'ult-refill', [native('enemy-a', 4)], { sourceKind: 'ULTIMATE', actionSurface: 'ULTIMATE' });
  runtime.resolveCurrent({ classId: 'HEX_SHOT', ultimateOwnedRefill: true, reloadRestoredRounds: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], undefined, 'ultimate-owned refill excluded');
}

// --- Preview leaves live state unchanged ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  const before = runtime.getState().gravemark.polarityByUnitId['enemy-a'];
  const beforeSlot = slot(runtime, 'enemy-a');
  runtime.previewRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'preview',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
    lockedTargetIds: ['enemy-a'],
  }));
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], before, 'preview did not mutate live Polarity');
  assert.equal(slot(runtime, 'enemy-a'), beforeSlot, 'preview did not mutate the live grid');
}

console.log('Stage E.1 — Gravemark passed');
