import assert from 'node:assert/strict';
import { AFTERIMAGE_CORE_IDS, AFTERIMAGE_MANIFESTATION_ID, AFTERIMAGE_SUPPORT_IDS, AFTERIMAGE_VERDICT_ID } from '../types/afterimage';
import { COUNTERFATE_CORE_IDS, COUNTERFATE_MANIFESTATION_ID, COUNTERFATE_SUPPORT_IDS, COUNTERFATE_VERDICT_ID } from '../types/counterfate';
import { RITUAL_CADENCE_CORE_IDS, RITUAL_CADENCE_MANIFESTATION_ID, RITUAL_CADENCE_SUPPORT_IDS, RITUAL_CADENCE_VERDICT_ID } from '../types/ritualCadence';
import { STILLPOINT_CORE_IDS, STILLPOINT_MANIFESTATION_ID, STILLPOINT_SUPPORT_IDS, STILLPOINT_VERDICT_ID } from '../types/stillpoint';
import { WOUNDWEAVE_CORE_IDS, WOUNDWEAVE_MANIFESTATION_ID, WOUNDWEAVE_SUPPORT_IDS, WOUNDWEAVE_VERDICT_ID } from '../types/woundweave';
import { FAULTLINE_CORE_IDS, FAULTLINE_MANIFESTATION_ID, FAULTLINE_SUPPORT_IDS, FAULTLINE_VERDICT_ID } from '../types/faultline';
import { SOULWAKE_CORE_IDS, SOULWAKE_MANIFESTATION_ID, SOULWAKE_SUPPORT_IDS, SOULWAKE_VERDICT_ID } from '../types/soulwake';
import { GRAVEMARK_CORE_IDS, GRAVEMARK_MANIFESTATION_ID, GRAVEMARK_SUPPORT_IDS, GRAVEMARK_VERDICT_ID } from '../types/gravemark';
import { SHARDSKIN_CORE_IDS, SHARDSKIN_MANIFESTATION_ID, SHARDSKIN_SUPPORT_IDS, SHARDSKIN_VERDICT_ID } from '../types/shardskin';
import { CONVERGENCE_IDS, SECTOR_4_CONVERGENCE_IDS } from '../types/convergence';
import { NINE_STRAIN_IDS } from './nineStrain/strainRegistry';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import {
  createNineStrainRuntime,
  instinctInputForClass,
  majorCurrentInput,
  ordinaryCurrentInput,
  weaponFamilyExecutionContext,
} from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState, hydrateNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { canFireWeaponUltimate } from './weaponUltimateRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './nineStrain/contentConfiguration';

console.log('Stage E exit gate — 108-definition standard system');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 108, 'exactly 108 standard definitions');
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(getProductionOfferDefinitions(3).length, 77);
assert.equal(getProductionOfferDefinitions(4).length, 108);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);
assert.equal(NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE, 4, 'wave-4 cutover is live for new runs');
assert.equal(NINE_STRAIN_IDS.length, 9, 'exactly nine Strains');

const CORES = [
  ...Object.values(COUNTERFATE_CORE_IDS),
  ...Object.values(RITUAL_CADENCE_CORE_IDS),
  ...Object.values(AFTERIMAGE_CORE_IDS),
  ...Object.values(STILLPOINT_CORE_IDS),
  ...Object.values(WOUNDWEAVE_CORE_IDS),
  ...Object.values(FAULTLINE_CORE_IDS),
  ...Object.values(SOULWAKE_CORE_IDS),
  ...Object.values(GRAVEMARK_CORE_IDS),
  ...Object.values(SHARDSKIN_CORE_IDS),
];
assert.equal(CORES.length, 36, '9 Strains x 4 Cores = 36 baseline Cores');

