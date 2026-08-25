import assert from 'node:assert/strict';
import {
  SHARDSKIN_CORE_IDS,
  SHARDSKIN_MANIFESTATION_ID,
  SHARDSKIN_SUPPORT_IDS,
  SHARDSKIN_VERDICT_ID,
} from '../types/shardskin';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import {
  createNineStrainRuntime,
  instinctInputForClass,
  ordinaryCurrentInput,
  majorCurrentInput,
  weaponFamilyExecutionContext,
} from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import type { TargetNativeResult } from '../types/nineStrain';
import type { CombatGridSlotId } from '../types/combatGrid';

console.log('Stage E.2 — Shardskin');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 108);
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(getProductionOfferDefinitions(3).length, 77);
assert.equal(live.filter((row) => row.strainId === 'SHARDSKIN').length, 8);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);
for (const row of live) {
  if (row.strainId === 'SHARDSKIN') {
    assert.equal(row.acquisitionWave, 4, `${row.id} must be acquisitionWave 4`);
    assert.ok(row.id.startsWith('SS_'), `${row.id} must use the SS_ prefix`);
  }
}

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
  rows: ReadonlyArray<{ id: string; slot: CombatGridSlotId; hp?: number; invulnerable?: boolean; protectedPhase?: boolean; authoredCounter?: boolean }>,
) {
  runtime.syncHostileIntents(rows.map((row, index) => hostileSnapshotInput({
    unitId: row.id,
    intentKind: 'STRIKE',
    hostileTurnOrder: index,
    slot: row.slot,
    designation: row.id,
    hp: row.hp ?? 80,
    maxHp: row.hp ?? 80,
    invulnerable: row.invulnerable,
    protectedPhase: row.protectedPhase,
    authoredCounter: row.authoredCounter,
  })));
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

function hp(runtime: ReturnType<typeof rt>, unitId: string): number {
  return runtime.hostileIntents().find((row) => row.unitId === unitId)?.hp ?? 0;
}

// --- 1. Depth cap centralization ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  for (const [depth, cap] of [[1, 12], [2, 18], [3, 24]] as const) {
    runtime.setCombatDepth(depth);
    runtime.runTurnStart();
    strike(runtime, `seed-${depth}`, [native('enemy-a', 500)]);
    assert.equal(runtime.shardskinPresentation().shardCap, cap, `depth ${depth} shard cap`);
    assert.equal(runtime.shardskinPresentation().edgeCap, cap, `depth ${depth} edge cap`);
    assert.ok(runtime.shardskinPresentation().currentShards <= cap, `depth ${depth} shards never exceed cap`);
    runtime.endPlayerTurn();
  }
}

// --- 2. Player-turn conversion: remaining Shards -> Edge, capped, cleared to zero ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 20)]); // Crystal Edge -> min(8, floor(20*0.2)) = 4 Shards
  assert.equal(runtime.shardskinPresentation().currentShards, 4);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  assert.equal(runtime.shardskinPresentation().currentEdge, 4, 'remaining Shards converted 1:1 into Edge');
  assert.equal(runtime.shardskinPresentation().currentShards, 0, 'Shards cleared to zero on conversion');
}

// --- 3. Edge expires unused at PLAYER_TURN_ENDED (voluntary or forced) ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 20)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  assert.equal(runtime.shardskinPresentation().currentEdge, 4);
  runtime.endPlayerTurn();
  assert.equal(runtime.shardskinPresentation().currentEdge, 0, 'unused Edge expires at PLAYER_TURN_ENDED');
}

// --- 4. Tempered Remnant: aggregate consumed-preventing-damage math, folded into next conversion ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  runtime.grantFixture(SHARDSKIN_SUPPORT_IDS.TEMPERED_REMNANT);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 40)]); // Crystal Edge -> min(8, floor(40*0.2)=8) = 8 Shards
  assert.equal(runtime.shardskinPresentation().currentShards, 8);
  // Spend 5 Shards preventing damage across two distinct hits (never round per hit; aggregate then floor).
  const r1 = runtime.recordShardDefense('hit-1', 3);
  assert.equal(r1.shardsSpent, 3);
  assert.equal(r1.hpDamage, 0);
  const r2 = runtime.recordShardDefense('hit-2', 2);
  assert.equal(r2.shardsSpent, 2);
  assert.equal(r2.hpDamage, 0);
  assert.equal(runtime.shardskinPresentation().currentShards, 3, '8 - 5 consumed = 3 remaining');
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  // remnantReturn = min(8, floor(5*0.5)) = 2; Edge = min(cap, remaining(3) + remnant(2)) = 5.
  assert.equal(runtime.shardskinPresentation().currentEdge, 5, 'Tempered Remnant folds into the normal conversion');
  // Ledger clears after conversion — a second turn with no further prevention returns 0.
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  assert.equal(runtime.shardskinPresentation().pendingTemperedRemnantReturn, 0, 'consumed ledger clears after conversion');
}

