/**
 * Hex Shot Phase H.1a — chassis authority normalization.
 * Run: npx tsx src/data/hexShotPhaseH1a.test.ts
 */
import assert from 'node:assert/strict';
import {
  assertHexDisplaySurfacesCanonical,
  applyRetiredClassWideChamberBonus,
  failedReloadFirstShotDamageScale,
  getHexCanonicalDisplayName,
  HEX_H1A_CANONICAL_DISPLAY_NAMES,
  HEX_H1A_LEGACY_PRESENTATION_ALIASES,
  HEX_LEGACY_CHAMBER_DAMAGE_MULT,
  isHexLegacyPresentationAlias,
  ordinaryReloadFirstShotMultiplierOrder,
  perfectOverchargeDamageScale,
  protocolReadyForWeaponUltimate,
  resolveOrdinaryReload,
  resolveUltimateOwnedMagazineRefill,
  simulateSixthSealProtocolAndOwnedRefill,
  SIXTH_SEAL_COMMIT_STEPS,
  spendProtocolCharges,
} from './hexShotPhaseH1aEngine';
import { createInitialHexShotCombatState, evaluateZeroProtocolReady } from '../types/hexShotState';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import { HEX_MAGAZINE_CONFIG } from '../types/hexAmmo';
import { getWeaponFamily } from './weaponRegistry';
import { getWeaponIdentityProfile } from './weaponIdentityProfiles';
import {
  getWeaponAnchorAttack,
  RETIRED_WEAPON_DISPLAY_NAMES,
} from './weaponAnchorAttackRegistry';
import {
  canFireLegacyClassUltimate,
  canFireWeaponUltimate,
  getWeaponUltimate,
  resolveWeaponUltimateForEquipped,
} from './weaponUltimateRegistry';
import { planSixthSeal, planLastKnock } from './weaponUltimateNewResolveEngine';
import { resolveHexBasicShot } from './weaponBasicEngine';
import { createDefaultWeaponProgression, resolveWeaponState } from './weaponProgressionEngine';
import { hexShotReducer } from '../reducers/hexShotReducer';
import type { EnemyCombatProfile } from '../types/run';

console.log('Phase H.1a — Hex Shot chassis authority normalization');

const HEX_IDS = [
  'hex-revolver',
  'hex-shotgun',
  'hex-carbine',
] as const;

const emptyEnc = createDefaultClassCombatEncounterState();

function baseHex(ammo = 0, protocol = 0) {
  return createInitialHexShotCombatState({
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    ap: 3,
    ammo,
    maxAmmo: 6,
    protocolCharges: protocol,
  });
}

// ── Naming ──────────────────────────────────────────────────────────────
for (const id of HEX_IDS) {
  const expected = HEX_H1A_CANONICAL_DISPLAY_NAMES[id];
  assert.equal(getHexCanonicalDisplayName(id), expected);
  assert.deepEqual(assertHexDisplaySurfacesCanonical(id), [], `${id} display surfaces`);
  assert.equal(getWeaponFamily(id).id, id, `${id} persistent id stable`);
  assert.equal(getWeaponIdentityProfile(id).id, id);
  assert.ok(!isHexLegacyPresentationAlias(getWeaponFamily(id).name));
}
for (const alias of HEX_H1A_LEGACY_PRESENTATION_ALIASES) {
  assert.ok(
    (RETIRED_WEAPON_DISPLAY_NAMES as readonly string[]).includes(alias),
    `${alias} listed as retired`,
  );
  for (const id of HEX_IDS) {
    assert.notEqual(getWeaponFamily(id).name, alias);
    assert.notEqual(getWeaponIdentityProfile(id).liveDisplayName, alias);
    assert.notEqual(getWeaponAnchorAttack(id).weaponDisplayName, alias);
    assert.notEqual(getWeaponUltimate(id).weaponDisplayName, alias);
  }
}
// Saves / unlocks remain ID-backed — no display-name migration required.
const progression = createDefaultWeaponProgression();
assert.ok(progression.weaponUnlocks.includes('hex-revolver'));
assert.equal(progression.equippedWeaponByClass.HEX_SHOT, 'hex-revolver');

// Fixed-basic family routing unchanged after rename
const primary: EnemyCombatProfile = {
  unitId: 'e1',
  designation: 'TEST',
  currentHp: 40,
  maxHp: 100,
  gridSlot: 'FL_1',
} as EnemyCombatProfile;
const adj: EnemyCombatProfile = {
  unitId: 'e2',
  designation: 'TEST2',
  currentHp: 50,
  maxHp: 100,
  gridSlot: 'FL_0',
} as EnemyCombatProfile;
const squad = [primary, adj];
for (const id of HEX_IDS) {
  const plan = resolveHexBasicShot({
    weapon: resolveWeaponState(id),
    squad,
    primaryTargetId: 'e1',
    catalogBaseDamage: 10,
  });
  assert.equal(plan.familyId, id, `${id} basic routing`);
  assert.ok(plan.hits.length >= 1, `${id} basic hits`);
  assert.equal(plan.ammoCost, 1);
}
assert.equal(
  resolveHexBasicShot({
    weapon: resolveWeaponState('hex-revolver'),
    squad,
    primaryTargetId: 'e1',
    catalogBaseDamage: 10,
  }).delivery,
  'PRECISION',
);
assert.equal(
  resolveHexBasicShot({
    weapon: resolveWeaponState('hex-shotgun'),
    squad,
    primaryTargetId: 'e1',
    catalogBaseDamage: 10,
  }).delivery,
  'BREACH',
);
assert.equal(
  resolveHexBasicShot({
    weapon: resolveWeaponState('hex-carbine'),
    squad,
    primaryTargetId: 'e1',
    catalogBaseDamage: 10,
  }).delivery,
  'SPREAD',
);