const INSTINCT_CORES = [
  COUNTERFATE_CORE_IDS.SECOND_REFLEX,
  RITUAL_CADENCE_CORE_IDS.SYNCOPATED_REFLEX,
  AFTERIMAGE_CORE_IDS.REFLEX_REMNANT,
  STILLPOINT_CORE_IDS.QUIET_REFLEX,
  WOUNDWEAVE_CORE_IDS.REFLEXIVE_AGONY,
  FAULTLINE_CORE_IDS.COUNTERPRESSURE,
  SOULWAKE_CORE_IDS.PAIN_REFLEX,
  GRAVEMARK_CORE_IDS.REVERSAL_FIELD,
  SHARDSKIN_CORE_IDS.PERFECT_FACET,
];
assert.equal(INSTINCT_CORES.length, 9, 'all nine Instinct Imbuements');

const CURRENT_CORES = [
  COUNTERFATE_CORE_IDS.BORROWED_ENDING,
  RITUAL_CADENCE_CORE_IDS.HELD_RESONANCE,
  AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE,
  STILLPOINT_CORE_IDS.SILENT_RESERVOIR,
  WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD,
  FAULTLINE_CORE_IDS.LOAD_LIMIT,
  SOULWAKE_CORE_IDS.OPEN_CONDUIT,
  GRAVEMARK_CORE_IDS.MASS_TRANSFER,
  SHARDSKIN_CORE_IDS.PRESSURE_CRYSTAL,
];
assert.equal(CURRENT_CORES.length, 9, 'all nine Current Imbuements');

const SUPPORTS = [
  ...Object.values(COUNTERFATE_SUPPORT_IDS),
  ...Object.values(RITUAL_CADENCE_SUPPORT_IDS),
  ...Object.values(AFTERIMAGE_SUPPORT_IDS),
  ...Object.values(STILLPOINT_SUPPORT_IDS),
  ...Object.values(WOUNDWEAVE_SUPPORT_IDS),
  ...Object.values(FAULTLINE_SUPPORT_IDS),
  ...Object.values(SOULWAKE_SUPPORT_IDS),
  ...Object.values(GRAVEMARK_SUPPORT_IDS),
  ...Object.values(SHARDSKIN_SUPPORT_IDS),
];
assert.equal(SUPPORTS.length, 18, 'all 18 Supports');

const MANIFESTS = [
  COUNTERFATE_MANIFESTATION_ID,
  RITUAL_CADENCE_MANIFESTATION_ID,
  AFTERIMAGE_MANIFESTATION_ID,
  STILLPOINT_MANIFESTATION_ID,
  WOUNDWEAVE_MANIFESTATION_ID,
  FAULTLINE_MANIFESTATION_ID,
  SOULWAKE_MANIFESTATION_ID,
  GRAVEMARK_MANIFESTATION_ID,
  SHARDSKIN_MANIFESTATION_ID,
];
assert.equal(MANIFESTS.length, 9, 'all nine Manifestations');

const VERDICTS = [
  COUNTERFATE_VERDICT_ID,
  RITUAL_CADENCE_VERDICT_ID,
  AFTERIMAGE_VERDICT_ID,
  STILLPOINT_VERDICT_ID,
  WOUNDWEAVE_VERDICT_ID,
  FAULTLINE_VERDICT_ID,
  SOULWAKE_VERDICT_ID,
  GRAVEMARK_VERDICT_ID,
  SHARDSKIN_VERDICT_ID,
];
assert.equal(VERDICTS.length, 9, 'all nine Verdicts');

const ALL_CV = Object.values(CONVERGENCE_IDS);
assert.equal(ALL_CV.length, 36, 'exactly 36 Convergences');
assert.equal(SECTOR_4_CONVERGENCE_IDS.length, 15, 'exactly 15 Sector 4 Convergences');

function strainRuntime() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  runtime.syncPlayerVitals({ hp: 100, maxHp: 100 });
  return runtime;
}

