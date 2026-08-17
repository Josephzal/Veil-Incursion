import assert from 'node:assert/strict';
import { AFTERIMAGE_CORE_IDS, AFTERIMAGE_MANIFESTATION_ID, AFTERIMAGE_SUPPORT_IDS, AFTERIMAGE_VERDICT_ID } from '../types/afterimage';
import { COUNTERFATE_CORE_IDS, COUNTERFATE_MANIFESTATION_ID, COUNTERFATE_SUPPORT_IDS, COUNTERFATE_VERDICT_ID } from '../types/counterfate';
import { RITUAL_CADENCE_CORE_IDS, RITUAL_CADENCE_MANIFESTATION_ID, RITUAL_CADENCE_SUPPORT_IDS, RITUAL_CADENCE_VERDICT_ID } from '../types/ritualCadence';
import { CONVERGENCE_IDS } from '../types/convergence';
import { getLiveUniversalBoonDefinitions, getSector1ProductionDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createDefaultNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { canFireWeaponUltimate } from './weaponUltimateRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';

console.log('Stage B exit gate');

const live = getSector1ProductionDefinitions();
assert.equal(live.length, 27);

const CORES = [
  COUNTERFATE_CORE_IDS.SEVERED_OUTCOME,
  COUNTERFATE_CORE_IDS.REFUSAL_PATTERN,
  COUNTERFATE_CORE_IDS.SECOND_REFLEX,
  COUNTERFATE_CORE_IDS.BORROWED_ENDING,
  RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE,
  RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION,
  RITUAL_CADENCE_CORE_IDS.SYNCOPATED_REFLEX,
  RITUAL_CADENCE_CORE_IDS.HELD_RESONANCE,
  AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT,
  AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION,
  AFTERIMAGE_CORE_IDS.REFLEX_REMNANT,
  AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE,
];
assert.equal(CORES.length, 12);

const SUPPORTS = [
  COUNTERFATE_SUPPORT_IDS.CHOSEN_FATE,
  COUNTERFATE_SUPPORT_IDS.PREEMPTIVE_RUPTURE,
  RITUAL_CADENCE_SUPPORT_IDS.IMPROVISED_MEASURE,
  RITUAL_CADENCE_SUPPORT_IDS.DOWNBEAT,
  AFTERIMAGE_SUPPORT_IDS.DEFERRED_EXPOSURE,
  AFTERIMAGE_SUPPORT_IDS.CROSSFADE,
];
const MANIFESTS = [
  COUNTERFATE_MANIFESTATION_ID,
  RITUAL_CADENCE_MANIFESTATION_ID,
  AFTERIMAGE_MANIFESTATION_ID,
];
const VERDICTS = [
  COUNTERFATE_VERDICT_ID,
  RITUAL_CADENCE_VERDICT_ID,
  AFTERIMAGE_VERDICT_ID,
];

function strainRuntime() {
  const rt = createNineStrainRuntime({ definitions: live });
  rt.hydrate(activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {}));
  return rt;
}

function grant(rt: ReturnType<typeof strainRuntime>, id: string, extra: { premium?: boolean; depth?: number; family?: string } = {}) {
  const result = rt.commit(id, {
    premiumVerdictSource: extra.premium,
    allowVerdictReplace: extra.premium,
    combatDepth: extra.depth ?? 2,
    equippedWeaponFamilyId: extra.family ?? 'aegis-longsword',
  });
  assert.equal(result.eligible, true, `${id} ${result.rejectionReasons.join(',')}`);
}

function parentCoresFor(id: string): string[] {
  if (id.startsWith('CF_') || id === COUNTERFATE_MANIFESTATION_ID || id === COUNTERFATE_VERDICT_ID) {
    return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, COUNTERFATE_CORE_IDS.REFUSAL_PATTERN];
  }
  if (id.startsWith('RC_') || id === RITUAL_CADENCE_MANIFESTATION_ID || id === RITUAL_CADENCE_VERDICT_ID) {
    return [RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION];
  }
  return [AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION];
}