// --- 5. Edge consumption: first qualifying root consumes all Edge, dealing derivative Occult to primary ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-b', slot: 'FL_1' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 20)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  assert.equal(runtime.shardskinPresentation().currentEdge, 4);
  const hpBefore = hp(runtime, 'enemy-a');
  strike(runtime, 'consume', [native('enemy-a', 3)]);
  assert.equal(runtime.shardskinPresentation().currentEdge, 0, 'Edge fully consumed by the first qualifying root');
  assert.equal(hpBefore - hp(runtime, 'enemy-a'), 4, 'derivative Occult packet equals the consumed Edge');
  // A second qualifying root the same turn does nothing further (Edge already at 0).
  const hpBefore2 = hp(runtime, 'enemy-a');
  strike(runtime, 'second', [native('enemy-a', 3)]);
  assert.equal(hpBefore2 - hp(runtime, 'enemy-a'), 0, 'no Edge left for a second root this turn');
}

// --- 6. Canceled/invalid/unpaid/miss-only/zero-native-damage roots never consume Edge ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 20)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  assert.equal(runtime.shardskinPresentation().currentEdge, 4);
  strike(runtime, 'cancel', [native('enemy-a', 10)], { committed: false });
  assert.equal(runtime.shardskinPresentation().currentEdge, 4, 'uncommitted root does not consume Edge');
  strike(runtime, 'miss', [native('enemy-a', 0)]);
  assert.equal(runtime.shardskinPresentation().currentEdge, 4, 'miss-only root does not consume Edge');
  strike(runtime, 'derivative', [native('enemy-a', 10)], { classification: 'DERIVATIVE' });
  assert.equal(runtime.shardskinPresentation().currentEdge, 4, 'derivative classification does not consume Edge');
  // A legal committed native-direct root does consume it, proving the exclusions above were real gates.
  strike(runtime, 'legal', [native('enemy-a', 5)]);
  assert.equal(runtime.shardskinPresentation().currentEdge, 0);
}

// --- 7. Edge fizzles without refund when the locked primary is illegal at delivery ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-b', slot: 'FL_1', invulnerable: true }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 20)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  assert.equal(runtime.shardskinPresentation().currentEdge, 4);
  const hpBefore = hp(runtime, 'enemy-b');
  strike(runtime, 'onto-invuln', [native('enemy-b', 5)], { lockedTargetIds: ['enemy-b'] });
  assert.equal(runtime.shardskinPresentation().currentEdge, 0, 'Edge is still consumed even though the packet fizzles');
  assert.equal(hpBefore - hp(runtime, 'enemy-b'), 0, 'invulnerable primary — packet fizzles, no retarget');
  assert.equal(runtime.getState().shardskin.lastEdgeConsumption?.fizzled, true);
}