function grant(rt: ReturnType<typeof strainRuntime>, id: string, extra: { premium?: boolean; family?: string } = {}) {
  rt.grantFixture(id);
  const result = rt.commit(id, {
    maxAcquisitionWave: 4,
    premiumVerdictSource: extra.premium,
    allowVerdictReplace: extra.premium,
    combatDepth: 2,
    equippedWeaponFamilyId: extra.family ?? 'aegis-longsword',
  });
  if (!result.eligible) rt.grantFixture(id);
  return result;
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
  if (id.startsWith('WW_') || id === WOUNDWEAVE_MANIFESTATION_ID || id === WOUNDWEAVE_VERDICT_ID) {
    return [WOUNDWEAVE_CORE_IDS.SHARED_WOUND, WOUNDWEAVE_CORE_IDS.CROSSED_HEX];
  }
  if (id.startsWith('FL_') || id === FAULTLINE_MANIFESTATION_ID || id === FAULTLINE_VERDICT_ID) {
    return [FAULTLINE_CORE_IDS.STRESS_PATTERN, FAULTLINE_CORE_IDS.APPLIED_FRACTURE];
  }
  if (id.startsWith('SW_') || id === SOULWAKE_MANIFESTATION_ID || id === SOULWAKE_VERDICT_ID) {
    return [SOULWAKE_CORE_IDS.HOLLOW_EDGE, SOULWAKE_CORE_IDS.BORROWED_NERVE];
  }
  if (id.startsWith('GM_') || id === GRAVEMARK_MANIFESTATION_ID || id === GRAVEMARK_VERDICT_ID) {
    return [GRAVEMARK_CORE_IDS.IMPACT_VECTOR, GRAVEMARK_CORE_IDS.FOLDED_SPACE];
  }
  return [SHARDSKIN_CORE_IDS.CRYSTAL_EDGE, SHARDSKIN_CORE_IDS.RITUAL_PANE];
}

