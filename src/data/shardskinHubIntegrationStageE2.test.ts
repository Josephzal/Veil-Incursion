import assert from 'node:assert/strict';
import { SHARDSKIN_CORE_IDS } from '../types/shardskin';
import { createNineStrainCombatBridge } from './nineStrain/combatBridge';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';

console.log('Stage E.2 — Shardskin live Hub integration gate');

const live = getLiveUniversalBoonDefinitions();

function bridge() {
  const b = createNineStrainCombatBridge({ definitions: live });
  b.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  return b;
}

function seedShards(b: ReturnType<typeof bridge>, amount: number) {
  b.runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  b.runtime.setCombatDepth(2);
  const snap = b.serialize();
  b.hydrate({ ...snap, shardskin: { ...snap.shardskin, currentShards: amount } });
}

// --- The representative required proof, run against the live combat bridge exactly as the Hub
//     would call it: recordShardDefense (Shards) before recordHpLoss (HP/Wake). ---
{
  const b = bridge();
  // A live Soulwake Core is required for Wake to classify at all — grantFixture mirrors how the
  // Hub's real ownership state would already include it.
  b.runtime.grantFixture('SW_CORE_BORROWED_NERVE');
  seedShards(b, 4);
  b.syncHostileIntents([hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 })]);
  b.syncPlayerVitals({ hp: 20, maxHp: 20 });

  // 10 raw hostile damage; Barrier (-3) and Instinct prevention (-2) are simulated exactly as the
  // Hub's hurtPlayer already resolves them upstream of Shard prevention — Shards only ever see
  // the post-mitigation remainder, never the raw incoming amount.
  const incomingAfterMitigation = 10 - 3 - 2;
  const shardResult = b.runtime.recordShardDefense('proof:hit', incomingAfterMitigation);
  assert.equal(shardResult.shardsSpent, 4, '4 Shards spent');
  assert.equal(shardResult.hpDamage, 1, '1 residual HP damage — the required proof line');
  assert.equal(b.runtime.shardskinPresentation().currentShards, 0, 'Shards decrement exactly once, before HP mutation');

  const before = 20;
  const after = before - shardResult.hpDamage;
  const hpResult = b.recordHpLoss({
    lossEventId: 'proof:hp',
    rootActionId: null,
    actualHpRemoved: shardResult.hpDamage,
    currentHpBefore: before,
    currentHpAfter: after,
    maxHpBefore: 20,
    maxHpAfter: 20,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  assert.equal(hpResult.classified, true, '1 qualifying hostile Wake recorded');
  assert.equal(hpResult.applied, 1, 'Soulwake records only the residual HP loss, never the raw or Shard-prevented amount');
}

// --- Shards decrement exactly once; a duplicate recordShardDefense (rerender/duplicate bridge
//     call) replays the stored result and does not spend twice. ---
{
  const b = bridge();
  seedShards(b, 6);
  const first = b.runtime.recordShardDefense('dup', 4);
  const afterFirst = b.runtime.shardskinPresentation().currentShards;
  const second = b.runtime.recordShardDefense('dup', 4);
  assert.deepEqual(second, first);
  assert.equal(b.runtime.shardskinPresentation().currentShards, afterFirst, 'Shards decrement exactly once');
}

// --- Save/rerender does not replay prevention: serialize mid-combat, hydrate a fresh bridge from
//     that snapshot, and confirm the same eventId cannot spend Shards again on the resumed bridge. ---
{
  const b = bridge();
  seedShards(b, 6);
  const original = b.runtime.recordShardDefense('persisted-hit', 4);
  assert.equal(original.shardsSpent, 4);
  const saved = b.serialize();
  assert.equal(saved.shardskin.currentShards, 2, '6 - 4 spent = 2 remaining, persisted');
  const resumed = bridge();
  resumed.hydrate(JSON.parse(JSON.stringify(saved)));
  const replay = resumed.runtime.recordShardDefense('persisted-hit', 4);
  assert.deepEqual(replay, original, 'resumed state replays the exact stored result for this eventId');
  assert.equal(resumed.runtime.shardskinPresentation().currentShards, 2, 'Shards unchanged after resume — the replay did not spend a second time');
}

// --- Barrier and Instinct prevention occur before Shards: a fully-mitigated event (already 0)
//     never touches Shards at all. ---
{
  const b = bridge();
  seedShards(b, 6);
  const before = b.runtime.shardskinPresentation().currentShards;
  const result = b.runtime.recordShardDefense('fully-mitigated', 0);
  assert.equal(result.shardsSpent, 0);
  assert.equal(b.runtime.shardskinPresentation().currentShards, before, 'Barrier/Instinct already reduced this to zero — Shards never engage');
}

// --- Voluntary HP costs bypass Shards entirely: recordHpLoss with non-HOSTILE provenance and no
//     prior recordShardDefense call is a direct residual-HP path with Shards untouched. ---
{
  const b = bridge();
  b.runtime.grantFixture('SW_CORE_BORROWED_NERVE');
  seedShards(b, 6);
  const before = b.runtime.shardskinPresentation().currentShards;
  const result = b.recordHpLoss({
    lossEventId: 'voluntary:overdraw',
    rootActionId: null,
    actualHpRemoved: 5,
    currentHpBefore: 20,
    currentHpAfter: 15,
    maxHpBefore: 20,
    maxHpAfter: 20,
    provenance: 'OVERDRAW',
    overdrawKind: 'NORMAL',
  });
  assert.equal(b.runtime.shardskinPresentation().currentShards, before, 'voluntary HP costs never touch Shards');
  assert.ok(result.applied > 0 && result.classified, 'Overdraw still records its own Wake — Shards simply never see this event, and never reduce it');
}

// --- Edge/Shard state shown in the HUD matches runtime state exactly ---
{
  const b = bridge();
  seedShards(b, 7);
  const presentation = b.runtime.shardskinPresentation();
  const rawState = b.serialize().shardskin;
  assert.equal(presentation.currentShards, rawState.currentShards);
  assert.equal(presentation.currentEdge, rawState.currentEdge);
  assert.equal(presentation.pendingTemperedRemnantReturn, rawState.pendingTemperedRemnantReturn);
  assert.equal(presentation.cathedralBreakSelected, rawState.cathedralBreakSelected);
}

// --- Cathedral resources consume once; post-resolution gain applies once ---
{
  const b = bridge();
  b.runtime.grantFixture('SS_VERDICT_CATHEDRAL_BREAK');
  b.runtime.setCathedralBreakSelected(true);
  b.syncHostileIntents([hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 })]);
  b.runtime.setCombatDepth(1);
  b.runPlayerTurnStart();
  const snap = b.serialize();
  b.hydrate({ ...snap, shardskin: { ...snap.shardskin, currentShards: 4, currentEdge: 0 } });
  const begin1 = b.runtime.beginCathedralBreakUltimate('ult-1', ['enemy-a']);
  assert.equal(begin1.consumedShards, 4);
  // A duplicate begin call for the SAME rootActionId (e.g. a rerender) must not consume twice.
  const begin1Again = b.runtime.beginCathedralBreakUltimate('ult-1', ['enemy-a']);
  assert.equal(begin1Again.consumedShards, 4, 'idempotent replay for the same rootActionId');
  assert.equal(b.runtime.shardskinPresentation().currentShards, 0, 'Shards consumed exactly once');
  const finish1 = b.runtime.finishCathedralBreakUltimate('ult-1');
  assert.equal(finish1.gained, 10);
  const finish1Again = b.runtime.finishCathedralBreakUltimate('ult-1');
  assert.equal(finish1Again.gained, 0, 'a duplicate finish call for an already-finished root grants nothing further');
  assert.equal(b.runtime.shardskinPresentation().currentShards, 10, 'the +10 gain applied exactly once');
}

// --- Preview mutates only a clone: previewCathedralBreak never touches live Shard/Edge state ---
{
  const b = bridge();
  b.runtime.grantFixture('SS_VERDICT_CATHEDRAL_BREAK');
  seedShards(b, 5);
  const before = b.runtime.shardskinPresentation();
  const preview = b.runtime.previewCathedralBreak(['enemy-a']);
  assert.equal(preview.currentShards, 5);
  assert.equal(preview.budget, Math.floor(5 * 1.5));
  const after = b.runtime.shardskinPresentation();
  assert.deepEqual(after, before, 'previewCathedralBreak left live Shardskin state completely unchanged');
}

console.log('Stage E.2 — Shardskin live Hub integration gate passed');
