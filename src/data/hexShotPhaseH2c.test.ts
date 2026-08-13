/**
 * Hex Shot Phase H.2c — authorized authored retunes + corrected-baseline verification.
 * Run: npx tsx src/data/hexShotPhaseH2c.test.ts
 *
 * Authorized only:
 *   HEX_MAGAZINE_CONFIG.wraithglassFlatOccult: 6 → 3
 * Stage II-C — weapon tiers retired; baselines == former Tier I.
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
  'hex-revolver',
  'hex-shotgun',
  'hex-carbine',
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
  squad: EnemyCombatProfile[],
  targetId: string,
) {
  return resolveHexBasicShot({
    weapon: resolveWeaponState(familyId),
    squad,
    primaryTargetId: targetId,
    catalogBaseDamage: HEX_SHOT_ABILITY_CATALOG.SILVER_CORE_SIDEARM.baseDamage,
  });
}

function execOnceScaled(familyId: typeof HEX_IDS[number], planDmg: number) {
  const w = resolveWeaponState(familyId);
  return applyWeaponBallisticDamageMultiplier(
    planDmg,
    w.statModifiers,
    false,
    0,
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
  const sidearm = getWeaponFamily('hex-revolver');
  assert.equal('tiers' in sidearm, false);
  assert.equal(sidearm.baselineStatModifiers.ballisticDamagePct ?? 0, 0);
  assert.deepEqual(
    resolveWeaponState('hex-revolver').statModifiers,
    sidearm.baselineStatModifiers,
  );
  // Sibling baselines (former Tier I only — no T2/T3 deltas)
  assert.equal(getWeaponFamily('hex-shotgun').baselineStatModifiers.ballisticDamagePct, 20);
  assert.equal(getWeaponFamily('hex-carbine').baselineStatModifiers.ballisticDamagePct, -5);
}

// ── Sidearm SILVER_CORE baseline (tierless == former T1) ────────────────
{
  const neu = [enemy({ unitId: 'n' })];
  const dmg = planFor('hex-revolver', neu, 'n').hits[0]!.damage;
  assert.equal(dmg, 10);
  assert.equal(execOnceScaled('hex-revolver', dmg), 10);
  // Family ballistic already in plan — hub must not double-scale
  const doubleWrong = applyWeaponBallisticDamageMultiplier(
    dmg,
    resolveWeaponState('hex-revolver').statModifiers,
    false,
    0,
  );
  assert.equal(doubleWrong, 10);
  assert.equal(execOnceScaled('hex-revolver', dmg), dmg);

  const mag = DEFAULT_MAGAZINE_SIZE + resolveWeaponMagazineBonus(
    resolveWeaponState('hex-revolver').statModifiers,
  );
  assert.equal(mag, 6);
  assert.equal(dmg * mag, 60);
  const shotsBeforeP3 = mag * 3;
  assert.equal(dmg * shotsBeforeP3, 180);
  const apToP3 = shotsBeforeP3 + 3 * HEX_RELOAD_AP_COST;
  assert.equal(apToP3, 21);
  assert.equal(Math.ceil(apToP3 / 3), 7);
}

// Execute threshold unchanged at baseline plan damage
{
  const execTarget = [enemy({ unitId: 'x', currentHp: 24, maxHp: 80 })];
  const healthy = [enemy({ unitId: 'h', currentHp: 80, maxHp: 80 })];
  const execHit = planFor('hex-revolver', execTarget, 'x').hits[0]!;
  const healthyHit = planFor('hex-revolver', healthy, 'h').hits[0]!;
  assert.equal(healthyHit.damage, 10);
  assert.equal(healthyHit.fractureGain, 15);
  assert.equal(execHit.damage, Math.floor(10 * 1.15)); // 11
  assert.equal(execHit.fractureGain, 20);
}

// FAILED precedes Overcharge (locked multipliers unchanged)
{
  const base = 10;
  const failed = Math.floor(base * (1 - HEX_MAGAZINE_CONFIG.failedFirstShotDamagePct / 100));
  const perfect = Math.floor(base * (1 + HEX_MAGAZINE_CONFIG.overchargedDamagePct / 100));
  assert.equal(failed, 9);
  assert.equal(perfect, 12);
  assert.equal(HEX_MAGAZINE_CONFIG.failedFirstShotDamagePct, 10);
  assert.equal(HEX_MAGAZINE_CONFIG.overchargedDamagePct, 20);
}

// Sidearm baseline under all three ammo types (plan damage unchanged by ammo)
{
  for (const ammo of ['SILVER_CORE', 'WRAITHGLASS', 'STASIS_LOCK'] as HexAmmoType[]) {
    const plan = planFor('hex-revolver', [enemy({ unitId: 'n' })], 'n');
    assert.equal(plan.hits[0]!.damage, 10, `Sidearm plan under ${ammo}`);
    assert.equal(execOnceScaled('hex-revolver', plan.hits[0]!.damage), 10);
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

// ── Wraithglass matrices (tierless baseline) ────────────────────────────
function wraithCase(
  familyId: typeof HEX_IDS[number],
  fixture: EnemyCombatProfile,
  label: string,
  opts?: { backline?: boolean; forceSingle?: boolean },
) {
  const targetId = fixture.unitId ?? 'target';
  const squad = [fixture];
  const plan = resolveHexBasicShot({
    weapon: resolveWeaponState(familyId),
    squad,
    primaryTargetId: targetId,
    catalogBaseDamage: HEX_SHOT_ABILITY_CATALOG.SILVER_CORE_SIDEARM.baseDamage,
    forceSingleTarget: opts?.forceSingle,
  });
  const planDmg = plan.hits[0]!.damage;
  assert.equal(execOnceScaled(familyId, planDmg), planDmg, `${label} preview=exec`);

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

  for (const familyId of HEX_IDS) {
    const n = wraithCase(familyId, neu, `${familyId} neu`);
    assert.ok(n.results[0]!.agg > n.planDmg || n.results[0]!.voidM === 2, 'damage-positive or mark');
    assert.ok(n.results[0]!.agg >= n.planDmg, `${familyId} Wraith >= plan`);

    wraithCase(familyId, ka, `${familyId} KA`);
    const w = wraithCase(familyId, ow, `${familyId} OW`);
    assert.equal(w.results[0]!.stripWard, true);
    assert.equal(w.results[0]!.voidM, 2);
    wraithCase(familyId, both, `${familyId} KA+OW`);
  }
  wraithCase('hex-revolver', neu, 'Sidearm backline', { backline: true });

  // Ash cluster 1/2/3 — unused packets do not collapse; per-hit echo; strip once
  const t0 = enemy({ unitId: 't0', gridSlot: 'FL_1', currentHp: 50, maxHp: 80 });
  const t1 = enemy({ unitId: 't1', gridSlot: 'FL_0', currentHp: 50, maxHp: 80 });
  const t2 = enemy({ unitId: 't2', gridSlot: 'BL_1', currentHp: 50, maxHp: 80 });

  const ash1 = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-carbine'),
    squad: [t0],
    primaryTargetId: 't0',
    catalogBaseDamage: 10,
  });
  assert.equal(ash1.hits.length, 1);
  assert.equal(ash1.hits[0]!.damage, 7);

  const ash2 = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-carbine'),
    squad: [t0, t1],
    primaryTargetId: 't0',
    catalogBaseDamage: 10,
  });
  assert.equal(ash2.hits.length, 2);
  assert.equal(ash2.hits.reduce((a, h) => a + h.damage, 0), 10);

  const ash3 = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-carbine'),
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
  assert.equal(7, planFor('hex-carbine', [t0], 't0').hits[0]!.damage);
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

// Baseline Sidearm Wraith uses plan 10; retired T3 plan-12 bonus does not apply
{
  const ch = wraithChannels(10);
  assert.equal(ch.converted, 4);
  assert.equal(ch.split.primaryDamage, 6);
  assert.equal(ch.split.occultDamage, 7);
  assert.equal(ch.aggregate, 13);
  assert.equal(execOnceScaled('hex-revolver', 10), 10);
  // Post-reload / passiveBonusPct T3 bonus is inert
  const mods = resolveWeaponState('hex-revolver').statModifiers;
  assert.equal(
    applyWeaponBallisticDamageMultiplier(10, mods, true, 10, { skipFamilyBallisticPct: true }),
    applyWeaponBallisticDamageMultiplier(10, mods, false, 0, { skipFamilyBallisticPct: true }),
  );
}

// H.2a structural guards — preview equals exec for all Hex families
{
  for (const id of HEX_IDS) {
    const plan = planFor(id, [enemy({ unitId: 'e' })], 'e');
    assert.equal(execOnceScaled(id, plan.hits[0]!.damage), plan.hits[0]!.damage);
  }
}

console.log('Phase H.2c — all assertions passed');
console.log('  wraithglassFlatOccult =', HEX_MAGAZINE_CONFIG.wraithglassFlatOccult);
console.log('  Sidearm baseline ballisticDamagePct =', getWeaponFamily('hex-revolver').baselineStatModifiers.ballisticDamagePct ?? 0);
console.log('  Sidearm baseline 10 · Wraith T1 agg 13/22/10 · backline 14');
