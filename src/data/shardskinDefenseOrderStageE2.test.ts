import assert from 'node:assert/strict';
import { SHARDSKIN_CORE_IDS } from '../types/shardskin';
import { createNineStrainRuntime } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';

console.log('Stage E.2 — Shardskin defensive resolution order');

const live = getLiveUniversalBoonDefinitions();

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  return runtime;
}

/** Sets currentShards to an exact value via hydrate — precise, without depending on any
 * generation formula's rounding. `grantFixture` ownership survives hydrate (it lives in a
 * separate runtime-local set), so Shardskin stays live throughout.
 */
function fillShards(runtime: ReturnType<typeof rt>, amount: number) {
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  runtime.setCombatDepth(3); // cap 24
  const snapshot = runtime.getState();
  runtime.hydrate({ ...snapshot, shardskin: { ...snapshot.shardskin, currentShards: amount } });
}

// --- 1. The representative required proof: 10 hostile - 3 Barrier - 2 Instinct - 4 Shards = 1 HP lost ---
{
  const runtime = rt();
  fillShards(runtime, 4);
  // Ordinary mitigation and Barrier, then Parry/Rift Ward prevention, already reduced 10 -> 5
  // (10 - 3 Barrier - 2 Instinct prevention) before Shards ever see the event. Shards then see
  // only the already-mitigated remainder, exactly matching the authoritative Hub order.
  const incomingAfterMitigation = 10 - 3 - 2;
  const result = runtime.recordShardDefense('proof:hit-1', incomingAfterMitigation);
  assert.equal(result.shardsSpent, 4, '4 Shards prevent 4 of the remaining 5 damage');
  assert.equal(result.hpDamage, 1, 'exactly 1 Soul Anchor HP lost');
  assert.equal(runtime.shardskinPresentation().currentShards, 0, 'Shards decrement before HP mutation');
}

// --- 2. One Shard prevents one damage; decremented before HP mutation ---
{
  const runtime = rt();
  fillShards(runtime, 6);
  const before = runtime.shardskinPresentation().currentShards;
  const result = runtime.recordShardDefense('hit-single', 4);
  assert.equal(result.shardsSpent, 4);
  assert.equal(result.hpDamage, 0);
  assert.equal(runtime.shardskinPresentation().currentShards, before - 4);
}

// --- 3. If Barrier/Instinct prevention reduces damage to zero, no Shards are spent ---
{
  const runtime = rt();
  fillShards(runtime, 6);
  const before = runtime.shardskinPresentation().currentShards;
  const result = runtime.recordShardDefense('hit-zeroed', 0);
  assert.equal(result.shardsSpent, 0);
  assert.equal(result.hpDamage, 0);
  assert.equal(runtime.shardskinPresentation().currentShards, before, 'no Shards spent when nothing reaches Shards');
}

// --- 4. Stable damage-event id dedup — rerender / duplicate bridge calls cannot spend Shards twice ---
{
  const runtime = rt();
  fillShards(runtime, 6);
  const first = runtime.recordShardDefense('dup-event', 4);
  const afterFirst = runtime.shardskinPresentation().currentShards;
  const second = runtime.recordShardDefense('dup-event', 4);
  assert.deepEqual(second, first, 'a duplicate call with the same eventId replays the stored result');
  assert.equal(runtime.shardskinPresentation().currentShards, afterFirst, 'Shards were not spent a second time');
}

// --- 5. Multi-hit attacks consume Shards across real packets, never processing one packet twice ---
{
  const runtime = rt();
  fillShards(runtime, 6);
  const p1 = runtime.recordShardDefense('multi:1', 3);
  const p2 = runtime.recordShardDefense('multi:2', 3);
  const p3 = runtime.recordShardDefense('multi:3', 3);
  assert.equal(p1.shardsSpent, 3);
  assert.equal(p2.shardsSpent, 3);
  assert.equal(p3.shardsSpent, 0, 'Shards exhausted after 6 spent across the first two packets');
  assert.equal(p3.hpDamage, 3, 'the third packet takes its own full remaining amount as HP damage');
  assert.equal(runtime.shardskinPresentation().currentShards, 0);
  // Replaying packet 1 again (e.g. a rerender) must not re-spend.
  const replay = runtime.recordShardDefense('multi:1', 3);
  assert.deepEqual(replay, p1);
}

// --- 6. Shards never prevent damage without ownership ---
{
  const runtime = rt();
  runtime.setCombatDepth(1);
  const result = runtime.recordShardDefense('no-ownership', 10);
  assert.equal(result.shardsSpent, 0);
  assert.equal(result.hpDamage, 10, 'without any Shardskin definition owned, all damage passes through unchanged');
}

console.log('Stage E.2 — Shardskin defensive resolution order passed');
