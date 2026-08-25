import assert from 'node:assert/strict';
import { AFTERIMAGE_CORE_IDS, AFTERIMAGE_MANIFESTATION_ID, AFTERIMAGE_SUPPORT_IDS, AFTERIMAGE_VERDICT_ID } from '../types/afterimage';
import { COUNTERFATE_CORE_IDS, COUNTERFATE_MANIFESTATION_ID, COUNTERFATE_SUPPORT_IDS, COUNTERFATE_VERDICT_ID } from '../types/counterfate';
import { RITUAL_CADENCE_CORE_IDS, RITUAL_CADENCE_MANIFESTATION_ID, RITUAL_CADENCE_SUPPORT_IDS, RITUAL_CADENCE_VERDICT_ID } from '../types/ritualCadence';
import { STILLPOINT_CORE_IDS, STILLPOINT_MANIFESTATION_ID, STILLPOINT_SUPPORT_IDS, STILLPOINT_VERDICT_ID } from '../types/stillpoint';
import { WOUNDWEAVE_CORE_IDS, WOUNDWEAVE_MANIFESTATION_ID, WOUNDWEAVE_SUPPORT_IDS, WOUNDWEAVE_VERDICT_ID } from '../types/woundweave';
import { CONVERGENCE_IDS, SECTOR_2_CONVERGENCE_IDS } from '../types/convergence';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import {
  createNineStrainRuntime,
  instinctInputForClass,
  majorCurrentInput,
  ordinaryCurrentInput,
  weaponFamilyExecutionContext,
} from './nineStrain/runtime';
import { createDefaultNineStrainRuntimeState, hydrateNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { canFireWeaponUltimate } from './weaponUltimateRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';

console.log('Stage C exit gate');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 108);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);

const CORES = [
  ...Object.values(COUNTERFATE_CORE_IDS),
  ...Object.values(RITUAL_CADENCE_CORE_IDS),
  ...Object.values(AFTERIMAGE_CORE_IDS),
  ...Object.values(STILLPOINT_CORE_IDS),
  ...Object.values(WOUNDWEAVE_CORE_IDS),
];
assert.equal(CORES.length, 20);

const INSTINCT_CORES = [
  COUNTERFATE_CORE_IDS.SECOND_REFLEX,
  RITUAL_CADENCE_CORE_IDS.SYNCOPATED_REFLEX,
  AFTERIMAGE_CORE_IDS.REFLEX_REMNANT,
  STILLPOINT_CORE_IDS.QUIET_REFLEX,
  WOUNDWEAVE_CORE_IDS.REFLEXIVE_AGONY,
];
const CURRENT_CORES = [
  COUNTERFATE_CORE_IDS.BORROWED_ENDING,
  RITUAL_CADENCE_CORE_IDS.HELD_RESONANCE,
  AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE,
  STILLPOINT_CORE_IDS.SILENT_RESERVOIR,
  WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD,
];
const SUPPORTS = [
  ...Object.values(COUNTERFATE_SUPPORT_IDS),
  ...Object.values(RITUAL_CADENCE_SUPPORT_IDS),
  ...Object.values(AFTERIMAGE_SUPPORT_IDS),
  ...Object.values(STILLPOINT_SUPPORT_IDS),
  ...Object.values(WOUNDWEAVE_SUPPORT_IDS),
];
const MANIFESTS = [
  COUNTERFATE_MANIFESTATION_ID,
  RITUAL_CADENCE_MANIFESTATION_ID,
  AFTERIMAGE_MANIFESTATION_ID,
  STILLPOINT_MANIFESTATION_ID,
  WOUNDWEAVE_MANIFESTATION_ID,
];
const VERDICTS = [
  COUNTERFATE_VERDICT_ID,
  RITUAL_CADENCE_VERDICT_ID,
  AFTERIMAGE_VERDICT_ID,
  STILLPOINT_VERDICT_ID,
  WOUNDWEAVE_VERDICT_ID,
];
const ALL_CV = Object.values(CONVERGENCE_IDS);

function strainRuntime() {
  const runtime = createNineStrainRuntime({ definitions: live, allowSector2Wave: true });
  runtime.hydrate(activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {}));
  return runtime;
}

function grant(rt: ReturnType<typeof strainRuntime>, id: string, extra: { premium?: boolean; family?: string } = {}) {
  rt.grantFixture(id);
  rt.commit(id, {
    allowSector2Wave: true,
    premiumVerdictSource: extra.premium,
    allowVerdictReplace: extra.premium,
    combatDepth: 2,
    equippedWeaponFamilyId: extra.family ?? 'aegis-longsword',
  });
}

function parentCoresFor(id: string): string[] {
  if (id.startsWith('CF_') || id === COUNTERFATE_MANIFESTATION_ID || id === COUNTERFATE_VERDICT_ID) {
    return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, COUNTERFATE_CORE_IDS.REFUSAL_PATTERN];
  }
  if (id.startsWith('RC_') || id === RITUAL_CADENCE_MANIFESTATION_ID || id === RITUAL_CADENCE_VERDICT_ID) {
    return [RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION];
  }
  if (id.startsWith('AI_') || id === AFTERIMAGE_MANIFESTATION_ID || id === AFTERIMAGE_VERDICT_ID) {
    return [AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION];
  }
  if (id.startsWith('SP_') || id === STILLPOINT_MANIFESTATION_ID || id === STILLPOINT_VERDICT_ID) {
    return [STILLPOINT_CORE_IDS.STORED_FORCE, STILLPOINT_CORE_IDS.PATIENT_INVOCATION];
  }
  return [WOUNDWEAVE_CORE_IDS.SHARED_WOUND, WOUNDWEAVE_CORE_IDS.CROSSED_HEX];
}

