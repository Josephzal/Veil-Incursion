import assert from 'node:assert/strict';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './nineStrain/contentConfiguration';
import {
  createDefaultNineStrainRuntimeState,
  createLiveNineStrainRuntimeState,
  hydrateNineStrainRuntimeState,
  cloneNineStrainRuntimeState,
} from './nineStrain/persistence';
import {
  unlockedStrainIds,
  firstOmenStrainIds,
  composeThreeCardOffer,
} from './nineStrain/acquisitionDirector';
import { createNineStrainRuntime } from './nineStrain/runtime';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { GRAVEMARK_CORE_IDS } from '../types/gravemark';

console.log('Stage E.1 — Nine-Strain sector/wave regression');

const live = getLiveUniversalBoonDefinitions();

// --- Stage E.3 cutover: content-wave ceiling now 4; Gravemark is live production content ---
assert.equal(NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE, 4, 'production wave ceiling cut over to 4 in Stage E.3');
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);

// --- Catalog counts ---
assert.equal(live.length, 108, 'live catalog');
assert.equal(live.filter((row) => row.role !== 'CONVERGENCE' && row.strainId !== 'SHARDSKIN').length, 64, 'family definitions');
assert.equal(live.filter((row) => row.role === 'CONVERGENCE').length, 36, 'convergence definitions');
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(getProductionOfferDefinitions(3).length, 77);
assert.equal(getProductionOfferDefinitions(4).length, 108, 'wave-4 production pool exposes all 108 definitions');
assert.equal(live.filter((row) => row.strainId === 'SHARDSKIN').length, 8, 'eight wave-4 Shardskin definitions');

// --- Fresh production runs now copy wave 4 ---
{
  const state = createLiveNineStrainRuntimeState();
  assert.equal(state.maxAcquisitionWave, 4, 'fresh production run copies the current wave-4 ceiling');
}
{
  const state = createDefaultNineStrainRuntimeState();
  assert.equal(state.maxAcquisitionWave, 1, 'default (legacy) state stays wave 1');
}

// --- GRAVEMARK is excluded below wave 4, but reachable in the wave-4 unlock pool / First Omen ---
for (const wave of [1, 2, 3] as const) {
  const pool = unlockedStrainIds(wave);
  assert.equal(pool.includes('GRAVEMARK' as never), false, `wave ${wave} unlock pool excludes Gravemark`);
}
{
  const pool4 = unlockedStrainIds(4);
  assert.ok(pool4.includes('GRAVEMARK' as never), 'wave 4 unlock pool includes Gravemark');
}
{
  const state = { ...createLiveNineStrainRuntimeState(), maxAcquisitionWave: 4 as const };
  const omenSeeds = Array.from({ length: 30 }, (_, i) => `omen-e1-${i}`);
  const seenGravemark = omenSeeds.some((seed) => firstOmenStrainIds(state, 1, undefined, seed).includes('GRAVEMARK' as never));
  assert.ok(seenGravemark, 'First Omen can surface Gravemark at wave 4 across seeds');
  const composed = composeThreeCardOffer(state, 'GRAVEMARK', 'seed-e1', { boss: false, depth: 1, firstOffer: true });
  assert.equal(composed.strainId, 'GRAVEMARK', 'contact offer can identify Gravemark at wave 4');
  assert.ok((composed.cardIds ?? []).some((id) => id.startsWith('GM_')), 'Gravemark contact offer cards use GM_ ids');
}

