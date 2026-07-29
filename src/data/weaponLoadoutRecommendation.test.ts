/**
 * Phase 3H recommended loadout mapping tests.
 * Run: npx --yes tsx src/data/weaponLoadoutRecommendation.test.ts
 */
import assert from 'node:assert/strict';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from './weaponRegistry';
import {
  buildAbilityCoverageReport,
  describeLiveLoadoutRules,
  formatAbilityCoverageDebug,
  formatWeaponLoadoutRecommendationDebug,
  queryWeaponLoadoutRecommendations,
  validateWeaponLoadoutRecommendations,
} from './weaponLoadoutRecommendationEngine';
import {
  listWeaponLoadoutRecommendationProfiles,
  WEAPON_LOADOUT_RECOMMENDATION_PROFILES,
} from './weaponLoadoutRecommendationProfiles';
import { getWeaponIdentityProfile } from './weaponIdentityProfiles';
import { validateWeaponRegistry } from './weaponValidationEngine';
import { ENVOY_ABILITY_CATALOG } from './envoyAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { AEGIS_ABILITY_CATALOG } from './aegisAbilities';
import { validateHexShotLoadoutCommit } from '../utils/classLoadoutUtils';
import {
  AEGIS_ANCHOR,
  normalizeAegisLoadout,
  validateLoadoutCommit,
} from '../utils/aegisLoadoutUtils';

function run(): void {
  const issues = validateWeaponLoadoutRecommendations();
  assert.equal(issues.length, 0, issues.map((i) => i.message).join('\n'));

  assert.equal(listWeaponLoadoutRecommendationProfiles().length, 9);
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    assert.ok(WEAPON_LOADOUT_RECOMMENDATION_PROFILES[id], id);
    const p = queryWeaponLoadoutRecommendations(id);
    assert.equal(p.weaponFamilyId, id);
    assert.equal(p.classId, getWeaponFamily(id).classId);
    assert.equal(p.sampleLoadouts.length, 2);
    // Planned display rename must not affect ID lookup
    const identity = getWeaponIdentityProfile(id);
    assert.equal(identity.id, id);
    const debug = formatWeaponLoadoutRecommendationDebug(id);
    assert.ok(debug.includes(`weapon=${id}`));
    assert.ok(debug.includes('anti='));
    assert.ok(debug.includes('why['));
    assert.ok(debug.includes('sample[IDENTITY_FORWARD]'));
    assert.ok(debug.includes('antiWhy['));
  });

  // Deterministic query
  const a = queryWeaponLoadoutRecommendations('hex-pulse-rifle');
  const b = queryWeaponLoadoutRecommendations('hex-pulse-rifle');
  assert.deepEqual(a.sampleLoadouts[0]!.slots, b.sampleLoadouts[0]!.slots);
  assert.equal(a.identitySummary, b.identitySummary);

  // Invalid / retired IDs fail clearly at commit + catalog checks
  assert.equal('NOT_A_REAL_ABILITY' in ENVOY_ABILITY_CATALOG, false);
  assert.equal('NOT_A_REAL_ABILITY' in HEX_SHOT_ABILITY_CATALOG, false);
  assert.equal('NOT_A_REAL_ABILITY' in AEGIS_ABILITY_CATALOG, false);
  const badHex = validateHexShotLoadoutCommit([
    'SILVER_CORE_SIDEARM',
    'ASH_JACKET_SALVO',
    'ASH_JACKET_SALVO',
    'RIFT_SNARE',
  ]);
  assert.ok(badHex && badHex.includes('DUPLICATE'));
  const retired = validateHexShotLoadoutCommit([
    'SILVER_CORE_SIDEARM',
    'WRAITH_PIERCER_ROUND',
    'RIFT_SNARE',
    'SINGULARITY_SLUG',
  ] as never);
  // Deprecated may pass commit string-wise but 3H validation forbids recommending them
  void retired;

  const coverage = buildAbilityCoverageReport();
  const allCatalog = [
    ...Object.keys(AEGIS_ABILITY_CATALOG),
    ...Object.keys(HEX_SHOT_ABILITY_CATALOG),
    ...Object.keys(ENVOY_ABILITY_CATALOG),
  ];
  assert.equal(coverage.length, allCatalog.length);
  const unmapped = coverage.filter((c) => c.categories.includes('INTENTIONALLY_UNMAPPED_SELECTABLE'));
  unmapped.forEach((o) => {
    assert.equal(o.structuralKind, 'LIVE_SELECTABLE_FLEX');
    assert.ok(o.unmappedExplanation, o.abilityId);
  });
  // Intrinsics/ultimates/deprecated must NOT be labeled as recommendation orphans
  coverage.filter((c) =>
    c.structuralKind === 'INTRINSIC'
    || c.structuralKind === 'ULTIMATE'
    || c.structuralKind === 'DEPRECATED_RETIRED'
    || c.structuralKind === 'FIXED_WEAPON_BASIC'
  ).forEach((c) => {
    assert.ok(!c.categories.includes('INTENTIONALLY_UNMAPPED_SELECTABLE'), c.abilityId);
  });
  assert.ok(coverage.some((c) => c.abilityId === 'STRIKE' && c.structuralKind === 'FIXED_WEAPON_BASIC'));
  assert.ok(formatAbilityCoverageDebug().length > 0);
  assert.ok(describeLiveLoadoutRules().includes('STRIKE'));
  assert.ok(describeLiveLoadoutRules().includes('fixed'));

  // Aegis fixed basic sanitization
  const migrated = normalizeAegisLoadout(['RUIN', 'DEVASTATE', 'SHADOW_STEP', 'ASHEN_MANTLE']);
  assert.equal(migrated[0], AEGIS_ANCHOR);
  assert.ok(migrated.includes('RUIN'));
  assert.ok(validateLoadoutCommit(['RUIN', 'DEVASTATE', 'SHADOW_STEP', 'ASHEN_MANTLE'] as never));
  assert.equal(validateLoadoutCommit(migrated), null);

  // Sibling identity-forward not identical (all classes)
  (['AEGIS', 'HEX_SHOT', 'ENVOY'] as const).forEach((classId) => {
    const ids = ALL_WEAPON_FAMILY_IDS.filter((id) => getWeaponFamily(id).classId === classId);
    const keys = ids.map((id) =>
      queryWeaponLoadoutRecommendations(id)
        .sampleLoadouts.find((s) => s.kind === 'IDENTITY_FORWARD')!
        .slots.join('|'),
    );
    assert.equal(new Set(keys).size, keys.length, `${classId} identical identity-forward`);
  });

  // Pulse ID remains permanent; live display is Carbine (Ash rename retired)
  assert.ok(queryWeaponLoadoutRecommendations('hex-pulse-rifle'));
  assert.equal(getWeaponIdentityProfile('hex-pulse-rifle').liveDisplayName, 'Carbine');
  assert.equal(getWeaponIdentityProfile('hex-pulse-rifle').plannedDisplayName, null);

  const weaponReg = validateWeaponRegistry();
  assert.equal(
    weaponReg.filter((i) => i.severity === 'error').length,
    0,
    JSON.stringify(weaponReg),
  );

  console.log('weaponLoadoutRecommendation.test.ts: OK');
  console.log('intentionally unmapped flex:', unmapped.map((o) => `${o.classId}:${o.abilityId}`).join(', '));
}

run();
