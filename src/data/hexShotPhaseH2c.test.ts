/**
 * Hex Shot Phase H.2c — authorized authored retunes + corrected-baseline verification.
 * Run: npx tsx src/data/hexShotPhaseH2c.test.ts
 *
 * Authorized only:
 *   HEX_MAGAZINE_CONFIG.wraithglassFlatOccult: 6 → 3
 *   hex-silver-core-sidearm T3 ballisticDamagePct: 15 → 20
 */
import assert from 'node:assert/strict';
import {
  applyHexAmmoFractureBonus,
  isHexAmmoHeavyShot,
  splitHexAmmoDamageChannels,
} from './hexShotPhaseH2aEngine';
import {
  applyHexAmmoEffect,
  createHexAmmoCastTracker,
  recordHexAmmoEffect,
} from './hexAmmoEffectEngine';
import {
  applyWeaponBallisticDamageMultiplier,
  resolveWeaponMagazineBonus,
} from './weaponCombatEngine';
import { resolveHexBasicShot } from './weaponBasicEngine';
import { resolveWeaponState } from './weaponProgressionEngine';
import { getWeaponFamily } from './weaponRegistry';
import { getHexShotAbilityTags, HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { HEX_MAGAZINE_CONFIG, type HexAmmoType } from '../types/hexAmmo';
import { DEFAULT_MAGAZINE_SIZE } from '../types/classCombatResources';
import { HEX_RELOAD_AP_COST } from '../types/hexShotState';
import { applyKineticArmorMitigation, applyOccultWardMitigation } from './combatDefenseLayerEngine';
import type { EnemyCombatProfile } from '../types/run';

console.log('Phase H.2c — Hex authored retunes + corrected-baseline verification');

const HEX_IDS = [
  'hex-silver-core-sidearm',
  'hex-void-cannon',
  'hex-pulse-rifle',
] as const;

const heavy = isHexAmmoHeavyShot({
  abilityId: 'SILVER_CORE_SIDEARM',
  abilityTags: getHexShotAbilityTags('SILVER_CORE_SIDEARM'),
});

function enemy(partial: Partial<EnemyCombatProfile> & { unitId: string }): EnemyCombatProfile {
  return {
    designation: 'N',
    currentHp: 80,
    maxHp: 100,
    gridSlot: 'FL_1',
    kineticArmor: 0,
    occultWards: 0,
    ...partial,
  } as EnemyCombatProfile;
}

function planFor(
  familyId: typeof HEX_IDS[number],
  tier: 1 | 2 | 3,
  squad: EnemyCombatProfile[],
  targetId: string,
) {
  return resolveHexBasicShot({
    weapon: resolveWeaponState(familyId, tier),
    squad,
    primaryTargetId: targetId,
    catalogBaseDamage: HEX_SHOT_ABILITY_CATALOG.SILVER_CORE_SIDEARM.baseDamage,
  });
}

function execOnceScaled(familyId: typeof HEX_IDS[number], tier: 1 | 2 | 3, planDmg: number) {
  const w = resolveWeaponState(familyId, tier);
  return applyWeaponBallisticDamageMultiplier(
    planDmg,
    w.statModifiers,
    false,
    w.passiveBonusPct ?? 0,
    { skipFamilyBallisticPct: true },
  );
}

function wraithChannels(
  planDamage: number,
  opts?: { backline?: boolean },
) {
  const tracker = createHexAmmoCastTracker();
  const ammo = applyHexAmmoEffect({
    ammoType: 'WRAITHGLASS',
    isHeavyShot: heavy,
    hitIndex: 0,
    isBackline: !!opts?.backline,
    isBoss: false,
    targetId: 't',
    targetHasKineticArmor: false,
    targetHasOccultWard: false,
    targetHasVoidMark: false,
    targetTelegraphing: false,
    overcharged: false,
    tracker,
  });
  let dmg = Math.floor(planDamage * ammo.damageMultiplier);
  if (ammo.backlineBonusPct > 0) {
    dmg = Math.floor(dmg * (1 + ammo.backlineBonusPct / 100));
  }
  const split = splitHexAmmoDamageChannels(dmg, ammo);
  const converted = ammo.occultConversionPct > 0
    ? Math.floor(dmg * (ammo.occultConversionPct / 100))
    : 0;
  return { ammo, dmg, converted, split, aggregate: split.primaryDamage + split.occultDamage };
}

// ── Authored values at live owners ──────────────────────────────────────
assert.equal(HEX_MAGAZINE_CONFIG.wraithglassFlatOccult, 3);
assert.equal(HEX_MAGAZINE_CONFIG.wraithglassOccultConversionPct, 40);
assert.equal(HEX_MAGAZINE_CONFIG.wraithglassVoidMarkTurns, 2);
assert.equal(HEX_MAGAZINE_CONFIG.wraithglassBacklineDamagePct, 15);
assert.equal(HEX_MAGAZINE_CONFIG.overchargedDamagePct, 20);
assert.equal(HEX_MAGAZINE_CONFIG.failedFirstShotDamagePct, 10);
assert.equal(HEX_MAGAZINE_CONFIG.maxProtocolCharges, 3);
assert.equal(HEX_RELOAD_AP_COST, 1);

{
  const sidearm = getWeaponFamily('hex-silver-core-sidearm');
  assert.equal(sidearm.tiers[0]!.statModifiers.ballisticDamagePct ?? 0, 0);
  assert.equal(sidearm.tiers[1]!.statModifiers.ballisticDamagePct, 10);
  assert.equal(sidearm.tiers[2]!.statModifiers.ballisticDamagePct, 20);
  assert.equal(sidearm.tiers[2]!.oncePerCombatPassive, 'FIRST_RELOAD_STAMINA');
  assert.equal(sidearm.tiers[2]!.passiveBonusPct, 10);
  // Sibling families unchanged by this pass
  assert.equal(getWeaponFamily('hex-void-cannon').tiers[2]!.statModifiers.ballisticDamagePct, 32);
  assert.equal(getWeaponFamily('hex-pulse-rifle').tiers[2]!.statModifiers.ballisticDamagePct, 5);
}

// ── Sidearm SILVER_CORE ladder 10 → 11 → 12 ─────────────────────────────
{
  const neu = [enemy({ unitId: 'n' })];
  const t1 = planFor('hex-silver-core-sidearm', 1, neu, 'n').hits[0]!.damage;
  const t2 = planFor('hex-silver-core-sidearm', 2, neu, 'n').hits[0]!.damage;
  const t3 = planFor('hex-silver-core-sidearm', 3, neu, 'n').hits[0]!.damage;
  assert.equal(t1, 10);
  assert.equal(t2, 11);
  assert.equal(t3, 12);
  assert.equal(t3, Math.floor(10 * 1.2));
  assert.equal(execOnceScaled('hex-silver-core-sidearm', 3, t3), 12);
  // Double-scale must not apply
  const doubleWrong = applyWeaponBallisticDamageMultiplier(
    t3,
    resolveWeaponState('hex-silver-core-sidearm', 3).statModifiers,
    false,
    0,
  );
  assert.equal(doubleWrong, Math.floor(12 * 1.2)); // would be 14 if hub re-scaled
  assert.notEqual(doubleWrong, 12);
  assert.equal(execOnceScaled('hex-silver-core-sidearm', 3, t3), t3);

  const mag = DEFAULT_MAGAZINE_SIZE + resolveWeaponMagazineBonus(
    resolveWeaponState('hex-silver-core-sidearm', 3).statModifiers,
  );
  assert.equal(mag, 6);
  assert.equal(t3 * mag, 72);
  const shotsBeforeP3 = mag * 3;
  assert.equal(t3 * shotsBeforeP3, 216);
  const apToP3 = shotsBeforeP3 + 3 * HEX_RELOAD_AP_COST;
  assert.equal(apToP3, 21);
  assert.equal(Math.ceil(apToP3 / 3), 7);
}

// Execute threshold unchanged; T3 payoff scales with plan damage
{
  const execTarget = [enemy({ unitId: 'x', currentHp: 24, maxHp: 80 })];
  const healthy = [enemy({ unitId: 'h', currentHp: 80, maxHp: 80 })];
  const t3Exec = planFor('hex-silver-core-sidearm', 3, execTarget, 'x').hits[0]!;
  const t3Healthy = planFor('hex-silver-core-sidearm', 3, healthy, 'h').hits[0]!;
  assert.equal(t3Healthy.damage, 12);
  assert.equal(t3Healthy.fractureGain, 15);
  assert.equal(t3Exec.damage, Math.floor(12 * 1.15)); // 13
  assert.equal(t3Exec.fractureGain, 20);
}

// FAILED precedes Overcharge (locked multipliers unchanged)
{
  const base = 12;
  const failed = Math.floor(base * (1 - HEX_MAGAZINE_CONFIG.failedFirstShotDamagePct / 100));
  const perfect = Math.floor(base * (1 + HEX_MAGAZINE_CONFIG.overchargedDamagePct / 100));
  assert.equal(failed, 10);
  assert.equal(perfect, 14);
  // Combined order FAILED then OC: floor(floor(12*0.9)*1.2) if both pending is hub-owned;
  // prove multipliers themselves are unchanged.
  assert.equal(HEX_MAGAZINE_CONFIG.failedFirstShotDamagePct, 10);
  assert.equal(HEX_MAGAZINE_CONFIG.overchargedDamagePct, 20);
}

// Sidearm ladder under all three ammo types (plan damage unchanged by ammo)
{
  for (const ammo of ['SILVER_CORE', 'WRAITHGLASS', 'STASIS_LOCK'] as HexAmmoType[]) {
    for (const tier of [1, 2, 3] as const) {
      const plan = planFor('hex-silver-core-sidearm', tier, [enemy({ unitId: 'n' })], 'n');
      const expected = tier === 1 ? 10 : tier === 2 ? 11 : 12;
      assert.equal(plan.hits[0]!.damage, expected, `Sidearm T${tier} plan under ${ammo}`);
      assert.equal(execOnceScaled('hex-silver-core-sidearm', tier, plan.hits[0]!.damage), expected);
    }
  }
}

// ── Wraithglass neutral Tier-I aggregates ───────────────────────────────
{
  const sidearm = wraithChannels(10);
  assert.equal(sidearm.converted, 4);
  assert.equal(sidearm.split.primaryDamage, 6);
  assert.equal(sidearm.ammo.flatOccultBonus, 3);
  assert.equal(sidearm.split.occultDamage, 7);
  assert.equal(sidearm.aggregate, 13);

  const nullSoft = wraithChannels(19);
  assert.equal(nullSoft.converted, 7);
  assert.equal(nullSoft.split.primaryDamage, 12);
  assert.equal(nullSoft.split.occultDamage, 10);
  assert.equal(nullSoft.aggregate, 22);

  const ashIso = wraithChannels(7);
  assert.equal(ashIso.converted, 2);
  assert.equal(ashIso.split.primaryDamage, 5);
  assert.equal(ashIso.split.occultDamage, 5);
  assert.equal(ashIso.aggregate, 10);

  const sidearmBl = wraithChannels(10, { backline: true });
  assert.equal(sidearmBl.dmg, 11);
  assert.equal(sidearmBl.converted, 4);
  assert.equal(sidearmBl.split.primaryDamage, 7);
  assert.equal(sidearmBl.split.occultDamage, 7);
  assert.equal(sidearmBl.aggregate, 14);
}

// Flat echo exactly 3; conversion/utility unchanged; Void-Mark 2t
{
  const ammo = applyHexAmmoEffect({
    ammoType: 'WRAITHGLASS',
    isHeavyShot: heavy,
    hitIndex: 0,
    isBackline: false,
    isBoss: false,
    targetId: 't',
    targetHasKineticArmor: true,
    targetHasOccultWard: true,
    targetHasVoidMark: false,
    targetTelegraphing: false,
    overcharged: false,
    tracker: createHexAmmoCastTracker(),
  });
  assert.equal(ammo.flatOccultBonus, 3);
  assert.equal(ammo.occultConversionPct, 40);
  assert.equal(ammo.voidMarkTurns, 2);
  assert.equal(ammo.applyVoidMark, true);
  assert.equal(ammo.stripWard, true);
  assert.equal(ammo.stripArmor, false);
  assert.equal(ammo.damageMultiplier, 1);
}

// ── Wraithglass matrices T1 + T3 ────────────────────────────────────────
function wraithCase(
  familyId: typeof HEX_IDS[number],
  tier: 1 | 2 | 3,
  fixture: EnemyCombatProfile,
  label: string,
  opts?: { backline?: boolean; forceSingle?: boolean },
) {
  const targetId = fixture.unitId ?? 'target';
  const squad = [fixture];
  const plan = resolveHexBasicShot({
    weapon: resolveWeaponState(familyId, tier),
    squad,
    primaryTargetId: targetId,
    catalogBaseDamage: HEX_SHOT_ABILITY_CATALOG.SILVER_CORE_SIDEARM.baseDamage,
    forceSingleTarget: opts?.forceSingle,
  });
  const planDmg = plan.hits[0]!.damage;
  assert.equal(execOnceScaled(familyId, tier, planDmg), planDmg, `${label} preview=exec`);

  const tracker = createHexAmmoCastTracker();
  const results = plan.hits.map((hit, hitIndex) => {
    const hitTargetId = hit.targetId ?? targetId;
    const ammo = applyHexAmmoEffect({
      ammoType: 'WRAITHGLASS',
      isHeavyShot: heavy,
      hitIndex,
      isBackline: !!opts?.backline && hit.isPrimary,
      isBoss: false,
      targetId: hitTargetId,
      targetHasKineticArmor: (fixture.kineticArmor ?? 0) > 0,
      targetHasOccultWard: (fixture.occultWards ?? 0) > 0,
      targetHasVoidMark: false,
      targetTelegraphing: false,
      overcharged: false,
      tracker,
    });
    recordHexAmmoEffect(tracker, hitTargetId, ammo);
    let dmg = Math.floor(hit.damage * ammo.damageMultiplier);
    if (ammo.backlineBonusPct > 0) dmg = Math.floor(dmg * (1 + ammo.backlineBonusPct / 100));
    const split = splitHexAmmoDamageChannels(dmg, ammo);
    const converted = ammo.occultConversionPct > 0
      ? Math.floor(dmg * (ammo.occultConversionPct / 100))
      : 0;
    let e = { ...fixture };
    if (ammo.stripWard) e = { ...e, occultWards: Math.max(0, (e.occultWards ?? 0) - 1) };
    const kinPost = applyKineticArmorMitigation(e, split.primaryDamage).damageAfter;
    const occPost = applyOccultWardMitigation(e, split.occultDamage).damageAfter;
    return {
      planDmg: hit.damage,
      converted,
      kin: split.primaryDamage,
      flat: ammo.flatOccultBonus,
      occ: split.occultDamage,
      kinPost,
      occPost,
      agg: kinPost + occPost,
      frac: applyHexAmmoFractureBonus(hit.fractureGain, ammo),
      stripWard: ammo.stripWard,
      voidM: ammo.voidMarkTurns,
      ammoCost: plan.ammoCost,
    };
  });

  // Flat echo is 3 per authored hit
  for (const r of results) assert.equal(r.flat, 3, `${label} flat echo`);
  // Once-per-cast ward strip
  assert.equal(results.filter((r) => r.stripWard).length <= 1, true, `${label} ward strip once`);
  assert.equal(plan.ammoCost, 1, `${label} mag consume 1`);

  return { planDmg, results, packets: plan.hits.length };
}

{
  const neu = enemy({ unitId: 'neu' });
  const ka = enemy({ unitId: 'ka', kineticArmor: 2, baseKineticArmor: 2 } as any);
  const ow = enemy({ unitId: 'ow', occultWards: 2, baseOccultWards: 2 } as any);
  const both = enemy({
    unitId: 'both',
    kineticArmor: 1,
    occultWards: 1,
    baseKineticArmor: 1,
    baseOccultWards: 1,
  } as any);

  for (const tier of [1, 3] as const) {
    for (const familyId of HEX_IDS) {
      const n = wraithCase(familyId, tier, neu, `${familyId} T${tier} neu`);
      assert.ok(n.results[0]!.agg > n.planDmg || n.results[0]!.voidM === 2, 'damage-positive or mark');
      // Always damage-positive vs plan on neutral (flat echo + conversion net)
      assert.ok(n.results[0]!.agg >= n.planDmg, `${familyId} T${tier} Wraith >= plan`);

      wraithCase(familyId, tier, ka, `${familyId} T${tier} KA`);
      const w = wraithCase(familyId, tier, ow, `${familyId} T${tier} OW`);
      assert.equal(w.results[0]!.stripWard, true);
      assert.equal(w.results[0]!.voidM, 2);
      wraithCase(familyId, tier, both, `${familyId} T${tier} KA+OW`);
    }
    wraithCase('hex-silver-core-sidearm', tier, neu, `Sidearm T${tier} backline`, { backline: true });
  }

  // Ash cluster 1/2/3 — unused packets do not collapse; per-hit echo; strip once
  const t0 = enemy({ unitId: 't0', gridSlot: 'FL_1', currentHp: 50, maxHp: 80 });
  const t1 = enemy({ unitId: 't1', gridSlot: 'FL_0', currentHp: 50, maxHp: 80 });
  const t2 = enemy({ unitId: 't2', gridSlot: 'BL_1', currentHp: 50, maxHp: 80 });

  const ash1 = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-pulse-rifle', 1),
    squad: [t0],
    primaryTargetId: 't0',
    catalogBaseDamage: 10,
  });
  assert.equal(ash1.hits.length, 1);
  assert.equal(ash1.hits[0]!.damage, 7);

  const ash2 = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-pulse-rifle', 1),
    squad: [t0, t1],
    primaryTargetId: 't0',
    catalogBaseDamage: 10,
  });
  assert.equal(ash2.hits.length, 2);
  assert.equal(ash2.hits.reduce((a, h) => a + h.damage, 0), 10);

  const ash3 = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-pulse-rifle', 1),
    squad: [t0, t1, t2],
    primaryTargetId: 't0',
    catalogBaseDamage: 10,
  });
  assert.equal(ash3.hits.length, 3);
  assert.equal(ash3.hits.reduce((a, h) => a + h.damage, 0), 13);

  const tracker = createHexAmmoCastTracker();
  let echoSum = 0;
  let wardStrips = 0;
  ash3.hits.forEach((hit, hitIndex) => {
    const ammo = applyHexAmmoEffect({
      ammoType: 'WRAITHGLASS',
      isHeavyShot: heavy,
      hitIndex,
      isBackline: false,
      isBoss: false,
      targetId: hit.targetId,
      targetHasKineticArmor: false,
      targetHasOccultWard: true,
      targetHasVoidMark: false,
      targetTelegraphing: false,
      overcharged: false,
      tracker,
    });
    recordHexAmmoEffect(tracker, hit.targetId, ammo);
    assert.equal(ammo.flatOccultBonus, 3);
    echoSum += ammo.flatOccultBonus;
    if (ammo.stripWard) wardStrips += 1;
  });
  assert.equal(echoSum, 9); // 3 hits × flat 3
  assert.equal(wardStrips, 1); // once per cast

  // Isolated Ash Wraith aggregate 10 < Sidearm Wraith 13 — drawback still visible vs Sidearm
  assert.equal(wraithChannels(7).aggregate, 10);
  assert.equal(wraithChannels(10).aggregate, 13);
  assert.ok(wraithChannels(7).aggregate < wraithChannels(10).aggregate);

  // Ash SILVER iso remains weaker than Ash Wraith but Wraith no longer nearly doubles
  assert.equal(7, planFor('hex-pulse-rifle', 1, [t0], 't0').hits[0]!.damage);
  assert.equal(wraithChannels(7).aggregate - 7, 3); // +3 net vs plan (was +6 before retune)
}

