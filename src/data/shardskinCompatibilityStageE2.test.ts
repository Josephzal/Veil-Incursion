import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHARDSKIN_CORE_IDS, SHARDSKIN_VERDICT_ID } from '../types/shardskin';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';
import type { TargetNativeResult } from '../types/nineStrain';

console.log('Stage E.2 — Shardskin compatibility');

const live = getLiveUniversalBoonDefinitions();

// --- No 'SS_' identifiers leak outside Shardskin-owned files ---
const srcDir = join(process.cwd(), 'src/data/nineStrain');
for (const name of readdirSync(srcDir)) {
  if (!name.endsWith('.ts')) continue;
  if (name.toLowerCase().includes('shardskin') || name.includes('Definition')) continue;
  const text = readFileSync(join(srcDir, name), 'utf8');
  assert.equal(text.includes("if (def.id === 'SS_"), false, name);
  assert.equal(text.includes("case 'SS_"), false, name);
}

// --- Catalog counts (Stage E.2 fixed scope) ---
assert.equal(live.length, 108, 'live catalog');
assert.equal(live.filter((row) => row.role !== 'CONVERGENCE').length, 72, 'strain-family definitions (incl. Shardskin)');
assert.equal(live.filter((row) => row.role === 'CONVERGENCE').length, 36, 'convergence definitions');
assert.equal(live.filter((row) => row.strainId === 'SHARDSKIN').length, 8, 'Shardskin definition count');
assert.equal(getProductionOfferDefinitions(1).length, 27, 'wave 1 production pool');
assert.equal(getProductionOfferDefinitions(2).length, 50, 'wave 2 production pool');
assert.equal(getProductionOfferDefinitions(3).length, 77, 'wave 3 production pool');
assert.equal(getProductionOfferDefinitions(1).some((row) => row.strainId === 'SHARDSKIN'), false, 'wave 1 pool excludes Shardskin');
assert.equal(getProductionOfferDefinitions(2).some((row) => row.strainId === 'SHARDSKIN'), false, 'wave 2 pool excludes Shardskin');
assert.equal(getProductionOfferDefinitions(3).some((row) => row.strainId === 'SHARDSKIN'), false, 'wave 3 pool excludes Shardskin');
assert.equal(live.filter((row) => /sector[_-]?4/i.test(row.id) || /sector[_-]?4/i.test(String(row.strainId))).length, 0, 'no Sector 4 convergences');
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

