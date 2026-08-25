import assert from 'node:assert/strict';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions, definitionAcquisitionWave } from './nineStrain/definitionCatalog';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './nineStrain/contentConfiguration';
import {
  createDefaultNineStrainRuntimeState,
  createLiveNineStrainRuntimeState,
  hydrateNineStrainRuntimeState,
  cloneNineStrainRuntimeState,
} from './nineStrain/persistence';
import { unlockedStrainIds, firstOmenStrainIds, composeThreeCardOffer } from './nineStrain/acquisitionDirector';
import { createNineStrainRuntime } from './nineStrain/runtime';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { GRAVEMARK_CORE_IDS } from '../types/gravemark';
import { SHARDSKIN_CORE_IDS } from '../types/shardskin';

console.log('Stage E.2 — Nine-Strain sector/wave regression');

const live = getLiveUniversalBoonDefinitions();

// --- Stage E.3 cutover: content-wave ceiling now 4; Shardskin/Gravemark are live production content ---
assert.equal(NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE, 4, 'production wave ceiling cut over to 4 in Stage E.3');
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);

// --- Catalog counts: 27 / 50 / 77 / 108, all 15 Sector 4 Convergences now live ---
assert.equal(live.length, 108, 'live catalog');
assert.equal(live.filter((row) => row.role !== 'CONVERGENCE').length, 72, 'strain-family definitions');
assert.equal(live.filter((row) => row.role === 'CONVERGENCE').length, 36, 'convergence definitions');
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(getProductionOfferDefinitions(3).length, 77);
assert.equal(getProductionOfferDefinitions(4).length, 108, 'wave-4 production pool exposes all 108 definitions');
const wave4Fixture = live.filter((row) => definitionAcquisitionWave(row) <= 4);
assert.equal(wave4Fixture.length, 108, 'wave-4 fixture catalog exposes all 108 definitions');
assert.equal(live.filter((row) => row.strainId === 'SHARDSKIN').length, 8);
// Impact Lattice (Gravemark x Shardskin, Stage E.3) is the one Sector 4 Convergence whose
// primary strainId is GRAVEMARK, so the raw filter is 8 family definitions + 1 Convergence.
assert.equal(
  live.filter((row) => row.strainId === 'GRAVEMARK' && row.role !== 'CONVERGENCE').length,
  8,
  'Gravemark family definitions unaffected by Shardskin',
);
assert.equal(live.filter((row) => row.strainId === 'GRAVEMARK').length, 9, 'Gravemark primary-strainId count includes Impact Lattice');

// --- Fresh production runs now copy wave 4; old wave 1/2/3 saves stay fixed at their saved wave ---
{
  const state = createLiveNineStrainRuntimeState();
  assert.equal(state.maxAcquisitionWave, 4, 'fresh production run copies the current wave-4 ceiling');
}
{
  const state = createDefaultNineStrainRuntimeState();
  assert.equal(state.maxAcquisitionWave, 1, 'default (legacy) state stays wave 1');
  assert.deepEqual(state.shardskin.recentDamageEvents, [], 'default state carries an empty Shardskin state');
}

// --- SHARDSKIN/GRAVEMARK are excluded below wave 4, but included in the wave-4 unlock pool ---
for (const wave of [1, 2, 3] as const) {
  const pool = unlockedStrainIds(wave);
  assert.equal(pool.includes('SHARDSKIN' as never), false, `wave ${wave} unlock pool excludes Shardskin`);
  assert.equal(pool.includes('GRAVEMARK' as never), false, `wave ${wave} unlock pool excludes Gravemark`);
}
{
  const pool4 = unlockedStrainIds(4);
  assert.ok(pool4.includes('SHARDSKIN' as never), 'wave 4 unlock pool includes Shardskin');
  assert.ok(pool4.includes('GRAVEMARK' as never), 'wave 4 unlock pool includes Gravemark');
}
{
  const state = { ...createLiveNineStrainRuntimeState(), maxAcquisitionWave: 4 as const };
  const omenSeeds = Array.from({ length: 30 }, (_, i) => `omen-e2-${i}`);
  const seenShardskin = omenSeeds.some((seed) => firstOmenStrainIds(state, 1, undefined, seed).includes('SHARDSKIN' as never));
  const seenGravemark = omenSeeds.some((seed) => firstOmenStrainIds(state, 1, undefined, seed).includes('GRAVEMARK' as never));
  assert.ok(seenShardskin, 'First Omen can surface Shardskin at wave 4 across seeds');
  assert.ok(seenGravemark, 'First Omen can surface Gravemark at wave 4 across seeds');
}

