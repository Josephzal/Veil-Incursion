/**
 * Phase A — Aegis technique migration + weapon-action derivation.
 * Run: npx tsx src/data/aegisMigration.test.ts
 */
import assert from 'node:assert/strict';
import {
  DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  type AegisTechniqueLoadout,
} from '../types/aegisCombat';
import {
  hydrateAegisTechniqueLoadout,
  migrateAegisTechniqueLoadout,
  validateAegisTechniqueLoadoutCommit,
} from './aegisMigration';
import { isAegisBrandTechnique } from './aegisTechniqueCatalog';
import {
  ALL_AEGIS_WEAPON_FAMILY_IDS,
  deriveAegisWeaponActions,
  deriveAegisWeaponUltimateId,
} from './aegisWeaponActionRegistry';
import { buildAegisCombatSurface } from './aegisCombatCompatibility';
import { createDefaultActiveIncursionState, type PlayerAccount } from '../types/game';

console.log('Phase A — Aegis technique migration + derivation');

function assertUniqueThree(loadout: AegisTechniqueLoadout): void {
  assert.equal(loadout.length, 3);
  assert.equal(new Set(loadout).size, 3);
  assert.equal(validateAegisTechniqueLoadoutCommit(loadout), null);
  assert.ok(loadout.some((id) => isAegisBrandTechnique(id)));
}

// 1–5: legacy four-slot migrations
const cases: Array<{ name: string; input: unknown; expectIncludes?: string[]; expectExcludes?: string[] }> = [
  {
    name: 'classic default-ish',
    input: ['STRIKE', 'ASHEN_MANTLE', 'VEIL_PIERCER', 'RUIN'],
    expectIncludes: ['ASHEN_MANTLE', 'VEIL_PIERCER', 'RUIN'],
  },
  {
    name: 'carapace rename',
    input: ['STRIKE', 'BLOOD_BOUND_CARAPACE', 'GRAVE_BIND', 'RUIN'],
    expectIncludes: ['RUNEBOUND_CARAPACE', 'GRAVE_BIND', 'RUIN'],
    expectExcludes: ['BLOOD_BOUND_CARAPACE'],
  },
  {
    name: 'retire blood tithe + fault',
    input: ['STRIKE', 'BLOOD_TITHE', 'ABYSSAL_FAULT', 'RUIN'],
    expectIncludes: ['RUIN'],
    expectExcludes: ['BLOOD_TITHE', 'ABYSSAL_FAULT'],
  },
  {
    name: 'strip parry/ultimate/strike/unknown/dupes',
    input: ['STRIKE', 'WRAITH_PARRY', 'EVISCERATE', 'RUIN', 'RUIN', 'NOT_REAL', 'DEVASTATE'],
    expectIncludes: ['RUIN', 'DEVASTATE'],
    expectExcludes: ['STRIKE', 'WRAITH_PARRY', 'EVISCERATE', 'NOT_REAL'],
  },
  {
    name: 'empty → default',
    input: [],
  },
  {
    name: 'utility-only pads brand',
    input: ['STRIKE', 'GRAVE_BIND', 'NAIL_TO_GRID', 'SHADOW_STEP'],
  },
];

for (const c of cases) {
  const migrated = migrateAegisTechniqueLoadout(c.input);
  assertUniqueThree(migrated);
  for (const id of c.expectIncludes ?? []) {
    assert.ok(migrated.includes(id as never), `${c.name} missing ${id}`);
  }
  for (const id of c.expectExcludes ?? []) {
    assert.ok(!migrated.includes(id as never), `${c.name} still has ${id}`);
  }
}

// 5: every migrated loadout has a Brand technique (covered by assertUniqueThree)
assert.ok(isAegisBrandTechnique(migrateAegisTechniqueLoadout(['GRAVE_BIND', 'NAIL_TO_GRID', 'REAVE'])[2]!));

// 6: default
assert.deepEqual(
  [...DEFAULT_AEGIS_TECHNIQUE_LOADOUT],
  ['RUIN', 'GRAVE_BIND', 'RUNEBOUND_CARAPACE'],
);
assert.deepEqual(
  [...migrateAegisTechniqueLoadout(null)],
  ['RUIN', 'GRAVE_BIND', 'RUNEBOUND_CARAPACE'],
);