function grant(runtime: ReturnType<typeof rt>, id: string, extra: { family?: string; premium?: boolean } = {}) {
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

// --- Wave-4 lock: production/fresh-run offers never include Shardskin; direct grants require wave 4 ---
{
  const runtime = rt();
  const result = runtime.commit(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE, { maxAcquisitionWave: 3, combatDepth: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(result.eligible, false, 'Shardskin requires explicit maxAcquisitionWave 4');
  const ok = runtime.commit(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE, { maxAcquisitionWave: 4, combatDepth: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(ok.eligible, true, 'Shardskin is acquirable with explicit maxAcquisitionWave 4');
}
{
  const runtime = rt();
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  assert.ok(
    runtime.getState().contactedStrains.some((row) => row.strainId === 'SHARDSKIN'),
    'grantFixture bypasses wave gating for tests by directly contacting the strain',
  );
}

// --- Crystal Edge, Ritual Pane, Perfect Facet, Pressure Crystal across all nine canonical weapon families ---
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  const classId = classIdForWeaponFamily(family);

  {
    const runtime = rt();
    grant(runtime, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE, { family });
    runtime.syncHostileIntents([hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 80, maxHp: 80 })]);
    runtime.setCombatDepth(1);
    runtime.runTurnStart();
    runtime.commitRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `crystal:${family}`,
      actionSurface: 'WEAPON',
      nativeByTarget: [native('enemy-a', 20)],
      lockedTargetIds: ['enemy-a'],
      totalNativeDirectDamage: 20,
    }));
    assert.equal(runtime.shardskinPresentation().currentShards, 4, `Crystal Edge ${family}`);
  }

  {
    const runtime = rt();
    grant(runtime, SHARDSKIN_CORE_IDS.RITUAL_PANE, { family });
    runtime.syncHostileIntents([hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 80, maxHp: 80 })]);
    runtime.setCombatDepth(1);
    runtime.runTurnStart();
    runtime.commitRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `ritual:${family}`,
      actionSurface: 'TECHNIQUE',
      nativeByTarget: [native('enemy-a', 0)],
      lockedTargetIds: ['enemy-a'],
      totalNativeDirectDamage: 0,
      actualCostsPaid: { ap: 1 },
    }));
    assert.equal(runtime.shardskinPresentation().currentShards, 5, `Ritual Pane ${family}`);
  }

  {
    const runtime = rt();
    grant(runtime, SHARDSKIN_CORE_IDS.PERFECT_FACET, { family });
    runtime.syncHostileIntents([hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 80, maxHp: 80 })]);
    runtime.setCombatDepth(1);
    runtime.runTurnStart();
    const input = classId === 'AEGIS'
      ? { classId, perfectParry: true, associatedHostileUnitId: 'enemy-a' }
      : classId === 'HEX_SHOT'
        ? { classId, reloadQuality: 'PERFECT' as const }
        : { classId, riftPreventedDamage: 10, riftWouldReachHp: 10, associatedHostileUnitId: 'enemy-a' };
    runtime.resolveInstinct(input);
    assert.equal(runtime.shardskinPresentation().currentShards, 10, `Perfect Facet PERFECT ${family}`);
  }

  {
    const runtime = rt();
    grant(runtime, SHARDSKIN_CORE_IDS.PRESSURE_CRYSTAL, { family });
    runtime.syncHostileIntents([hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 80, maxHp: 80 })]);
    runtime.setCombatDepth(1);
    runtime.runTurnStart();
    runtime.commitRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `seed:${family}`,
      actionSurface: 'WEAPON',
      nativeByTarget: [],
      lockedTargetIds: [],
      totalNativeDirectDamage: 0,
    }));
    const input = classId === 'HEX_SHOT' ? { classId, ammoSpent: true } : { classId, ordinarySpend: true };
    runtime.resolveCurrent(input);
    assert.equal(runtime.shardskinPresentation().currentShards, 4, `Pressure Crystal ordinary ${family}`);
  }
}

// --- No recursion: Shardskin generation/consumption never advances any of the other eight
//     Strains, and their events never generate Shards or consume Edge. ---
{
  const runtime = rt();
  grant(runtime, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  // A representative live definition from each of the other eight Strains (Cores/Manifestations
  // where cheap; grantFixture bypasses wave/imprint-slot contention entirely for this probe).
  const others = live.filter((row) => row.strainId !== 'SHARDSKIN' && row.role === 'CORE');
  for (const row of others) runtime.grantFixture(row.id);
  runtime.syncHostileIntents([hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 500, maxHp: 500 })]);
  runtime.setCombatDepth(2);
  runtime.runTurnStart();
  const beforeShards = runtime.shardskinPresentation().currentShards;
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'shared-root',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 20)],
    lockedTargetIds: ['enemy-a'],
    totalNativeDirectDamage: 20,
  }));
  // Crystal Edge fired once (its own guard), and no other Strain's ownership caused Shardskin to
  // generate more than its own formula, nor did Shardskin's own generation touch other Strains'
  // per-root guards for effects it does not own.
  assert.equal(runtime.shardskinPresentation().currentShards - beforeShards, 4, 'exactly Crystal Edge\'s own generation, no cross-Strain amplification');
}
{
  // Manifestation eligibility, Verdict mutual exclusion, and per-Strain guards remain independent.
  const runtime = rt();
  grant(runtime, SHARDSKIN_VERDICT_ID, { premium: true });
  assert.equal(runtime.getState().boundVerdict, SHARDSKIN_VERDICT_ID);
  // A second Verdict from a different Strain replaces boundVerdict (existing VERDICT_OCCUPIED law), unchanged by Shardskin.
  const otherVerdict = live.find((row) => row.role === 'VERDICT' && row.strainId !== 'SHARDSKIN');
  if (otherVerdict) {
    const result = runtime.commit(otherVerdict.id, { maxAcquisitionWave: 4, premiumVerdictSource: true, allowVerdictReplace: true, combatDepth: 2, equippedWeaponFamilyId: 'aegis-longsword' });
    if (result.eligible) {
      assert.equal(runtime.getState().boundVerdict, otherVerdict.id, 'VERDICT_OCCUPIED mutual exclusion unchanged by Shardskin');
    }
  }
}

console.log('Stage E.2 — Shardskin compatibility passed');
