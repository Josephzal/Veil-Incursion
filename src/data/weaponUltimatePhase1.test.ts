/**
 * Phase 1 foundation — weapon display renames, Envoy starter → Vambrace,
 * GRAVEWEAVE anchor, ultimate registry skeleton (no interaction wiring).
 */
import assert from 'node:assert/strict';
import {
  ALL_WEAPON_FAMILY_IDS,
  getStarterWeaponForClass,
  getWeaponFamily,
  STARTER_WEAPON_BY_CLASS,
} from './weaponRegistry';
import {
  canonicalizeWeaponAnchorAttackId,
  getWeaponAnchorAttack,
  RETIRED_ANCHOR_DISPLAY_NAMES,
  RETIRED_WEAPON_DISPLAY_NAMES,
} from './weaponAnchorAttackRegistry';
import {
  assertWeaponUltimateNamesMatchRegistry,
  formatWeaponUltimateLabel,
  getWeaponUltimate,
  listWeaponUltimates,
  resolveUltimateFromLegacyClassId,
  resolveWeaponUltimateForEquipped,
} from './weaponUltimateRegistry';
import {
  createDefaultWeaponProgression,
  normalizeWeaponProgression,
} from './weaponProgressionEngine';
import { getWeaponIdentityProfile } from './weaponIdentityProfiles';

console.log('Phase WU-1 — weapon ultimate foundation suite');

const EXPECTED_NAMES: Record<string, string> = {
  'aegis-longsword': 'Longsword',
  'aegis-paired-blades': 'Paired Blades',
  'aegis-claymore': 'Claymore',
  'hex-revolver': 'Revolver',
  'hex-carbine': 'Carbine',
  'hex-shotgun': 'Shotgun',
  'envoy-vambrace': 'Vambrace',
  'envoy-scythe': 'Scythe',
  'envoy-sanguine-prism': 'Sanguine Prism',
};

const EXPECTED_ULTIMATES: Record<string, string> = {
  'aegis-longsword': 'THREEFOLD_BRAND',
  'aegis-paired-blades': 'REND_THE_VEIL',
  'aegis-claymore': 'GRAVEFALL',
  'hex-revolver': 'SIXTH_SEAL',
  'hex-carbine': 'ZERO_PROTOCOL',
  'hex-shotgun': 'LAST_KNOCK',
  'envoy-vambrace': 'FUNERAL_KNOT',
  'envoy-scythe': 'NULL_CIRCUIT',
  'envoy-sanguine-prism': 'CRIMSON_REFRACTION',
};

assert.equal(STARTER_WEAPON_BY_CLASS.ENVOY, 'envoy-vambrace');
assert.equal(getStarterWeaponForClass('ENVOY'), 'envoy-vambrace');
assert.equal(getWeaponFamily('envoy-vambrace').startingUnlocked, true);
assert.equal(getWeaponFamily('envoy-scythe').startingUnlocked, false);
assert.ok(getWeaponFamily('envoy-scythe').unlockRequirement.length > 0);
assert.equal(getWeaponFamily('envoy-vambrace').unlockRequirement.length, 0);

for (const familyId of ALL_WEAPON_FAMILY_IDS) {
  const name = EXPECTED_NAMES[familyId]!;
  const def = getWeaponFamily(familyId);
  const identity = getWeaponIdentityProfile(familyId);
  const anchor = getWeaponAnchorAttack(familyId);
  const ultimate = getWeaponUltimate(familyId);
  assert.equal(def.name, name, `${familyId} registry name`);
  assert.equal(identity.liveDisplayName, name, `${familyId} identity`);
  assert.equal(anchor.weaponDisplayName, name);
  assert.equal(ultimate.weaponDisplayName, name);
  assert.equal(ultimate.id, EXPECTED_ULTIMATES[familyId]);
  assert.equal(ultimate.status, 'WIRED', `${familyId} wire status`);
  for (const retired of RETIRED_WEAPON_DISPLAY_NAMES) {
    assert.ok(!def.name.includes(retired), `${familyId} still shows retired ${retired}`);
  }
}

assert.equal(getWeaponAnchorAttack('envoy-vambrace').id, 'GRAVEWEAVE');
assert.equal(getWeaponAnchorAttack('envoy-vambrace').displayName, 'GRAVEWEAVE');
assert.equal(canonicalizeWeaponAnchorAttackId('BLACK_WICK'), 'GRAVEWEAVE');
assert.equal(canonicalizeWeaponAnchorAttackId('GRAVEWEAVE'), 'GRAVEWEAVE');
for (const retired of RETIRED_ANCHOR_DISPLAY_NAMES) {
  assert.notEqual(getWeaponAnchorAttack('envoy-vambrace').displayName, retired);
}

const ultimates = listWeaponUltimates();
assert.equal(ultimates.length, 9);
assert.equal(new Set(ultimates.map((u) => u.id)).size, 9);
assert.deepEqual(assertWeaponUltimateNamesMatchRegistry(), []);

assert.equal(
  resolveWeaponUltimateForEquipped('hex-carbine', 'HEX_SHOT')?.id,
  'ZERO_PROTOCOL',
);
assert.equal(
  resolveUltimateFromLegacyClassId('ZERO_PROTOCOL', 'hex-carbine')?.id,
  'ZERO_PROTOCOL',
);
assert.equal(
  resolveUltimateFromLegacyClassId('ZERO_PROTOCOL', 'hex-revolver'),
  null,
  'Revolver must not inherit Carbine Zero Protocol',
);
assert.equal(
  resolveUltimateFromLegacyClassId('EVISCERATE', 'aegis-longsword')?.id,
  'THREEFOLD_BRAND',
);
assert.equal(
  resolveUltimateFromLegacyClassId('EVISCERATE', 'aegis-paired-blades'),
  null,
  'Paired Blades must not inherit Longsword Eviscerate',
);
assert.equal(
  resolveUltimateFromLegacyClassId('CATACLYSM_SIGIL', 'envoy-scythe')?.id,
  'NULL_CIRCUIT',
);
assert.equal(
  resolveUltimateFromLegacyClassId('CATACLYSM_SIGIL', 'envoy-vambrace'),
  null,
);
assert.equal(formatWeaponUltimateLabel('hex-shotgun'), '[ LAST KNOCK ]');
assert.ok(!formatWeaponUltimateLabel('hex-shotgun').includes('The Black Door'));

// Migration: grant Vambrace; preserve Scythe ownership + equipped; strip weaponTiers.
const fresh = createDefaultWeaponProgression();
assert.ok(fresh.weaponUnlocks.includes('envoy-vambrace'));
assert.equal(fresh.equippedWeaponByClass.ENVOY, 'envoy-vambrace');

const migrated = normalizeWeaponProgression({
  weaponUnlocks: ['envoy-scythe'],
  weaponTiers: { 'envoy-scythe': 2 },
  equippedWeaponByClass: { ENVOY: 'envoy-scythe' },
});
assert.ok(migrated.weaponUnlocks.includes('envoy-vambrace'), 'Vambrace entitlement granted');
assert.ok(migrated.weaponUnlocks.includes('envoy-scythe'), 'Scythe ownership preserved');
assert.equal(migrated.equippedWeaponByClass.ENVOY, 'envoy-scythe', 'do not force-swap equipped');
assert.equal('weaponTiers' in migrated, false);

console.log('Phase WU-1 foundation OK — renames, Envoy starter, GRAVEWEAVE, ultimate registry');