// --- 8. Crystal Edge: aggregate-once math, per-root cap, miss/setup-only exclusion, guard consumed even at zero gain ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-b', slot: 'FL_1' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  // Carbine-style spread: multiple targets in one root — one total generation, not per target.
  strike(runtime, 'spread', [native('enemy-a', 20), native('enemy-b', 20)], {
    lockedTargetIds: ['enemy-a', 'enemy-b'],
    targetPattern: 'SPREAD',
  });
  // Per-root cap (8) applies before the global depth cap: floor(40*0.2)=8, capped at 8.
  assert.equal(runtime.shardskinPresentation().currentShards, 8, 'one aggregate generation, capped at 8 per root');

  // Miss-only / setup-only root does not consume the once-per-turn guard.
  const runtime2 = rt();
  runtime2.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  hostiles(runtime2, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime2.setCombatDepth(1);
  runtime2.runTurnStart();
  strike(runtime2, 'setup', [native('enemy-a', 0)]);
  strike(runtime2, 'real', [native('enemy-a', 10)]);
  assert.equal(runtime2.shardskinPresentation().currentShards, 2, 'setup-only root did not waste the guard; the real hit still generated');

  // Guard consumed even when the global cap makes actual gain zero.
  const runtime3 = rt();
  runtime3.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  hostiles(runtime3, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime3.setCombatDepth(1);
  runtime3.runTurnStart();
  strike(runtime3, 'first', [native('enemy-a', 500)]); // fills to 8 (per-root cap) though global cap is 12
  strike(runtime3, 'topoff', [native('enemy-a', 500)]);
  const before3 = runtime3.shardskinPresentation().currentShards;
  strike(runtime3, 'second-turn-same-guard', [native('enemy-a', 500)]);
  assert.equal(runtime3.shardskinPresentation().currentShards, before3, 'guard already consumed this player turn — no further generation');
}

// --- 9. Ritual Pane: actual-paid-AP math, zero-AP legal action still generates the base amount ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.RITUAL_PANE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  strike(runtime, 'technique', [native('enemy-a', 0)], { actionSurface: 'TECHNIQUE', actualCostsPaid: { ap: 2 } });
  assert.equal(runtime.shardskinPresentation().currentShards, 7, '3 + 2*2 = 7, need not deal damage');

  const runtime2 = rt();
  runtime2.grantFixture(SHARDSKIN_CORE_IDS.RITUAL_PANE);
  hostiles(runtime2, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime2.setCombatDepth(1);
  runtime2.runTurnStart();
  strike(runtime2, 'flex0', [], { actionSurface: 'FLEX', actualCostsPaid: { ap: 0 }, lockedTargetIds: [], nativeByTarget: [], totalNativeDirectDamage: 0 });
  assert.equal(runtime2.shardskinPresentation().currentShards, 3, 'legal zero-AP committed ability generates the base 3');

  const runtime3 = rt();
  runtime3.grantFixture(SHARDSKIN_CORE_IDS.RITUAL_PANE);
  hostiles(runtime3, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime3.setCombatDepth(1);
  runtime3.runTurnStart();
  strike(runtime3, 'flex-big', [], { actionSurface: 'FLEX', actualCostsPaid: { ap: 10 }, lockedTargetIds: [], nativeByTarget: [], totalNativeDirectDamage: 0 });
  assert.equal(runtime3.shardskinPresentation().currentShards, 9, 'per-root cap of 9 applies before the global depth cap');

  const runtime4 = rt();
  runtime4.grantFixture(SHARDSKIN_CORE_IDS.RITUAL_PANE);
  hostiles(runtime4, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime4.setCombatDepth(1);
  runtime4.runTurnStart();
  strike(runtime4, 'cancel', [], { actionSurface: 'TECHNIQUE', committed: false, actualCostsPaid: { ap: 2 } });
  assert.equal(runtime4.shardskinPresentation().currentShards, 0, 'canceled/invalid/unpaid attempts generate nothing and do not consume the guard');
  strike(runtime4, 'real', [native('enemy-a', 0)], { actionSurface: 'TECHNIQUE', actualCostsPaid: { ap: 1 } });
  assert.equal(runtime4.shardskinPresentation().currentShards, 5, '3 + 2*1 = 5, guard was untouched by the canceled attempt');
}

// --- 10. Perfect Facet: grades, Failed excluded, once per combat cycle, Quiet Reflex coexistence ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.PERFECT_FACET);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  // FAILED does not consume the guard.
  runtime.resolveInstinct({ classId: 'AEGIS', parryAttempted: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.shardskinPresentation().currentShards, 0);
  // STANDARD.
  runtime.resolveInstinct({ classId: 'AEGIS', voidWardPrevented: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.shardskinPresentation().currentShards, 4, 'STANDARD -> 4');
  // A further positive resolution the same combat cycle grants nothing more.
  runtime.resolveInstinct({ classId: 'AEGIS', wraithParrySuccess: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.shardskinPresentation().currentShards, 4, 'guard already spent this combat cycle');
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  runtime.resolveInstinct({ classId: 'AEGIS', wraithParrySuccess: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.shardskinPresentation().currentShards, 11, 'CLEAN -> +7 on a fresh combat cycle');
  runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
  runtime.resolveInstinct({ classId: 'ENVOY', riftPreventedDamage: 10, riftWouldReachHp: 10, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.shardskinPresentation().currentShards, 12, 'PERFECT -> +10 but the global cap (12) truncates the actual gain');
}

// --- 11. Pressure Crystal: ordinary/major coalescing, major wins ties, refill/preserved exclusions ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.PRESSURE_CRYSTAL);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  strike(runtime, 'seed', [], { lockedTargetIds: [] });
  runtime.resolveCurrent({ ...ordinaryCurrentInput('AEGIS') });
  assert.equal(runtime.shardskinPresentation().currentShards, 4, 'ordinary Current event -> 4');
  runtime.resolveCurrent({ ...ordinaryCurrentInput('AEGIS') });
  assert.equal(runtime.shardskinPresentation().currentShards, 4, 'once per player turn — second ordinary event is a no-op');

  const runtime2 = rt();
  runtime2.grantFixture(SHARDSKIN_CORE_IDS.PRESSURE_CRYSTAL);
  hostiles(runtime2, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime2.setCombatDepth(1);
  runtime2.runTurnStart();
  strike(runtime2, 'seed', [], { lockedTargetIds: [] });
  runtime2.resolveCurrent({ ...majorCurrentInput('AEGIS') });
  assert.equal(runtime2.shardskinPresentation().currentShards, 8, 'major threshold/completed cycle -> 8');

  const runtime3 = rt();
  runtime3.grantFixture(SHARDSKIN_CORE_IDS.PRESSURE_CRYSTAL);
  hostiles(runtime3, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime3.setCombatDepth(1);
  runtime3.runTurnStart();
  strike(runtime3, 'ult-refill', [native('enemy-a', 4)], { sourceKind: 'ULTIMATE', actionSurface: 'ULTIMATE' });
  runtime3.resolveCurrent({ classId: 'HEX_SHOT', ultimateOwnedRefill: true, reloadRestoredRounds: true });
  assert.equal(runtime3.shardskinPresentation().currentShards, 0, 'ultimate-owned refill excluded');
}

// --- 12. Scatterglass: full Edge to primary, floor(consumed*0.5) to each other distinct hit target, once each ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  runtime.grantFixture(SHARDSKIN_SUPPORT_IDS.SCATTERGLASS);
  hostiles(runtime, [
    { id: 'enemy-a', slot: 'FL_0' },
    { id: 'enemy-b', slot: 'FL_1' },
    { id: 'enemy-c', slot: 'BL_0' },
  ]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 20)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  assert.equal(runtime.shardskinPresentation().currentEdge, 4);
  const beforeA = hp(runtime, 'enemy-a');
  const beforeB = hp(runtime, 'enemy-b');
  const beforeC = hp(runtime, 'enemy-c');
  // Multi-target native root: a hits b, c is only a selection target with zero native damage.
  strike(runtime, 'spread', [native('enemy-a', 3), native('enemy-b', 3), native('enemy-c', 0)], {
    lockedTargetIds: ['enemy-a', 'enemy-b', 'enemy-c'],
    targetPattern: 'SPREAD',
  });
  assert.equal(beforeA - hp(runtime, 'enemy-a'), 4, 'primary receives the full consumed Edge');
  assert.equal(beforeB - hp(runtime, 'enemy-b'), Math.floor(4 * 0.5), 'secondary that actually took native damage receives floor(consumed*0.5)');
  assert.equal(beforeC - hp(runtime, 'enemy-c'), 0, 'selection-only target with zero native damage receives nothing');
}

// --- 13. Endless Facet: reform on ordinary Edge consumption, once per turn, subject to the global cap ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  runtime.grantFixture(SHARDSKIN_MANIFESTATION_ID);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }, { id: 'enemy-b', slot: 'FL_1' }]);
  runtime.setCombatDepth(2);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 40)]); // 8 Shards
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  assert.equal(runtime.shardskinPresentation().currentEdge, 8);
  strike(runtime, 'consume', [native('enemy-a', 2)]);
  assert.equal(runtime.shardskinPresentation().currentEdge, 0);
  assert.equal(runtime.shardskinPresentation().currentShards, Math.floor(8 * 0.5), 'floor(consumed Edge * 0.5) reforms as Shards');
  // Once per player turn: a second Edge-driven event (none available here) cannot reform again;
  // verify the guard directly.
  assert.equal(runtime.getState().shardskin.endlessFacetUsedThisPlayerTurn, true);
}

// --- 14. Preview mutates only a clone ---
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  const before = runtime.shardskinPresentation().currentShards;
  runtime.previewRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'preview',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 40)],
    lockedTargetIds: ['enemy-a'],
  }));
  assert.equal(runtime.shardskinPresentation().currentShards, before, 'preview did not mutate live Shard state');
}

console.log('Stage E.2 — Shardskin passed');
