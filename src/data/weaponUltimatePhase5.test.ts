/**
 * WU-5 — HUD / log / telemetry surfaces + boon/graft compatibility.
 * Phase D / E.1d.1: Aegis ultimates stay ungraftable even with allowUltimate: true.
 * Hex/Envoy ultimate graft paths remain allowUltimate-gated.
 * Run: npx tsx src/data/weaponUltimatePhase5.test.ts
 */
import assert from 'node:assert/strict';
import {
  formatWeaponUltimateLabel,
  formatWeaponUltimateLogTag,
  getWeaponUltimate,
  listWeaponUltimates,
} from './weaponUltimateRegistry';
import {
  assertNoRetiredUltimatePlayerFacing,
  formatWeaponUltimateReadyCallout,
  formatWeaponUltimateReadyChip,
  resolveWeaponUltimateActionTags,
  resolveWeaponUltimateDisplayName,
  resolveWeaponUltimateLegacyHookAbilityId,
  weaponUltimateActionHasUltimateTag,
} from './weaponUltimateSurfaceEngine';
import { resolveWeaponCombatCallouts } from './weaponPlayerFacing/weaponPlayerFacingEngine';
import { boonMatchesEnvoyAction, boonMatchesHexAction } from './classBoonEngine';
import { canGraftClassAbility } from './classGraftEngine';
import { classifyAbilitySocket } from './graftSynergy/graftCapacityEngine';
import { ALL_WEAPON_FAMILY_IDS } from './weaponRegistry';

console.log('Phase WU-5 — ultimate surfaces + compatibility');

for (const familyId of ALL_WEAPON_FAMILY_IDS) {
  const name = resolveWeaponUltimateDisplayName(familyId);
  assert.ok(name);
  assert.equal(name, getWeaponUltimate(familyId).displayName);
  assert.equal(formatWeaponUltimateReadyChip(familyId), name);
  assert.equal(formatWeaponUltimateReadyCallout(familyId), `${name} READY`);
  assert.deepEqual(assertNoRetiredUltimatePlayerFacing(name), []);
  assert.deepEqual(assertNoRetiredUltimatePlayerFacing(formatWeaponUltimateLogTag(familyId)), []);
  assert.deepEqual(assertNoRetiredUltimatePlayerFacing(formatWeaponUltimateLabel(familyId)), []);

  const hook = resolveWeaponUltimateLegacyHookAbilityId(familyId);
  assert.ok(hook);
  assert.ok(weaponUltimateActionHasUltimateTag(hook, getWeaponUltimate(familyId).classId));
  assert.ok(resolveWeaponUltimateActionTags(getWeaponUltimate(familyId).id).includes('ULTIMATE'));
}

assert.equal(resolveWeaponUltimateLegacyHookAbilityId('aegis-paired-blades'), 'EVISCERATE');
assert.equal(resolveWeaponUltimateLegacyHookAbilityId('hex-shotgun'), 'ZERO_PROTOCOL');
assert.equal(resolveWeaponUltimateLegacyHookAbilityId('envoy-vambrace'), 'CATACLYSM_SIGIL');

const rendReady = resolveWeaponCombatCallouts({
  weaponFamilyId: 'aegis-paired-blades',
  operativeClass: 'AEGIS',
  abyssalReserve: 100,
  weaponUltimateReady: true,
  weaponUltimateDisplayName: 'REND THE VEIL',
});
assert.ok(rendReady.some((c) => c.label === 'REND THE VEIL READY'));

const sixthReady = resolveWeaponCombatCallouts({
  weaponFamilyId: 'hex-revolver',
  operativeClass: 'HEX_SHOT',
  hexProtocolCharges: 3,
  hexMaxProtocolCharges: 3,
  weaponUltimateReady: true,
  weaponUltimateDisplayName: 'SIXTH SEAL',
});
assert.ok(sixthReady.some((c) => c.label === 'SIXTH SEAL READY'));
assert.ok(!sixthReady.some((c) => c.label === 'ZERO PROTOCOL READY'));

const funeralReady = resolveWeaponCombatCallouts({
  weaponFamilyId: 'envoy-vambrace',
  operativeClass: 'ENVOY',
  veilRotStacksTotal: 6,
  weaponUltimateReady: true,
  weaponUltimateDisplayName: 'FUNERAL KNOT',
});
assert.ok(funeralReady.some((c) => c.label === 'FUNERAL KNOT READY'));

// ULTIMATE-tagged boons still match via legacy hook IDs
assert.equal(
  boonMatchesHexAction(['ZERO_POINT_EXTRACTION'], 'ZERO_POINT_EXTRACTION', 'ZERO_PROTOCOL'),
  true,
);
assert.equal(
  boonMatchesEnvoyAction(['CATACLYSMIC_ECHO'], 'CATACLYSMIC_ECHO', 'CATACLYSM_SIGIL'),
  true,
);
assert.equal(
  boonMatchesEnvoyAction(['CATACLYSMIC_ECHO'], 'CATACLYSMIC_ECHO', 'FUNERAL_KNOT'),
  true,
);
assert.equal(
  boonMatchesHexAction(['ZERO_POINT_EXTRACTION'], 'ZERO_POINT_EXTRACTION', 'LAST_KNOCK'),
  true,
);

// Phase D / E.1d.1 — Aegis ultimates remain ungraftable even when rank-15 allowUltimate is true.
// Hex/Envoy ultimate graft paths are unchanged.
assert.equal(canGraftClassAbility('AEGIS', 'REND_THE_VEIL', { allowUltimate: true }), false);
assert.equal(canGraftClassAbility('AEGIS', 'REND_THE_VEIL', { allowUltimate: false }), false);
assert.equal(canGraftClassAbility('AEGIS', 'ABYSSAL_VERDICT', { allowUltimate: true }), false);
assert.equal(canGraftClassAbility('AEGIS', 'GRAVEFALL', { allowUltimate: true }), false);
assert.equal(canGraftClassAbility('AEGIS', 'THREEFOLD_BRAND', { allowUltimate: true }), false);
assert.equal(canGraftClassAbility('AEGIS', 'EVISCERATE', { allowUltimate: true }), false);
assert.equal(canGraftClassAbility('HEX_SHOT', 'LAST_KNOCK', { allowUltimate: true }), true);
assert.equal(canGraftClassAbility('ENVOY', 'CRIMSON_REFRACTION', { allowUltimate: true }), true);

assert.equal(classifyAbilitySocket('AEGIS', 'GRAVEFALL'), 'ULTIMATE');
assert.equal(classifyAbilitySocket('HEX_SHOT', 'SIXTH_SEAL'), 'ULTIMATE');
assert.equal(classifyAbilitySocket('ENVOY', 'FUNERAL_KNOT'), 'ULTIMATE');

assert.equal(listWeaponUltimates().length, 9);

console.log('Phase WU-5 OK — HUD labels, ready callouts, ultimate tag/graft compatibility');