let fixtures = 0;
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  for (const coreId of CORES) {
    const rt = strainRuntime();
    grant(rt, coreId, { family });
    rt.syncHostileIntents([
      hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 40 }),
    ], false);
    rt.runTurnStart();
    const preview = rt.previewRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `exit-${family}-${coreId}`,
      actionSurface: coreId.includes('INVOCATION') || coreId.includes('MEASURED') ? 'TECHNIQUE' : 'WEAPON',
      sourceKind: 'PLAYER_ACTION',
    }));
    rt.commitRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `exit-${family}-${coreId}`,
      actionSurface: coreId.includes('INVOCATION') || coreId.includes('MEASURED') ? 'TECHNIQUE' : 'WEAPON',
      sourceKind: 'PLAYER_ACTION',
    }));
    assert.equal(rt.getState().counterfate.rawReversal, preview.counterfate.rawReversal);
    fixtures += 1;
  }
}
assert.equal(fixtures, 108);

let verdicts = 0;
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  assert.equal(canFireWeaponUltimate(family), true);
  for (const verdict of VERDICTS) {
    const rt = strainRuntime();
    for (const core of parentCoresFor(verdict)) grant(rt, core, { family, depth: 2 });
    grant(rt, verdict, { premium: true, family, depth: 2 });
    rt.syncHostileIntents([
      hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 40 }),
    ], false);
    rt.runTurnStart();
    rt.commitRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `ult-${family}-${verdict}`,
      actionSurface: 'ULTIMATE',
      sourceKind: 'ULTIMATE',
    }));
    verdicts += 1;
  }
}
assert.equal(verdicts, 27);

for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  for (const support of SUPPORTS) {
    const rt = strainRuntime();
    for (const core of parentCoresFor(support)) grant(rt, core, { family, depth: 2 });
    grant(rt, support, { family, depth: 2 });
  }
  for (const manifest of MANIFESTS) {
    const rt = strainRuntime();
    for (const core of parentCoresFor(manifest)) grant(rt, core, { family, depth: 2 });
    grant(rt, manifest, { family, depth: 2 });
  }
}

for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  const classId = classIdForWeaponFamily(family);
  {
    const rt = strainRuntime();
    grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, { family });
    grant(rt, RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION, { family });
    grant(rt, CONVERGENCE_IDS.FATED_REFRAIN, { family });
    rt.syncHostileIntents([hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0' })], false);
    rt.runTurnStart();
    rt.commitRootAction(weaponFamilyExecutionContext(family, { rootActionId: `cv1-${family}`, actionSurface: 'WEAPON' }));
    assert.equal(classId, classIdForWeaponFamily(family));
  }
  {
    const rt = strainRuntime();
    grant(rt, COUNTERFATE_CORE_IDS.SECOND_REFLEX, { family });
    grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, { family });
    grant(rt, CONVERGENCE_IDS.SECOND_OUTCOME, { family });
    rt.syncHostileIntents([hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0' })], false);
    rt.runTurnStart();
    rt.commitRootAction(weaponFamilyExecutionContext(family, { rootActionId: `cv2-${family}`, actionSurface: 'WEAPON' }));
  }
  {
    const rt = strainRuntime();
    grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, { family });
    grant(rt, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION, { family });
    grant(rt, CONVERGENCE_IDS.ECHOED_RITE, { family });
    rt.runTurnStart();
    rt.commitRootAction(weaponFamilyExecutionContext(family, { rootActionId: `cv3-${family}`, actionSurface: 'WEAPON' }));
  }
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION);
  grant(rt, AFTERIMAGE_CORE_IDS.REFLEX_REMNANT);
  grant(rt, CONVERGENCE_IDS.FATED_REFRAIN);
  grant(rt, CONVERGENCE_IDS.SECOND_OUTCOME);
  grant(rt, CONVERGENCE_IDS.ECHOED_RITE);
  rt.syncHostileIntents([hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0' })], false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', { rootActionId: 'combo', actionSurface: 'WEAPON' }));
  const saved = rt.serialize();
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  assert.equal(resumed.getState().convergences.length, 3);
  assert.equal(resumed.getState().afterimage.pending.length, saved.afterimage.pending.length);
}

console.log('Stage B exit gate passed');