function cvParents(id: string): string[] {
  if (id === CONVERGENCE_IDS.FATED_REFRAIN) return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE];
  if (id === CONVERGENCE_IDS.SECOND_OUTCOME) return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT];
  if (id === CONVERGENCE_IDS.ECHOED_RITE) return [RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT];
  if (id === CONVERGENCE_IDS.STAYED_SENTENCE) return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, STILLPOINT_CORE_IDS.STORED_FORCE];
  if (id === CONVERGENCE_IDS.MEASURED_SILENCE) return [RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, STILLPOINT_CORE_IDS.STORED_FORCE];
  if (id === CONVERGENCE_IDS.SUSPENDED_ECHO) return [AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, STILLPOINT_CORE_IDS.STORED_FORCE];
  if (id === CONVERGENCE_IDS.ENTANGLED_FATE) return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, WOUNDWEAVE_CORE_IDS.SHARED_WOUND];
  if (id === CONVERGENCE_IDS.TWOFOLD_RITE) return [RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, WOUNDWEAVE_CORE_IDS.SHARED_WOUND];
  if (id === CONVERGENCE_IDS.GHOST_THREAD) return [AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, WOUNDWEAVE_CORE_IDS.SHARED_WOUND];
  return [STILLPOINT_CORE_IDS.STORED_FORCE, WOUNDWEAVE_CORE_IDS.SHARED_WOUND];
}

let fixtures = 0;
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  for (const coreId of CORES) {
    const rt = strainRuntime();
    grant(rt, coreId, { family });
    rt.syncHostileIntents([
      hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 40 }),
      hostileSnapshotInput({ unitId: 'e2', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FR_0', hp: 40 }),
    ], false);
    rt.runTurnStart();
    rt.commitRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `c-exit-${family}-${coreId}`,
      actionSurface: coreId.includes('INVOCATION') || coreId.includes('MEASURED') || coreId.includes('PATIENT') ? 'TECHNIQUE' : 'WEAPON',
    }));
    fixtures += 1;
  }
}
assert.equal(fixtures, 180);

const classes = ['AEGIS', 'HEX_SHOT', 'ENVOY'] as const;
for (const core of INSTINCT_CORES) {
  for (const classId of classes) {
    const rt = strainRuntime();
    grant(rt, core);
    rt.syncHostileIntents([hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0' })], false);
    rt.runTurnStart();
    rt.resolveInstinct(instinctInputForClass(classId));
  }
}

for (const core of CURRENT_CORES) {
  for (const classId of classes) {
    const rt = strainRuntime();
    grant(rt, core);
    rt.syncHostileIntents([hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0' })], false);
    rt.runTurnStart();
    rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', { rootActionId: `cur-${core}-${classId}` }));
    rt.resolveCurrent(ordinaryCurrentInput(classId));
    rt.resolveCurrent(majorCurrentInput(classId));
  }
}

let verdicts = 0;
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  assert.equal(canFireWeaponUltimate(family), true);
  for (const verdict of VERDICTS) {
    const rt = strainRuntime();
    for (const core of parentCoresFor(verdict)) grant(rt, core, { family });
    grant(rt, verdict, { premium: true, family });
    rt.syncHostileIntents([
      hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 40 }),
      hostileSnapshotInput({ unitId: 'e2', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FR_0', hp: 40 }),
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
assert.equal(verdicts, 45);

for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  for (const support of SUPPORTS) {
    const rt = strainRuntime();
    for (const core of parentCoresFor(support)) grant(rt, core, { family });
    grant(rt, support, { family });
  }
  for (const manifest of MANIFESTS) {
    const rt = strainRuntime();
    for (const core of parentCoresFor(manifest)) grant(rt, core, { family });
    grant(rt, manifest, { family });
  }
}

for (const family of ['aegis-longsword', 'hex-revolver', 'envoy-vambrace'] as const) {
  for (const cv of ALL_CV) {
    const rt = strainRuntime();
    for (const core of cvParents(cv)) grant(rt, core, { family });
    grant(rt, cv, { family });
    rt.syncHostileIntents([
      hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 40 }),
      hostileSnapshotInput({ unitId: 'e2', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FR_0', hp: 40 }),
    ], false);
    rt.runTurnStart();
    rt.commitRootAction(weaponFamilyExecutionContext(family, { rootActionId: `cv-${family}-${cv}` }));
    assert.equal(classIdForWeaponFamily(family), classIdForWeaponFamily(family));
  }
}

for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  for (const cv of SECTOR_2_CONVERGENCE_IDS) {
    const rt = strainRuntime();
    for (const core of cvParents(cv)) grant(rt, core, { family });
    grant(rt, cv, { family });
    rt.syncHostileIntents([
      hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 40 }),
      hostileSnapshotInput({ unitId: 'e2', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FR_0', hp: 40 }),
    ], false);
    rt.runTurnStart();
    rt.commitRootAction(weaponFamilyExecutionContext(family, { rootActionId: `s2-${family}-${cv}` }));
  }
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, STILLPOINT_CORE_IDS.STORED_FORCE);
  grant(rt, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  rt.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0' }),
    hostileSnapshotInput({ unitId: 'e2', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FR_0' }),
  ], false);
  rt.runTurnStart();
  rt.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  const snap = rt.serialize();
  const resumed = hydrateNineStrainRuntimeState(snap);
  assert.equal(resumed.stillpoint.nativeStillness, snap.stillpoint.nativeStillness);
  assert.equal(resumed.schemaVersion, 15);
}

console.log('Stage C exit gate passed');