// --- Schema 13 Gravemark and all Stage A-D state hydrate unchanged; missing Shardskin state hydrates empty ---
{
  const schema13Raw = {
    schemaVersion: 13,
    boonSystemMode: 'NINE_STRAIN',
    maxAcquisitionWave: 3,
    cores: { ARMAMENT: 'FL_CORE_STRESS_PATTERN', DISCIPLINE: null, INSTINCT: null, CURRENT: null },
    supports: ['FL_SUPPORT_HAIRLINE_CASCADE'],
    manifestations: [],
    convergences: [],
    boundVerdict: null,
    contactedStrains: [{ strainId: 'FAULTLINE', order: 0, exceptional: false }],
    gravemark: {
      polarityByUnitId: { 'enemy-a': 'ARMAMENT' },
      displacementCountByUnitId: { 'enemy-a': 1 },
      playerTurnIndex: 4,
    },
  };
  const hydrated = hydrateNineStrainRuntimeState(schema13Raw);
  assert.equal(hydrated.schemaVersion, 15, 'schema stamped current on hydrate');
  assert.equal(hydrated.maxAcquisitionWave, 3, 'never upgraded — stays exactly what was persisted');
  assert.equal(hydrated.cores.ARMAMENT, 'FL_CORE_STRESS_PATTERN', 'schema 13 core ownership survives unchanged');
  assert.deepEqual(hydrated.supports, ['FL_SUPPORT_HAIRLINE_CASCADE']);
  // Schema 13 Gravemark state survives unchanged.
  assert.equal(hydrated.gravemark.polarityByUnitId['enemy-a'], 'ARMAMENT');
  assert.equal(hydrated.gravemark.displacementCountByUnitId['enemy-a'], 1);
  assert.equal(hydrated.gravemark.playerTurnIndex, 4);
  // Missing Shardskin key hydrates to a fully-formed empty state, not a crash.
  assert.equal(hydrated.shardskin.currentShards, 0);
  assert.equal(hydrated.shardskin.currentEdge, 0);
  assert.equal(hydrated.shardskin.lastLog, null);
  assert.deepEqual(hydrated.shardskin.recentDamageEvents, []);
  assert.equal(hydrated.shardskin.pendingCathedralBreak, null);
}

// --- Current-state hydrate (including live Shardskin state) is idempotent ---
{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  const snap = runtime.getState();
  runtime.hydrate({ ...snap, shardskin: { ...snap.shardskin, currentShards: 5, currentEdge: 3, lastLog: 'CONVERSION // EDGE 3' } });
  const saved = runtime.serialize();
  const once = hydrateNineStrainRuntimeState(saved);
  const twice = hydrateNineStrainRuntimeState(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(once, twice, 'hydrating an already-current state (with live Shardskin resources) twice is a no-op');
  const cloned = cloneNineStrainRuntimeState(once);
  assert.deepEqual(once, cloned, 'clone (JSON round-trip + hydrate) is also idempotent');
  assert.equal(once.shardskin.currentShards, 5);
  assert.equal(once.shardskin.currentEdge, 3);
}

// --- Pending sealed offers survive a hydrate round-trip unchanged, even alongside live Shardskin state ---
{
  const pendingOffer = {
    kind: 'CONTACT' as const,
    sourceId: 'node:test',
    nodeId: 'node:test',
    depth: 2,
    strainId: 'FAULTLINE' as const,
    cardIds: ['FL_CORE_STRESS_PATTERN', 'FL_SUPPORT_HAIRLINE_CASCADE', 'FL_SUPPORT_RESIDUAL_STRESS'],
    seed: 'seed-abc',
    rngCursor: 3,
    replacementPreview: { FL_CORE_STRESS_PATTERN: 'Replaces nothing' },
    failClosedDiagnostic: null,
  };
  const raw = {
    schemaVersion: 14,
    boonSystemMode: 'NINE_STRAIN',
    maxAcquisitionWave: 3,
    shardskin: { currentShards: 6, currentEdge: 0 },
    acquisition: {
      firstOmenClaimed: true,
      firstOmenPending: false,
      combatVictories: 2,
      guaranteedContactClaimedByDepth: { 1: true },
      consumedRewardSourceIds: ['node:seed'],
      pendingOffer,
      acceptedSelectionCount: 4,
      lastFailClosedDiagnostic: null,
    },
  };
  const hydrated = hydrateNineStrainRuntimeState(raw);
  assert.deepEqual(hydrated.acquisition.pendingOffer, pendingOffer, 'pending sealed offer survives unchanged');
  assert.equal(hydrated.shardskin.currentShards, 6, 'live Shardskin resource state survives alongside the pending offer');
  const roundTripped = hydrateNineStrainRuntimeState(JSON.parse(JSON.stringify(hydrated)));
  assert.deepEqual(roundTripped.acquisition.pendingOffer, pendingOffer, 'still unchanged after a second hydrate cycle');
}

// --- Direct grants/tests require maxAcquisitionWave 4 or grantFixture ---
{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const withoutWave4 = runtime.commit(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE, {
    maxAcquisitionWave: 3,
    combatDepth: 2,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(withoutWave4.eligible, false);
  const withWave4 = runtime.commit(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE, {
    maxAcquisitionWave: 4,
    combatDepth: 2,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(withWave4.eligible, true);
}
{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  assert.ok(
    runtime.getState().contactedStrains.some((row) => row.strainId === 'SHARDSKIN'),
    'grantFixture bypasses wave gating for tests by directly contacting the strain',
  );
}

console.log('Stage E.2 — Nine-Strain sector/wave regression passed');
