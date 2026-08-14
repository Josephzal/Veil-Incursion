import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CANONICAL_WEAPON_FAMILY_IDS,
  LEGACY_WEAPON_FAMILY_ID_MAP,
  normalizeWeaponFamilyId,
} from './weaponFamilyIdNormalize';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily, WEAPON_REGISTRY } from './weaponRegistry';
import { getWeaponIdentityProfile } from './weaponIdentityProfiles';
import { resolveWeaponState } from './weaponProgressionEngine';
import {
  resolveHexBasicShot,
  NULLBREACH_INNATE_ARMOR_PRESSURE_LAYERS,
} from './weaponBasicEngine';
import { createDefaultWeaponRuntime, hydrateWeaponIncursionFields } from './weaponRunState';

console.log('Stage A.1 — canonical weapon family IDs');

assert.equal(CANONICAL_WEAPON_FAMILY_IDS.length, 9);
assert.deepEqual([...ALL_WEAPON_FAMILY_IDS], [...CANONICAL_WEAPON_FAMILY_IDS]);

const expected = {
  'aegis-longsword': 'Longsword',
  'aegis-paired-blades': 'Paired Blades',
  'aegis-claymore': 'Claymore',
  'hex-revolver': 'Revolver',
  'hex-carbine': 'Carbine',
  'hex-shotgun': 'Shotgun',
  'envoy-vambrace': 'Vambrace',
  'envoy-scythe': 'Scythe',
  'envoy-sanguine-prism': 'Sanguine Prism',
} as const;

for (const id of CANONICAL_WEAPON_FAMILY_IDS) {
  assert.equal(normalizeWeaponFamilyId(id), id, id);
  assert.equal(getWeaponFamily(id).name, expected[id]);
  assert.equal(getWeaponIdentityProfile(id).liveDisplayName, expected[id]);
}

assert.equal(normalizeWeaponFamilyId('aegis-runed-longsword'), 'aegis-longsword');
assert.equal(normalizeWeaponFamilyId('aegis-rift-edge'), 'aegis-paired-blades');
assert.equal(normalizeWeaponFamilyId('aegis-claymore-blade'), 'aegis-claymore');
assert.equal(normalizeWeaponFamilyId('hex-silver-core-sidearm'), 'hex-revolver');
assert.equal(normalizeWeaponFamilyId('hex-pulse-rifle'), 'hex-carbine');
assert.equal(normalizeWeaponFamilyId('hex-void-cannon'), 'hex-shotgun');
assert.equal(normalizeWeaponFamilyId('envoy-echo-lantern'), 'envoy-vambrace');
assert.equal(normalizeWeaponFamilyId('envoy-null-conduit'), 'envoy-scythe');
assert.equal(normalizeWeaponFamilyId('envoy-sanguine-prism'), 'envoy-sanguine-prism');

for (const [legacy, canonical] of Object.entries(LEGACY_WEAPON_FAMILY_ID_MAP)) {
  assert.equal(normalizeWeaponFamilyId(legacy), canonical);
  if (legacy !== canonical) {
    assert.equal(legacy in WEAPON_REGISTRY, false, `${legacy} must not be a live registry key`);
  }
}

const carbine = resolveHexBasicShot({
  weapon: resolveWeaponState('hex-carbine'),
  squad: [
    { unitId: 'e1', currentHp: 40, maxHp: 100, gridSlot: 'FL_1' } as never,
    { unitId: 'e2', currentHp: 50, maxHp: 100, gridSlot: 'FL_0' } as never,
  ],
  primaryTargetId: 'e1',
  catalogBaseDamage: 10,
});
assert.equal(carbine.delivery, 'SPREAD');
assert.ok(carbine.hits.length >= 2);
assert.ok((getWeaponIdentityProfile('hex-carbine').debugNotes ?? '').includes('Ash Shotgun'));

const shotgun = resolveHexBasicShot({
  weapon: resolveWeaponState('hex-shotgun'),
  squad: [
    { unitId: 'e1', currentHp: 40, maxHp: 100, gridSlot: 'FL_1', kineticArmor: 1 } as never,
  ],
  primaryTargetId: 'e1',
  catalogBaseDamage: 10,
});
assert.equal(shotgun.delivery, 'BREACH');
assert.equal(shotgun.hits.length, 1);
assert.equal(shotgun.innateArmorPressureLayers, NULLBREACH_INNATE_ARMOR_PRESSURE_LAYERS);
assert.ok(getWeaponIdentityProfile('hex-shotgun').mechanicalTags.includes('ARMOR_PIERCE'));
assert.ok((getWeaponIdentityProfile('hex-shotgun').debugNotes ?? '').includes('Nullbreach'));

const hydrated = hydrateWeaponIncursionFields({
  activeWeaponFamilyId: 'hex-void-cannon' as never,
  weaponRuntime: createDefaultWeaponRuntime(),
}, 'HEX_SHOT');
assert.equal(hydrated.activeWeaponFamilyId, 'hex-shotgun');

const hub = readFileSync(join(import.meta.dirname, '../components/TacticalCombatHub.tsx'), 'utf8');
assert.ok(hub.includes('createNineStrainCombatBridge'));
assert.ok(hub.includes('normalizeWeaponFamilyId'));
assert.equal(hub.includes('aegis-runed-longsword'), false);

console.log('Stage A.1 — canonical weapon family IDs passed');
