/**
 * Phase 3L — weapon-specific anchor attacks + canonical display-name repair.
 */
import assert from 'node:assert/strict';
import {
  ALL_WEAPON_FAMILY_IDS,
  getWeaponFamily,
  isWeaponFamilyId,
} from './weaponRegistry';
import {
  RETIRED_ANCHOR_DISPLAY_NAMES,
  RETIRED_WEAPON_DISPLAY_NAMES,
  WEAPON_ANCHOR_ATTACK_BY_FAMILY,
  assertNoRetiredWeaponDisplayName,
  canonicalizeWeaponAnchorAttackId,
  formatWeaponAnchorLabel,
  getWeaponAnchorAttack,
  listWeaponAnchorAttacks,
  toRuntimeClassBasicId,
} from './weaponAnchorAttackRegistry';
import { resolveWeaponAnchorCardPresentation } from './weaponAnchorCardPresentation';
import { formatAbilityLabel } from './classLoadoutEngine';
import { createDefaultWeaponRuntime } from './weaponRunState';
import { resolveWeaponState } from './weaponProgressionEngine';
import { formatHostileDisplayName } from '../utils/hostileDisplayName';
import { getWeaponIdentityProfile } from './weaponIdentityProfiles';
import { WEAPON_PLAYER_FACING_SUMMARIES } from './weaponPlayerFacing/weaponPlayerFacingCatalog';

console.log('Phase 3L — weapon anchor attack + naming suite');

const anchors = listWeaponAnchorAttacks();
assert.equal(anchors.length, 9);
assert.equal(ALL_WEAPON_FAMILY_IDS.length, 9);

const ids = anchors.map((a) => a.id);
const names = anchors.map((a) => a.displayName);
assert.equal(new Set(ids).size, 9, 'unique anchor IDs');
assert.equal(new Set(names).size, 9, 'unique anchor display names');

const EXPECTED: Record<string, { name: string; attack: string; label: string }> = {
  'aegis-runed-longsword': { name: 'Longsword', attack: 'WARDENS_STRIKE', label: "WARDEN'S STRIKE" },
  'aegis-rift-edge': { name: 'Paired Blades', attack: 'VEILSTEP_SLASH', label: 'VEILSTEP SLASH' },
  'aegis-claymore-blade': { name: 'Unmaker', attack: 'BREAKING_HEW', label: 'BREAKING HEW' },
  'hex-silver-core-sidearm': { name: 'Revolver', attack: 'SILVER_VERDICT', label: 'SILVER VERDICT' },
  'hex-void-cannon': { name: 'Black Door', attack: 'BREACH_ROUND', label: 'BREACH ROUND' },
  'hex-pulse-rifle': { name: 'Carbine', attack: 'CINDER_SWEEP', label: 'CINDER SWEEP' },
  'envoy-null-conduit': { name: 'Scythe', attack: 'NULL_ARC', label: 'NULL ARC' },
  'envoy-echo-lantern': { name: 'Vambrace', attack: 'GRAVEWEAVE', label: 'GRAVEWEAVE' },
  'envoy-sanguine-prism': { name: "Heart's Due", attack: 'BLOOD_REFRACTION', label: 'BLOOD REFRACTION' },
};

