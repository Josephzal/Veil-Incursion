import assert from 'node:assert/strict';
import { SOULWAKE_CORE_IDS, SOULWAKE_SUPPORT_IDS } from '../types/soulwake';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { hostileSnapshotInput } from './nineStrain/hostileField';

console.log('Stage D.2 — Soulwake boss and risk');

const live = getLiveUniversalBoonDefinitions();

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  runtime.syncPlayerVitals({ hp: 100, maxHp: 100 });
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string) {
  const result = runtime.commit(id, { maxAcquisitionWave: 3, combatDepth: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  if (!result.eligible) runtime.grantFixture(id);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.syncHostileIntents([
    hostileSnapshotInput({
      unitId: 'boss-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT',
      hp: 200, maxHp: 200, protectedPhase: true, designation: 'BOSS',
    }),
  ]);
  runtime.recordHpLoss({
    lossEventId: 'boss-hit',
    rootActionId: null,
    actualHpRemoved: 6,
    currentHpBefore: 100,
    currentHpAfter: 94,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'boss-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0,
      fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  const packet = runtime.getState().soulwake.lastPackets[0];
  assert.equal(packet?.fizzled, true);
  assert.equal(runtime.getState().soulwake.activeWake, 6);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  grant(runtime, SOULWAKE_SUPPORT_IDS.PAIN_DIVIDEND);
  runtime.recordHpLoss({
    lossEventId: 'risk',
    rootActionId: null,
    actualHpRemoved: 20,
    currentHpBefore: 100,
    currentHpAfter: 80,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.completeCombat('VICTORY');
  assert.equal(runtime.getState().soulwake.lastDividendHealed, 5);
  assert.equal(runtime.getState().soulwake.hpPaidThisEncounter, 20);
  assert.equal(runtime.getState().soulwake.hpRestoredThisEncounter, 5);
  assert.equal(runtime.soulwakePresentation().netRisk, 15);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  grant(runtime, SOULWAKE_SUPPORT_IDS.PAIN_DIVIDEND);
  runtime.recordHpLoss({
    lossEventId: 'fail',
    rootActionId: null,
    actualHpRemoved: 20,
    currentHpBefore: 100,
    currentHpAfter: 80,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.completeCombat('FAILURE');
  assert.equal(runtime.getState().soulwake.lastDividendHealed, 0);
}

console.log('Stage D.2 — Soulwake boss and risk passed');