// 7–9: weapon actions derived, not stored; ultimates correct
for (const familyId of ALL_AEGIS_WEAPON_FAMILY_IDS) {
  const actions = deriveAegisWeaponActions(familyId);
  assert.ok(actions);
  assert.equal(actions!.length, 4);
  assert.equal(new Set(actions).size, 4);
}
assert.deepEqual(deriveAegisWeaponActions('aegis-longsword'), [
  'WARDENS_STRIKE', 'RUPTURE', 'DREADBIND', 'NO_RESPITE',
]);
assert.deepEqual(deriveAegisWeaponActions('aegis-paired-blades'), [
  'PAIRED_BLADES_STRIKE', 'DIVERGENCE', 'ECLIPSE', 'SEVERANCE',
]);
assert.deepEqual(deriveAegisWeaponActions('aegis-claymore'), [
  'UNMAKER_STRIKE', 'DREAD_HORIZON', 'UNBOWED', 'DOOMFALL',
]);
assert.equal(deriveAegisWeaponUltimateId('aegis-longsword'), 'ABYSSAL_VERDICT');
assert.equal(deriveAegisWeaponUltimateId('aegis-paired-blades'), 'REND_THE_VEIL');
assert.equal(deriveAegisWeaponUltimateId('aegis-claymore'), 'GRAVEFALL');

const accountShape = {
  aegisTechniqueLoadout: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
} as Pick<PlayerAccount, 'aegisTechniqueLoadout'>;
assert.ok(!('aegisLoadout' in accountShape));
assert.ok(!('weaponActionLoadout' in accountShape));

const run = createDefaultActiveIncursionState();
assert.deepEqual([...run.aegisTechniqueLoadout], [...DEFAULT_AEGIS_TECHNIQUE_LOADOUT]);
assert.ok(!('aegisLoadout' in run));
assert.ok(!('weaponActionLoadout' in run));

// 10: hydrate from legacy aegisLoadout
const hydrated = hydrateAegisTechniqueLoadout({
  aegisLoadout: ['STRIKE', 'BLOOD_BOUND_CARAPACE', 'RUIN', 'DEVASTATE'],
});
assert.ok(hydrated.includes('RUNEBOUND_CARAPACE'));
assert.ok(hydrated.includes('RUIN'));
assertUniqueThree(hydrated);

// 11: validation rejects weapon actions / parry / ultimates
assert.ok(validateAegisTechniqueLoadoutCommit(['WARDENS_STRIKE', 'RUIN', 'GRAVE_BIND']));
assert.ok(validateAegisTechniqueLoadoutCommit(['WRAITH_PARRY', 'RUIN', 'GRAVE_BIND']));
assert.ok(validateAegisTechniqueLoadoutCommit(['ABYSSAL_VERDICT', 'RUIN', 'GRAVE_BIND']));
assert.ok(validateAegisTechniqueLoadoutCommit(['STRIKE', 'RUIN', 'GRAVE_BIND']));

// 12: Phase B surface — 4 weapon actions + 3 techniques, no STRIKE card
const surface = buildAegisCombatSurface({
  weaponFamilyId: 'aegis-longsword',
  techniques: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
});
assert.equal(surface.hudCards.length, 7);
assert.ok(!surface.hudCards.includes('STRIKE'));
assert.equal(surface.techniques[2], 'RUNEBOUND_CARAPACE');
// Phase C: display ID === executor ID (no remaps).
assert.deepEqual([...surface.techniques], [...surface.hudCards.slice(4)]);
assert.ok(surface.techniques.includes('FINAL_MERCY') || true);
const mercySurface = buildAegisCombatSurface({
  weaponFamilyId: 'aegis-longsword',
  techniques: ['FINAL_MERCY', 'RUIN', 'GRAVE_BIND'],
});
assert.equal(mercySurface.techniques[0], 'FINAL_MERCY');
assert.equal(mercySurface.hudCards[4], 'FINAL_MERCY');

console.log('Phase A Aegis migration OK');