// --- Schema 12 hydration: unchanged core fields; maxAcquisitionWave never upgraded ---
{
  const schema12Raw = {
    schemaVersion: 12,
    boonSystemMode: 'NINE_STRAIN',
    maxAcquisitionWave: 2,
    cores: { ARMAMENT: 'FL_CORE_STRESS_PATTERN', DISCIPLINE: null, INSTINCT: null, CURRENT: null },
    supports: ['FL_SUPPORT_HAIRLINE_CASCADE'],
    manifestations: [],
    convergences: [],
    boundVerdict: null,
    contactedStrains: [{ strainId: 'FAULTLINE', order: 0, exceptional: false }],
  };
  const hydrated = hydrateNineStrainRuntimeState(schema12Raw);
  assert.equal(hydrated.schemaVersion, 15, 'schema stamped current on hydrate');
  assert.equal(hydrated.maxAcquisitionWave, 2, 'never upgraded — stays exactly what was persisted');
  assert.equal(hydrated.cores.ARMAMENT, 'FL_CORE_STRESS_PATTERN', 'schema 12 core ownership survives unchanged');
  assert.deepEqual(hydrated.supports, ['FL_SUPPORT_HAIRLINE_CASCADE']);
  assert.equal(hydrated.contactedStrains.length, 1);
  assert.equal(hydrated.contactedStrains[0].strainId, 'FAULTLINE');
  // Missing Gravemark key hydrates to a fully-formed empty state, not a crash.
  assert.deepEqual(hydrated.gravemark.polarityByUnitId, {});
  assert.equal(hydrated.gravemark.lastLog, null);
  assert.equal(hydrated.gravemark.combatCycleIndex, 0);
}

// --- Never upgrade a persisted run's maxAcquisitionWave, even across repeated hydrate cycles ---
for (const wave of [1, 2, 3] as const) {
  const raw = { schemaVersion: 13, boonSystemMode: 'NINE_STRAIN', maxAcquisitionWave: wave };
  const once = hydrateNineStrainRuntimeState(raw);
  const twice = hydrateNineStrainRuntimeState(JSON.parse(JSON.stringify(once)));
  assert.equal(once.maxAcquisitionWave, wave);
  assert.equal(twice.maxAcquisitionWave, wave, `wave ${wave} persists unchanged across repeated hydrate cycles`);
}
// A wave-4 fixture/test run is the only path that can carry maxAcquisitionWave 4, and it survives hydrate unchanged too.
{
  const raw = { schemaVersion: 13, boonSystemMode: 'NINE_STRAIN', maxAcquisitionWave: 4 };
  const hydrated = hydrateNineStrainRuntimeState(raw);
  assert.equal(hydrated.maxAcquisitionWave, 4, 'an already-persisted wave-4 fixture run is carried, never invented');
}

// --- Hydrating current (schema 13) state twice is a no-op ---
{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  const saved = runtime.serialize();
  const once = hydrateNineStrainRuntimeState(saved);
  const twice = hydrateNineStrainRuntimeState(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(once, twice, 'hydrating an already-current state twice is a no-op');
  const cloned = cloneNineStrainRuntimeState(once);
  assert.deepEqual(once, cloned, 'clone (JSON round-trip + hydrate) is also idempotent');
}

// --- Pending sealed offers survive a hydrate round-trip unchanged ---
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
    schemaVersion: 13,
    boonSystemMode: 'NINE_STRAIN',
    maxAcquisitionWave: 3,
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
  const roundTripped = hydrateNineStrainRuntimeState(JSON.parse(JSON.stringify(hydrated)));
  assert.deepEqual(roundTripped.acquisition.pendingOffer, pendingOffer, 'still unchanged after a second hydrate cycle');
}

// --- Direct grants/tests require maxAcquisitionWave 4 or grantFixture ---
{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const withoutWave4 = runtime.commit(GRAVEMARK_CORE_IDS.IMPACT_VECTOR, {
    maxAcquisitionWave: 3,
    combatDepth: 2,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(withoutWave4.eligible, false);
  const withWave4 = runtime.commit(GRAVEMARK_CORE_IDS.IMPACT_VECTOR, {
    maxAcquisitionWave: 4,
    combatDepth: 2,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(withWave4.eligible, true);
}
{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  assert.ok(
    runtime.getState().contactedStrains.some((row) => row.strainId === 'GRAVEMARK'),
    'grantFixture bypasses wave gating for tests by directly contacting the strain',
  );
}

console.log('Stage E.1 — Nine-Strain sector/wave regression passed');