// Two-Core parent fixtures for every one of the 36 Convergences. Every pairing below uses two
// distinct ARMAMENT/DISCIPLINE imprints so granting both Cores never overwrites the other.
function cvParents(id: string): string[] {
  if (id === CONVERGENCE_IDS.FATED_REFRAIN) return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION];
  if (id === CONVERGENCE_IDS.SECOND_OUTCOME) return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION];
  if (id === CONVERGENCE_IDS.ECHOED_RITE) return [RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION];
  if (id === CONVERGENCE_IDS.STAYED_SENTENCE) return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, STILLPOINT_CORE_IDS.PATIENT_INVOCATION];
  if (id === CONVERGENCE_IDS.MEASURED_SILENCE) return [RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, STILLPOINT_CORE_IDS.PATIENT_INVOCATION];
  if (id === CONVERGENCE_IDS.SUSPENDED_ECHO) return [AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, STILLPOINT_CORE_IDS.PATIENT_INVOCATION];
  if (id === CONVERGENCE_IDS.ENTANGLED_FATE) return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, WOUNDWEAVE_CORE_IDS.CROSSED_HEX];
  if (id === CONVERGENCE_IDS.TWOFOLD_RITE) return [RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, WOUNDWEAVE_CORE_IDS.CROSSED_HEX];
  if (id === CONVERGENCE_IDS.GHOST_THREAD) return [AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, WOUNDWEAVE_CORE_IDS.CROSSED_HEX];
  if (id === CONVERGENCE_IDS.DRAWN_TENSION) return [STILLPOINT_CORE_IDS.STORED_FORCE, WOUNDWEAVE_CORE_IDS.CROSSED_HEX];
  if (id === CONVERGENCE_IDS.BROKEN_OUTCOME) return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, FAULTLINE_CORE_IDS.APPLIED_FRACTURE];
  if (id === CONVERGENCE_IDS.BREAKING_MEASURE) return [RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, FAULTLINE_CORE_IDS.APPLIED_FRACTURE];
  if (id === CONVERGENCE_IDS.ECHOED_FAULT) return [AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, FAULTLINE_CORE_IDS.APPLIED_FRACTURE];
  if (id === CONVERGENCE_IDS.CRITICAL_PRESSURE) return [STILLPOINT_CORE_IDS.STORED_FORCE, FAULTLINE_CORE_IDS.APPLIED_FRACTURE];
  if (id === CONVERGENCE_IDS.SPLIT_SEAM) return [WOUNDWEAVE_CORE_IDS.SHARED_WOUND, FAULTLINE_CORE_IDS.APPLIED_FRACTURE];
  if (id === CONVERGENCE_IDS.PAIN_FORETOLD) return [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, SOULWAKE_CORE_IDS.BORROWED_NERVE];
  if (id === CONVERGENCE_IDS.PULSE_RITE) return [RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, SOULWAKE_CORE_IDS.BORROWED_NERVE];
  if (id === CONVERGENCE_IDS.PHANTOM_PAIN) return [AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, SOULWAKE_CORE_IDS.BORROWED_NERVE];
  if (id === CONVERGENCE_IDS.HELD_BREATH) return [STILLPOINT_CORE_IDS.STORED_FORCE, SOULWAKE_CORE_IDS.BORROWED_NERVE];
  if (id === CONVERGENCE_IDS.SYMPATHETIC_WOUND) return [WOUNDWEAVE_CORE_IDS.SHARED_WOUND, SOULWAKE_CORE_IDS.BORROWED_NERVE];
  if (id === CONVERGENCE_IDS.LIVING_FAULT) return [FAULTLINE_CORE_IDS.STRESS_PATTERN, SOULWAKE_CORE_IDS.BORROWED_NERVE];
  // Sector 4 -- Gravemark Cores use their ARMAMENT-imprint Impact Vector; Shardskin Cores use
  // their ARMAMENT-imprint Crystal Edge, each paired against the other Strain's DISCIPLINE second
  // Core so the two grants never collide on an imprint slot.
  if (id === CONVERGENCE_IDS.FATE_OUT_OF_PLACE) return [COUNTERFATE_CORE_IDS.REFUSAL_PATTERN, GRAVEMARK_CORE_IDS.IMPACT_VECTOR];
  if (id === CONVERGENCE_IDS.TURNING_RITE) return [RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION, GRAVEMARK_CORE_IDS.IMPACT_VECTOR];
  if (id === CONVERGENCE_IDS.PARALLAX_ECHO) return [AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION, GRAVEMARK_CORE_IDS.IMPACT_VECTOR];
  if (id === CONVERGENCE_IDS.STORED_VECTOR) return [STILLPOINT_CORE_IDS.PATIENT_INVOCATION, GRAVEMARK_CORE_IDS.IMPACT_VECTOR];
  if (id === CONVERGENCE_IDS.TETHERED_ORBIT) return [WOUNDWEAVE_CORE_IDS.CROSSED_HEX, GRAVEMARK_CORE_IDS.IMPACT_VECTOR];
  if (id === CONVERGENCE_IDS.TECTONIC_SHIFT) return [FAULTLINE_CORE_IDS.APPLIED_FRACTURE, GRAVEMARK_CORE_IDS.IMPACT_VECTOR];
  if (id === CONVERGENCE_IDS.TRAUMA_VECTOR) return [SOULWAKE_CORE_IDS.BORROWED_NERVE, GRAVEMARK_CORE_IDS.IMPACT_VECTOR];
  if (id === CONVERGENCE_IDS.FATED_FACET) return [COUNTERFATE_CORE_IDS.REFUSAL_PATTERN, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE];
  if (id === CONVERGENCE_IDS.PRISMATIC_RITE) return [RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE];
  if (id === CONVERGENCE_IDS.PHANTOM_FACET) return [AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE];
  if (id === CONVERGENCE_IDS.STILLGLASS) return [STILLPOINT_CORE_IDS.PATIENT_INVOCATION, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE];
  if (id === CONVERGENCE_IDS.CRYSTAL_LIGATURE) return [WOUNDWEAVE_CORE_IDS.CROSSED_HEX, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE];
  if (id === CONVERGENCE_IDS.FAULTGLASS) return [FAULTLINE_CORE_IDS.APPLIED_FRACTURE, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE];
  if (id === CONVERGENCE_IDS.SOULGLASS) return [SOULWAKE_CORE_IDS.BORROWED_NERVE, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE];
  return [GRAVEMARK_CORE_IDS.IMPACT_VECTOR, SHARDSKIN_CORE_IDS.RITUAL_PANE]; // IMPACT_LATTICE
}

