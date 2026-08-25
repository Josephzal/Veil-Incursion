import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GRAVEMARK_CORE_IDS,
  GRAVEMARK_MANIFESTATION_ID,
  GRAVEMARK_SUPPORT_IDS,
  GRAVEMARK_VERDICT_ID,
} from '../types/gravemark';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, instinctInputForClass, ordinaryCurrentInput, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { canFireWeaponUltimate } from './weaponUltimateRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';
import type { TargetNativeResult } from '../types/nineStrain';

console.log('Stage E.1 — Gravemark compatibility');

const live = getLiveUniversalBoonDefinitions();

// --- No 'GM_' identifiers leak outside Gravemark-owned files ---
const src = join(process.cwd(), 'src/data/nineStrain');
for (const name of readdirSync(src)) {
  if (!name.endsWith('.ts')) continue;
  if (name.toLowerCase().includes('gravemark') || name.includes('Definition')) continue;
  const text = readFileSync(join(src, name), 'utf8');
  assert.equal(text.includes("if (def.id === 'GM_"), false, name);
  assert.equal(text.includes("case 'GM_"), false, name);
}

// --- Catalog counts (post Stage E.3 standard-catalog closeout) ---
assert.equal(live.length, 108, 'live catalog');
assert.equal(
  live.filter((row) => row.strainId === 'GRAVEMARK' && row.role !== 'CONVERGENCE').length,
  8,
  'Gravemark family definition count',
);
// Impact Lattice (Gravemark x Shardskin) is the only Sector 4 Convergence whose *primary*
// strainId is GRAVEMARK, so the raw strainId filter now includes it (8 family + 1 Convergence).
assert.equal(live.filter((row) => row.strainId === 'GRAVEMARK').length, 9, 'Gravemark primary-strainId count including Impact Lattice');
assert.equal(getProductionOfferDefinitions(1).length, 27, 'wave 1 production pool');
assert.equal(getProductionOfferDefinitions(2).length, 50, 'wave 2 production pool');
assert.equal(getProductionOfferDefinitions(3).length, 77, 'wave 3 production pool');
assert.equal(live.filter((row) => row.id.startsWith('SS_') || row.strainId === 'SHARDSKIN').length, 8, 'eight wave-4 Shardskin definitions');
// Stage E.3 closes the standard catalog with exactly 7 Gravemark-paired Sector 4 Convergences
// (Fate Out of Place, Turning Rite, Parallax Echo, Stored Vector, Tethered Orbit, Tectonic Shift,
// Trauma Vector) plus Impact Lattice shared with Shardskin — 8 Gravemark-touching Convergences total.
assert.equal(
  live.filter((row) => row.role === 'CONVERGENCE' && (row.strainId === 'GRAVEMARK' || row.secondaryStrainId === 'GRAVEMARK')).length,
  8,
  'eight Sector 4 Convergences touch Gravemark',
);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);
for (const row of live) {
  if (row.strainId === 'GRAVEMARK' && row.role !== 'CONVERGENCE') {
    assert.equal(row.acquisitionWave, 4, `${row.id} must be acquisitionWave 4`);
    assert.ok(row.id.startsWith('GM_'), `${row.id} must use the GM_ prefix`);
  }
  if (row.role === 'CONVERGENCE' && (row.strainId === 'GRAVEMARK' || row.secondaryStrainId === 'GRAVEMARK')) {
    assert.equal(row.acquisitionWave, 4, `${row.id} must be acquisitionWave 4`);
    assert.ok(row.id.startsWith('CV_'), `${row.id} must use the CV_ prefix`);
  }
}

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string, extra: { premium?: boolean; family?: string } = {}) {
  const result = runtime.commit(id, {
    maxAcquisitionWave: 4,
    premiumVerdictSource: extra.premium,
    allowVerdictReplace: extra.premium,
    combatDepth: 2,
    equippedWeaponFamilyId: extra.family ?? 'aegis-longsword',
  });
  if (!result.eligible) runtime.grantFixture(id);
}