// ── Reload grades / Chamber retirement ──────────────────────────────────
assert.equal(HEX_LEGACY_CHAMBER_DAMAGE_MULT, 1.0);
assert.equal(perfectOverchargeDamageScale(), 1.2);
assert.equal(failedReloadFirstShotDamageScale(), 0.9);
assert.deepEqual(applyRetiredClassWideChamberBonus(100, true), {
  damage: 100,
  applied: false,
  multiplier: 1.0,
});

// Probe 1 — CLEAN
{
  let s = baseHex(0, 0);
  s = resolveOrdinaryReload(s, 'CLEAN', 'SILVER_CORE');
  assert.equal(s.ammo, 6);
  assert.equal(s.protocolCharges, 0);
  assert.equal(s.nextShotOvercharged, false);
  assert.equal(s.overchargeMultiplier, 0);
  assert.equal(s.firstShotPenaltyPending, false);
  assert.equal(s.currentAmmoType, 'SILVER_CORE');
  assert.equal(ordinaryReloadFirstShotMultiplierOrder('CLEAN').aggregate, 1);
}
// Probe 2 — PERFECT at Protocol 0
{
  let s = baseHex(0, 0);
  s = resolveOrdinaryReload(s, 'PERFECT', 'WRAITHGLASS');
  assert.equal(s.ammo, 6);
  assert.equal(s.protocolCharges, 1);
  assert.equal(s.nextShotOvercharged, true);
  assert.equal(s.overchargeMultiplier, HEX_MAGAZINE_CONFIG.overchargedDamagePct / 100);
  assert.equal(s.firstShotPenaltyPending, false);
  assert.equal(ordinaryReloadFirstShotMultiplierOrder('PERFECT').aggregate, 1.2);
  assert.ok(!ordinaryReloadFirstShotMultiplierOrder('PERFECT').factors.some((f) => f.includes('chamber')));
}
// Probe 3 — PERFECT at Protocol 3 (capped)
{
  let s = baseHex(0, 3);
  s = resolveOrdinaryReload(s, 'PERFECT', 'STASIS_LOCK');
  assert.equal(s.protocolCharges, 3);
  assert.equal(s.nextShotOvercharged, true);
}
// Probe 4 — FAILED
{
  let s = baseHex(0, 1);
  s = resolveOrdinaryReload(s, 'FAILED', 'SILVER_CORE');
  assert.equal(s.ammo, 6);
  assert.equal(s.protocolCharges, 1);
  assert.equal(s.nextShotOvercharged, false);
  assert.equal(s.firstShotPenaltyPending, true);
  assert.equal(ordinaryReloadFirstShotMultiplierOrder('FAILED').aggregate, 0.9);
}
// Cancel / invalid begin reload — no mutation when AP insufficient
{
  const s0 = baseHex(3, 0);
  s0.ap = 0;
  const s1 = hexShotReducer(s0, { type: 'HEX_BEGIN_RELOAD', manual: true });
  assert.equal(s1.ammo, s0.ammo);
  assert.equal(s1.protocolCharges, s0.protocolCharges);
  assert.equal(s1.ap, 0);
}
// Full magazine + PERFECT still only +1 Protocol (no farm outside contract)
{
  let s = baseHex(6, 0);
  s = resolveOrdinaryReload(s, 'PERFECT', 'SILVER_CORE');
  assert.equal(s.protocolCharges, 1);
}

// Probe 5 — PERFECT then first eligible shot scale is +20% without Chamber ×1.15
{
  const base = 100;
  const afterChamber = applyRetiredClassWideChamberBonus(base, true).damage;
  const withOc = Math.floor(afterChamber * perfectOverchargeDamageScale());
  assert.equal(withOc, 120);
  assert.notEqual(Math.floor(base * 1.15 * 1.2), withOc);
}

// ── Sixth Seal ──────────────────────────────────────────────────────────
assert.deepEqual(
  [...SIXTH_SEAL_COMMIT_STEPS],
  ['VALIDATE_TARGET', 'SPEND_PROTOCOL', 'ULTIMATE_OWNED_REFILL', 'PRECISION_SHOTS', 'EMPTY_MAGAZINE'],
);