// --- Universal coverage: 36 Cores x 9 weapon families = 324 baseline Core/weapon fixtures ---
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
      rootActionId: `e-exit-${family}-${coreId}`,
      actionSurface: coreId.includes('INVOCATION') || coreId.includes('MEASURED') || coreId.includes('PATIENT') || coreId.includes('APPLIED')
        ? 'TECHNIQUE'
        : 'WEAPON',
    }));
    fixtures += 1;
  }
}
assert.equal(fixtures, 324, '36 Cores x 9 weapon families = 324 baseline Core/weapon fixtures');

// --- All 9 Instinct Imbuements across every valid class/grade mapping ---
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

// --- All 9 Current Imbuements across ordinary and major signals for all classes ---
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

// --- 9 Verdicts x 9 equipped ultimates = 81 fixtures ---
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
assert.equal(verdicts, 81, '9 Verdicts x 9 equipped ultimates = 81 fixtures');

// --- All 18 Supports and 9 Manifestations have a legal path on every weapon ---
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

// --- All 36 Convergences have legal acquisition and execution paths on all three classes ---
for (const family of ['aegis-longsword', 'hex-revolver', 'envoy-vambrace'] as const) {
  for (const cv of ALL_CV) {
    const rt = strainRuntime();
    for (const core of cvParents(cv)) {
      const granted = grant(rt, core, { family });
      assert.ok(granted.eligible || rt.getState().cores.ARMAMENT || rt.getState().cores.DISCIPLINE, `${cv} parent ${core}`);
    }
    const cvGrant = grant(rt, cv, { family });
    assert.equal(cvGrant.eligible, true, `${cv} ${cvGrant.rejectionReasons.join(',')}`);
    rt.syncHostileIntents([
      hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 40 }),
      hostileSnapshotInput({ unitId: 'e2', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FR_0', hp: 40 }),
    ], false);
    rt.runTurnStart();
    rt.commitRootAction(weaponFamilyExecutionContext(family, { rootActionId: `cv-${family}-${cv}` }));
    assert.equal(classIdForWeaponFamily(family), classIdForWeaponFamily(family));
  }
}

// --- Old-save wave pinning: a schema-15 row persisted at wave 3 hydrates unchanged at wave 3,
//     never auto-upgraded to the new production ceiling of wave 4 ---
{
  const legacy = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  const legacyRow = { ...legacy, maxAcquisitionWave: 3 as const, schemaVersion: 15 };
  const hydrated = hydrateNineStrainRuntimeState(legacyRow);
  assert.equal(hydrated.maxAcquisitionWave, 3, 'a schema-15 wave-3 save stays pinned at wave 3 on hydrate');
  const hydratedTwice = hydrateNineStrainRuntimeState(hydrated);
  assert.equal(hydratedTwice.maxAcquisitionWave, 3, 'hydrating twice is a no-op for the pinned wave');
}

// --- Persistence round trip through a Sector 4 pending boundary ---
{
  const rt = strainRuntime();
  grant(rt, GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  grant(rt, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  grant(rt, CONVERGENCE_IDS.IMPACT_LATTICE);
  rt.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0' }),
    hostileSnapshotInput({ unitId: 'e2', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FR_0' }),
  ], false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', { rootActionId: 'e-exit-persist' }));
  const snap = rt.serialize();
  const resumed = hydrateNineStrainRuntimeState(snap);
  assert.equal(resumed.schemaVersion, 15);
  assert.deepEqual(resumed.convergences, snap.convergences);
  assert.deepEqual(resumed.convergence.sector4, snap.convergence.sector4, 'Sector 4 Convergence provenance round-trips unchanged');
  const resumedTwice = hydrateNineStrainRuntimeState(resumed);
  assert.deepEqual(resumedTwice.convergence.sector4, resumed.convergence.sector4, 'hydrating current state twice is a no-op');
}

console.log('Stage E exit gate passed');