function native(targetId: string, damage: number, extra: Partial<TargetNativeResult> = {}): TargetNativeResult {
  return {
    targetId, hits: 1, misses: 0, crits: 0, nativeDirectDamage: damage, defenseDamage: 0, defenseBreaks: 0,
    fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0, ...extra,
  };
}

// --- Wave-4 lock: production/fresh-run offers never include Gravemark; direct grants require wave 4 ---
{
  const runtime = rt();
  const result = runtime.commit(GRAVEMARK_CORE_IDS.IMPACT_VECTOR, { maxAcquisitionWave: 3, combatDepth: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(result.eligible, false, 'Gravemark requires explicit maxAcquisitionWave 4');
  const ok = runtime.commit(GRAVEMARK_CORE_IDS.IMPACT_VECTOR, { maxAcquisitionWave: 4, combatDepth: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(ok.eligible, true, 'Gravemark is acquirable with explicit maxAcquisitionWave 4');
}

// --- Each Core across all nine canonical weapon families/classes ---
const CORES = Object.values(GRAVEMARK_CORE_IDS);
assert.equal(CORES.length, 4);
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  for (const core of CORES) {
    const runtime = rt();
    grant(runtime, core, { family });
    runtime.syncHostileIntents([
      hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 80, maxHp: 80 }),
    ]);
    runtime.setCombatDepth(2);
    runtime.runTurnStart();
    const classId = classIdForWeaponFamily(family);
    if (core === GRAVEMARK_CORE_IDS.REVERSAL_FIELD) {
      runtime.resolveInstinct({ ...instinctInputForClass(classId), associatedHostileUnitId: 'enemy-a' });
      assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'INSTINCT', `${core} ${family}`);
    } else if (core === GRAVEMARK_CORE_IDS.MASS_TRANSFER) {
      runtime.commitRootAction(weaponFamilyExecutionContext(family, {
        rootActionId: `seed:${family}`,
        actionSurface: 'WEAPON',
        nativeByTarget: [native('enemy-a', 5)],
        lockedTargetIds: ['enemy-a'],
      }));
      runtime.resolveCurrent({ ...ordinaryCurrentInput(classId), associatedHostileUnitId: 'enemy-a' });
      assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'CURRENT', `${core} ${family}`);
    } else if (core === GRAVEMARK_CORE_IDS.FOLDED_SPACE) {
      // Give it a differing Polarity via Instinct (test-only helper core), then a Technique/Flex
      // root under test that actually Displaces it and must refund 1 AP.
      runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
      runtime.resolveInstinct({ ...instinctInputForClass(classId), associatedHostileUnitId: 'enemy-a' });
      runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
      runtime.commitRootAction(weaponFamilyExecutionContext(family, {
        rootActionId: `technique:${family}`,
        actionSurface: 'TECHNIQUE',
        nativeByTarget: [native('enemy-a', 6)],
        lockedTargetIds: ['enemy-a'],
        actualCostsPaid: { ap: 2 },
      }));
      assert.ok(runtime.metric('ap_refund') >= 1, `${core} ${family}`);
    } else {
      // Impact Vector: give it a differing Polarity via Instinct (test-only helper core), then a
      // weapon root under test that Displaces it and must produce exactly one collision packet.
      runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
      runtime.resolveInstinct({ ...instinctInputForClass(classId), associatedHostileUnitId: 'enemy-a' });
      runtime.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'test', lineage: [], rootActionId: null, targetId: null, payload: {} });
      runtime.commitRootAction(weaponFamilyExecutionContext(family, {
        rootActionId: `weapon:${family}`,
        actionSurface: 'WEAPON',
        nativeByTarget: [native('enemy-a', 20)],
        lockedTargetIds: ['enemy-a'],
      }));
      assert.equal(runtime.getState().gravemark.lastCollision?.kind, 'IMPACT_VECTOR', `${core} ${family}`);
      assert.equal(runtime.getState().gravemark.lastCollision?.amount, Math.floor(20 * 0.25), `${core} ${family}`);
    }
  }
}

