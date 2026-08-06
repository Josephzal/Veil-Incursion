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
  'aegis-runed-longsword': 'Runed Longsword',
  'aegis-rift-edge': 'Paired Blades',
  'aegis-claymore-blade': 'Unmaker',
  'hex-silver-core-sidearm': 'Silver-Core Sidearm',
  'hex-pulse-rifle': 'Ash Shotgun',
  'hex-void-cannon': 'Nullbreach',
  'envoy-echo-lantern': 'Vambrace',
  'envoy-null-conduit': 'Scythe',
  'envoy-sanguine-prism': "Heart's Due",
};

const EXPECTED_ULTIMATES: Record<string, string> = {
  'aegis-runed-longsword': 'THREEFOLD_BRAND',
  'aegis-rift-edge': 'REND_THE_VEIL',
  'aegis-claymore-blade': 'GRAVEFALL',
  'hex-silver-core-sidearm': 'SIXTH_SEAL',
  'hex-pulse-rifle': 'ZERO_PROTOCOL',
  'hex-void-cannon': 'LAST_KNOCK',
  'envoy-echo-lantern': 'FUNERAL_KNOT',
  'envoy-null-conduit': 'NULL_CIRCUIT',
  'envoy-sanguine-prism': 'CRIMSON_REFRACTION',
};

assert.equal(STARTER_WEAPON_BY_CLASS.ENVOY, 'envoy-echo-lantern');
assert.equal(getStarterWeaponForClass('ENVOY'), 'envoy-echo-lantern');
assert.equal(getWeaponFamily('envoy-echo-lantern').startingUnlocked, true);
assert.equal(getWeaponFamily('envoy-null-conduit').startingUnlocked, false);
assert.ok(getWeaponFamily('envoy-null-conduit').unlockRequirement.length > 0);
assert.equal(getWeaponFamily('envoy-echo-lantern').unlockRequirement.length, 0);

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

assert.equal(getWeaponAnchorAttack('envoy-echo-lantern').id, 'GRAVEWEAVE');
assert.equal(getWeaponAnchorAttack('envoy-echo-lantern').displayName, 'GRAVEWEAVE');
assert.equal(canonicalizeWeaponAnchorAttackId('BLACK_WICK'), 'GRAVEWEAVE');
assert.equal(canonicalizeWeaponAnchorAttackId('GRAVEWEAVE'), 'GRAVEWEAVE');
for (const retired of RETIRED_ANCHOR_DISPLAY_NAMES) {
  assert.notEqual(getWeaponAnchorAttack('envoy-echo-lantern').displayName, retired);
}

const ultimates = listWeaponUltimates();
assert.equal(ultimates.length, 9);
assert.equal(new Set(ultimates.map((u) => u.id)).size, 9);
assert.deepEqual(assertWeaponUltimateNamesMatchRegistry(), []);

assert.equal(
  resolveWeaponUltimateForEquipped('hex-pulse-rifle', 'HEX_SHOT')?.id,
  'ZERO_PROTOCOL',
);
assert.equal(
  resolveUltimateFromLegacyClassId('ZERO_PROTOCOL', 'hex-pulse-rifle')?.id,
  'ZERO_PROTOCOL',
);
assert.equal(
  resolveUltimateFromLegacyClassId('ZERO_PROTOCOL', 'hex-silver-core-sidearm'),
  null,
  'Silver-Core Sidearm must not inherit Ash Shotgun Zero Protocol',
);
assert.equal(
  resolveUltimateFromLegacyClassId('EVISCERATE', 'aegis-runed-longsword')?.id,
  'THREEFOLD_BRAND',
);
assert.equal(
  resolveUltimateFromLegacyClassId('EVISCERATE', 'aegis-rift-edge'),
  null,
  'Paired Blades must not inherit Longsword Eviscerate',
);
assert.equal(
  resolveUltimateFromLegacyClassId('CATACLYSM_SIGIL', 'envoy-null-conduit')?.id,
  'NULL_CIRCUIT',
);
assert.equal(
  resolveUltimateFromLegacyClassId('CATACLYSM_SIGIL', 'envoy-echo-lantern'),
  null,
);
assert.equal(formatWeaponUltimateLabel('hex-void-cannon'), '[ LAST KNOCK ]');
assert.ok(!formatWeaponUltimateLabel('hex-void-cannon').includes('The Black Door'));

// Migration: grant Vambrace; preserve Scythe ownership + equipped.
const fresh = createDefaultWeaponProgression();
assert.ok(fresh.weaponUnlocks.includes('envoy-echo-lantern'));
assert.equal(fresh.equippedWeaponByClass.ENVOY, 'envoy-echo-lantern');

const migrated = normalizeWeaponProgression({
  weaponUnlocks: ['envoy-null-conduit'],
  weaponTiers: { 'envoy-null-conduit': 2 },
  equippedWeaponByClass: { ENVOY: 'envoy-null-conduit' },
});
assert.ok(migrated.weaponUnlocks.includes('envoy-echo-lantern'), 'Vambrace entitlement granted');
assert.ok(migrated.weaponUnlocks.includes('envoy-null-conduit'), 'Scythe ownership preserved');
assert.equal(migrated.equippedWeaponByClass.ENVOY, 'envoy-null-conduit', 'do not force-swap equipped');
assert.equal(migrated.weaponTiers['envoy-null-conduit'], 2);

console.log('Phase WU-1 foundation OK — renames, Envoy starter, GRAVEWEAVE, ultimate registry');