// Probe 7 — Protocol 2 cannot ready ultimate
{
  const s = baseHex(0, 2);
  assert.equal(protocolReadyForWeaponUltimate(s), false);
  assert.equal(evaluateZeroProtocolReady(s), false);
}
// Probe 6 — Cancel at Protocol 3 leaves state (no spend helper called)
{
  const s = baseHex(2, 3);
  assert.equal(protocolReadyForWeaponUltimate(s), true);
  assert.equal(evaluateZeroProtocolReady(s), true);
  assert.equal(s.protocolCharges, 3);
  assert.equal(s.ammo, 2);
}
// Probe 8 + 9 — commit spends 3 once; internal refill generates 0 Protocol / no OC / no fail
{
  const s = baseHex(0, 3);
  s.currentAmmoType = 'SILVER_CORE';
  s.nextShotOvercharged = false;
  const sim = simulateSixthSealProtocolAndOwnedRefill(s);
  assert.equal(sim.protocolSpent, 3);
  assert.equal(sim.afterSpend.protocolCharges, 0);
  assert.equal(sim.protocolGainedFromRefill, 0);
  assert.equal(sim.overchargeArmedByRefill, false);
  assert.equal(sim.failPenaltyArmedByRefill, false);
  assert.equal(sim.afterRefill.ammo, 6);
  assert.equal(sim.afterRefill.currentAmmoType, 'SILVER_CORE');
  assert.equal(sim.afterRefill.calibratedAmmoTypes.length, 0);
  assert.equal(sim.afterRefill.nextShotOvercharged, false);
  assert.equal(sim.afterRefill.firstShotPenaltyPending, false);
}
// Ultimate-owned refill alone (no ordinary reload rewards)
{
  let s = baseHex(1, 2);
  s.nextShotOvercharged = true;
  s.overchargeMultiplier = 0.2;
  s.firstShotPenaltyPending = false;
  const protocolBefore = s.protocolCharges;
  s = resolveUltimateOwnedMagazineRefill(s);
  assert.equal(s.ammo, 6);
  assert.equal(s.protocolCharges, protocolBefore);
  assert.equal(s.nextShotOvercharged, true);
  assert.equal(s.calibratedAmmoTypes.length, 0);
}
// Damage / grade matrices unchanged
{
  const perfect = planSixthSeal({ grade: 'PERFECT', magSize: 6 });
  const clean = planSixthSeal({ grade: 'CLEAN', magSize: 6 });
  const standard = planSixthSeal({ grade: 'STANDARD', magSize: 6 });
  assert.equal(perfect.reloadQuality, 'PERFECT');
  assert.equal(clean.reloadQuality, 'ACTIVE');
  assert.equal(standard.reloadQuality, 'NORMAL');
  assert.equal(perfect.precisionShots, 3);
  assert.equal(perfect.emptyMagazineAfter, true);
  assert.ok(perfect.notes.some((n) => n.includes('ultimate-owned')));
}

// ── Cross-family ultimates ──────────────────────────────────────────────
assert.equal(getWeaponUltimate('hex-revolver').id, 'SIXTH_SEAL');
assert.equal(getWeaponUltimate('hex-shotgun').id, 'LAST_KNOCK');
assert.equal(getWeaponUltimate('hex-carbine').id, 'ZERO_PROTOCOL');
assert.equal(resolveWeaponUltimateForEquipped('hex-carbine', 'HEX_SHOT')?.id, 'ZERO_PROTOCOL');
assert.equal(canFireLegacyClassUltimate('ZERO_PROTOCOL', 'hex-carbine'), true);
assert.equal(canFireLegacyClassUltimate('ZERO_PROTOCOL', 'hex-revolver'), false);
assert.equal(canFireLegacyClassUltimate('ZERO_PROTOCOL', 'hex-shotgun'), false);
assert.ok(canFireWeaponUltimate('hex-revolver'));
assert.ok(canFireWeaponUltimate('hex-shotgun'));
assert.ok(canFireWeaponUltimate('hex-carbine'));

// Probe 10 — Last Knock plan + Protocol spend once
{
  let s = baseHex(3, 3);
  const knock = planLastKnock({ grade: 'CLEAN', currentAmmo: 3, baseBallistic: 16 });
  assert.ok(!('blocked' in knock));
  s = spendProtocolCharges(s);
  assert.equal(s.protocolCharges, 0);
}
// Probe 11 — Zero Protocol Ash Shotgun only + Protocol spend
{
  let s = baseHex(6, 3);
  assert.ok(evaluateZeroProtocolReady(s));
  const fullMag = baseHex(6, 0);
  assert.equal(evaluateZeroProtocolReady(fullMag), false);
  s = spendProtocolCharges(s);
  assert.equal(s.protocolCharges, 0);
  assert.equal(s.ammo, 6);
}

// Probe 13 — Aegis / Envoy untouched by Hex display rename
assert.equal(getWeaponFamily('aegis-longsword').name, 'Longsword');
assert.equal(getWeaponFamily('envoy-vambrace').name, 'Vambrace');
assert.equal(getWeaponUltimate('aegis-longsword').id, 'THREEFOLD_BRAND');
assert.equal(getWeaponUltimate('envoy-scythe').id, 'NULL_CIRCUIT');

assert.equal(emptyEnc.chamberBonusReady, false);

console.log('Phase H.1a — all assertions passed');