// --- Supports + Manifestation across all nine canonical weapon families ---
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  const runtime = rt();
  grant(runtime, GRAVEMARK_CORE_IDS.REVERSAL_FIELD, { family });
  grant(runtime, GRAVEMARK_SUPPORT_IDS.COLLISION_COURSE, { family });
  grant(runtime, GRAVEMARK_SUPPORT_IDS.FALSE_POSITION, { family });
  grant(runtime, GRAVEMARK_MANIFESTATION_ID, { family });
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 }),
    hostileSnapshotInput({ unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'BL_0', hp: 90, maxHp: 90 }),
  ]);
  runtime.setCombatDepth(2);
  runtime.runTurnStart();
  const classId = classIdForWeaponFamily(family);
  // A forced Instinct Displacement into an occupied opposite-lane slot is an atomic swap ->
  // Collision Course fires for both the trigger owner and the passenger.
  runtime.resolveInstinct({ ...instinctInputForClass(classId), associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.lastCollision?.kind, 'COLLISION_COURSE', `${family} collision course`);
  assert.ok(runtime.getState().gravemark.unmooredExpiryByUnitId['enemy-a'] > 0, `${family} trigger owner Unmoored`);
  assert.ok(runtime.getState().gravemark.unmooredExpiryByUnitId['enemy-b'] > 0, `${family} passenger Unmoored via Collision Course`);
  // False Position: while Unmoored, both frontline and backline targeting requests are eligible.
  assert.equal(runtime.falsePositionEligible('enemy-a', 'FRONTLINE', 'BACKLINE'), true, `${family} False Position frontline`);
  assert.equal(runtime.falsePositionEligible('enemy-a', 'BACKLINE', 'BACKLINE'), true, `${family} False Position backline`);
}

// --- World Turned Sideways across all nine canonical weapon families/ultimates ---
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  assert.equal(canFireWeaponUltimate(family), true);
  const runtime = rt();
  grant(runtime, GRAVEMARK_VERDICT_ID, { premium: true, family });
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 }),
  ]);
  runtime.setCombatDepth(2);
  runtime.runTurnStart();
  const before = runtime.hostileIntents().find((row) => row.unitId === 'enemy-a')?.gridSlot;
  const rootActionId = `ult:${family}`;
  runtime.beginWorldTurnedSidewaysUltimate(rootActionId, ['enemy-a']);
  const after = runtime.hostileIntents().find((row) => row.unitId === 'enemy-a')?.gridSlot;
  assert.notEqual(after, before, `${family} World Turned Sideways forces a pre-native Displacement`);
  runtime.commitRootAction(weaponFamilyExecutionContext(family, {
    rootActionId,
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    nativeByTarget: [native('enemy-a', 30)],
    lockedTargetIds: ['enemy-a'],
  }));
  assert.equal(runtime.getState().gravemark.lastCollision?.kind, 'WORLD_TURNED_SIDEWAYS', `${family} WTS post-native packet`);
  assert.equal(runtime.getState().gravemark.lastCollision?.amount, Math.floor(30 * 0.2), `${family} WTS 20% packet math`);
  // Opening/canceling the ultimate does nothing.
  const runtime2 = rt();
  grant(runtime2, GRAVEMARK_VERDICT_ID, { premium: true, family });
  runtime2.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 }),
  ]);
  runtime2.setCombatDepth(2);
  runtime2.runTurnStart();
  runtime2.commitRootAction(weaponFamilyExecutionContext(family, {
    rootActionId: `${rootActionId}:open`,
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    committed: false,
    nativeByTarget: [native('enemy-a', 30)],
    lockedTargetIds: ['enemy-a'],
  }));
  assert.equal(runtime2.getState().gravemark.polarityByUnitId['enemy-a'], undefined, `${family} canceled ultimate does nothing`);
}

console.log('Stage E.1 — Gravemark compatibility passed');