for (const familyId of ALL_WEAPON_FAMILY_IDS) {
  const expected = EXPECTED[familyId]!;
  const def = getWeaponFamily(familyId);
  const identity = getWeaponIdentityProfile(familyId);
  const anchor = getWeaponAnchorAttack(familyId);
  assert.equal(def.name, expected.name, `${familyId} registry name`);
  assert.equal(identity.liveDisplayName, expected.name, `${familyId} identity name`);
  assert.equal(anchor.id, expected.attack);
  assert.equal(anchor.displayName, expected.label);
  assert.ok(assertNoRetiredWeaponDisplayName(def.name));
  assert.ok(assertNoRetiredWeaponDisplayName(identity.liveDisplayName));

  const label = formatAbilityLabel(def.classId, anchor.classCompatId, familyId);
  assert.equal(label, `[ ${expected.label} ]`);
  assert.ok(!/\bSILVER_CORE_SIDEARM\b|\bVEIL_SPLINTER\b|WARDEN'S CUT|RIFTSTEP CUT|CLEAN DISCHARGE/i.test(label));
  assert.ok(label !== '[ STRIKE ]' && !/^\[\s*STRIKE\s*\]$/i.test(label));

  const card = resolveWeaponAnchorCardPresentation({
    classId: def.classId,
    abilityId: anchor.classCompatId,
    weapon: resolveWeaponState(familyId, 1),
    runtime: createDefaultWeaponRuntime(),
    pulseSpreadSecondaryCount: familyId === 'hex-pulse-rifle' ? 0 : 1,
    veilFlux: 20,
    operativeHp: 100,
    maxOperativeHp: 100,
    prismCanPayFullSacrifice: familyId === 'envoy-sanguine-prism' ? false : undefined,
  });
  assert.ok(card, `${familyId} card`);
  assert.equal(card!.anchor.id, expected.attack);
  assert.ok(card!.primaryOutcome.length > 0);
  assert.ok(card!.effectLine.includes(card!.primaryOutcome) || card!.effectLine.length > 0);
  assert.equal(card!.apCost, 1);

  // Stable permanent IDs remain valid.
  assert.ok(isWeaponFamilyId(familyId));
}

// Three Aegis weapons cannot share the same card presentation.
const aegisCards = (['aegis-runed-longsword', 'aegis-rift-edge', 'aegis-claymore-blade'] as const)
  .map((id) => formatAbilityLabel('AEGIS', 'STRIKE', id));
assert.equal(new Set(aegisCards).size, 3);

assert.equal(getWeaponFamily('aegis-rift-edge').name, 'Paired Blades');
assert.equal(getWeaponFamily('hex-void-cannon').name, 'Black Door');
assert.equal(formatWeaponAnchorLabel('aegis-runed-longsword'), "[ WARDEN'S STRIKE ]");
assert.equal(formatWeaponAnchorLabel('aegis-rift-edge'), '[ VEILSTEP SLASH ]');
assert.equal(formatWeaponAnchorLabel('envoy-null-conduit'), '[ NULL ARC ]');
assert.equal(formatWeaponAnchorLabel('envoy-echo-lantern'), '[ GRAVEWEAVE ]');
assert.equal(canonicalizeWeaponAnchorAttackId('BLACK_WICK'), 'GRAVEWEAVE');

// Legacy inputs normalize; never returned as live labels.
assert.equal(canonicalizeWeaponAnchorAttackId('WARDENS_CUT'), 'WARDENS_STRIKE');
assert.equal(canonicalizeWeaponAnchorAttackId('RIFTSTEP_CUT'), 'VEILSTEP_SLASH');
assert.equal(canonicalizeWeaponAnchorAttackId('CLEAN_DISCHARGE'), 'NULL_ARC');
assert.equal(canonicalizeWeaponAnchorAttackId('STRIKE', 'aegis-rift-edge'), 'VEILSTEP_SLASH');
assert.equal(toRuntimeClassBasicId('VEILSTEP_SLASH', 'aegis-rift-edge'), 'STRIKE');
assert.equal(toRuntimeClassBasicId('NULL_ARC', 'envoy-null-conduit'), 'VEIL_SPLINTER');
assert.equal(toRuntimeClassBasicId('GRAVEWEAVE', 'envoy-echo-lantern'), 'VEIL_SPLINTER');
assert.equal(canonicalizeWeaponAnchorAttackId('VEIL_SPLINTER'), 'GRAVEWEAVE');

for (const retired of RETIRED_WEAPON_DISPLAY_NAMES) {
  for (const familyId of ALL_WEAPON_FAMILY_IDS) {
    assert.ok(!getWeaponFamily(familyId).name.includes(retired));
    assert.ok(!WEAPON_PLAYER_FACING_SUMMARIES[familyId].displayName.includes(retired));
  }
}
for (const retired of RETIRED_ANCHOR_DISPLAY_NAMES) {
  for (const anchor of anchors) {
    assert.notEqual(anchor.displayName, retired);
  }
}

// Enemy intel / turn-order never expose underscores.
assert.equal(formatHostileDisplayName('MIASMA TICK SWARM'), 'MIASMA TICK SWARM');
assert.equal(formatHostileDisplayName('MIASMA_TICK_SWARM'), 'MIASMA TICK SWARM');
assert.ok(!formatHostileDisplayName('DREAD CHORISTER').includes('_'));

console.log('Phase 3L weapon-anchor naming OK — 9 unique anchors, WU-1 display names + GRAVEWEAVE');