// SILVER_CORE remains Fracture/armor pairing (unchanged fields)
{
  const r = applyHexAmmoEffect({
    ammoType: 'SILVER_CORE',
    isHeavyShot: heavy,
    hitIndex: 0,
    isBackline: false,
    isBoss: false,
    targetId: 'a',
    targetHasKineticArmor: true,
    targetHasOccultWard: false,
    targetHasVoidMark: false,
    targetTelegraphing: false,
    overcharged: false,
    tracker: createHexAmmoCastTracker(),
  });
  assert.equal(r.fractureBonusPct, 25);
  assert.equal(r.stripArmor, true);
  assert.equal(applyHexAmmoFractureBonus(15, r), Math.floor(15 * 1.25));
}

// Tier-III Sidearm Wraith uses plan 12
{
  const ch = wraithChannels(12);
  assert.equal(ch.converted, 4); // floor(12*0.4)=4
  assert.equal(ch.split.primaryDamage, 8);
  assert.equal(ch.split.occultDamage, 7); // 4+3
  assert.equal(ch.aggregate, 15);
  assert.equal(execOnceScaled('hex-silver-core-sidearm', 3, 12), 12);
}

// H.2a structural guards still hold for T3 Sidearm
{
  for (const id of HEX_IDS) {
    for (const tier of [1, 2, 3] as const) {
      const plan = planFor(id, tier, [enemy({ unitId: 'e' })], 'e');
      assert.equal(execOnceScaled(id, tier, plan.hits[0]!.damage), plan.hits[0]!.damage);
    }
  }
}

console.log('Phase H.2c — all assertions passed');
console.log('  wraithglassFlatOccult =', HEX_MAGAZINE_CONFIG.wraithglassFlatOccult);
console.log('  Sidearm T3 ballisticDamagePct =', getWeaponFamily('hex-silver-core-sidearm').tiers[2]!.statModifiers.ballisticDamagePct);
console.log('  Sidearm ladder 10/11/12 · Wraith T1 agg 13/22/10 · backline 14');
