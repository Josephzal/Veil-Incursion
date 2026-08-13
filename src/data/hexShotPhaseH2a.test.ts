/**
 * Hex Shot Phase H.2a — fixed-basic scaling, ammo delivery, heavy-shot eligibility.
 * Run: npx tsx src/data/hexShotPhaseH2a.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyHexAmmoFractureBonus,
  isHexAmmoHeavyShot,
  isHexFixedBasicAbilityId,
  isUnitMarked,
  mergeDurationTurns,
  splitHexAmmoDamageChannels,
  tickDurationMap,
} from './hexShotPhaseH2aEngine';
import {
  applyHexAmmoEffect,
  createHexAmmoCastTracker,
} from './hexAmmoEffectEngine';
import { applyWeaponBallisticDamageMultiplier } from './weaponCombatEngine';
import { resolveHexBasicShot } from './weaponBasicEngine';
import { resolveWeaponState } from './weaponProgressionEngine';
import { getWeaponFamily } from './weaponRegistry';
import { getWeaponAnchorAttack } from './weaponAnchorAttackRegistry';
import { getHexShotAbilityTags, HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { resolveWeaponAnchorCardPresentation } from './weaponAnchorCardPresentation';
import { createDefaultWeaponRuntime } from './weaponRunState';
import { HEX_MAGAZINE_CONFIG, type HexAmmoType } from '../types/hexAmmo';
import { planSixthSeal, planLastKnock } from './weaponUltimateNewResolveEngine';
import { createDefaultClassBoonEncounterState } from '../types/classBoon';
import type { EnemyCombatProfile } from '../types/run';
import { ALL_WEAPON_FAMILY_IDS } from './weaponRegistry';
import { getWeaponLoadoutRecommendationProfile } from './weaponLoadoutRecommendationProfiles';

console.log('Phase H.2a — Hex fixed-basic scaling + ammo delivery');

const HEX_IDS = [
  'hex-revolver',
  'hex-shotgun',
  'hex-carbine',
] as const;

const primary: EnemyCombatProfile = {
  unitId: 'e1',
  designation: 'N',
  currentHp: 80,
  maxHp: 100,
  gridSlot: 'FL_1',
  kineticArmor: 0,
  occultWards: 0,
} as EnemyCombatProfile;
const armored: EnemyCombatProfile = {
  ...primary,
  unitId: 'e2',
  kineticArmor: 2,
} as EnemyCombatProfile;
const warded: EnemyCombatProfile = {
  ...primary,
  unitId: 'e3',
  occultWards: 2,
} as EnemyCombatProfile;
const adj: EnemyCombatProfile = {
  unitId: 'e4',
  designation: 'A',
  currentHp: 50,
  maxHp: 100,
  gridSlot: 'FL_0',
} as EnemyCombatProfile;

function planFor(familyId: typeof HEX_IDS[number], tier: 1 | 2 | 3, squad = [primary], targetId = 'e1') {
  return resolveHexBasicShot({
    weapon: resolveWeaponState(familyId),
    squad,
    primaryTargetId: targetId,
    catalogBaseDamage: HEX_SHOT_ABILITY_CATALOG.SILVER_CORE_SIDEARM.baseDamage,
  });
}

function execFromPlan(
  familyId: typeof HEX_IDS[number],
  planDmg: number,
  postReload = false,
) {
  const w = resolveWeaponState(familyId);
  return applyWeaponBallisticDamageMultiplier(
    planDmg,
    w.statModifiers,
    postReload,
    0,
    { skipFamilyBallisticPct: true },
  );
}

// ── Single ballistic scaling / preview = execution ──────────────────────
for (const id of HEX_IDS) {
  const plan = planFor(id, 1, id === 'hex-carbine' ? [primary, adj] : [primary]);
  const hit = plan.hits[0]!;
  const exec = execFromPlan(id, hit.damage);
  assert.equal(exec, hit.damage, `${id} preview/exec once-scaled`);
  const doubleWrong = applyWeaponBallisticDamageMultiplier(
    hit.damage,
    resolveWeaponState(id).statModifiers,
    false,
    0,
  );
  // When a second application would change the value, prove we skip it.
  if (doubleWrong !== hit.damage) {
    assert.equal(exec, hit.damage, `${id} skips second scale`);
  }
}

// Audited H.2 baselines restored
{
  const nb = planFor('hex-shotgun', 1);
  assert.equal(nb.hits[0]!.damage, 19);
  assert.equal(execFromPlan('hex-shotgun', 19), 19);
  const ash = planFor('hex-carbine', 1);
  assert.equal(ash.hits[0]!.damage, 7);
  assert.equal(execFromPlan('hex-carbine', 7), 7);
}

// Positive / zero / negative pct once
{
  assert.equal(planFor('hex-shotgun', 1).hits[0]!.damage, 19); // +20 once
  assert.equal(planFor('hex-revolver', 1).hits[0]!.damage, 10); // 0
  assert.equal(planFor('hex-carbine', 1).hits[0]!.damage, 7); // -5 once
}

// Multi-target packets not re-scaled per target
{
  const ash = planFor('hex-carbine', 1, [primary, adj]);
  assert.ok(ash.hits.length >= 2);
  for (const h of ash.hits) {
    assert.equal(execFromPlan('hex-carbine', h.damage), h.damage);
  }
}

// Post-reload Tier-III bonus retired — no extra damage
{
  const carbine = resolveWeaponState('hex-carbine');
  const planDmg = planFor('hex-carbine', 1).hits[0]!.damage;
  const withPost = applyWeaponBallisticDamageMultiplier(
    planDmg,
    carbine.statModifiers,
    true,
    10,
    { skipFamilyBallisticPct: true },
  );
  const without = applyWeaponBallisticDamageMultiplier(
    planDmg,
    carbine.statModifiers,
    false,
    0,
    { skipFamilyBallisticPct: true },
  );
  assert.equal(withPost, without);
  assert.equal(withPost, planDmg);
}

// ── Heavy-shot eligibility ──────────────────────────────────────────────
{
  const basicTags = getHexShotAbilityTags('SILVER_CORE_SIDEARM');
  assert.ok(basicTags.includes('ARMOR_BREAK'));
  assert.ok(!basicTags.includes('ARMOR_PIERCE'));
  assert.equal(
    isHexAmmoHeavyShot({ abilityId: 'SILVER_CORE_SIDEARM', abilityTags: basicTags }),
    true,
  );
  assert.ok(isHexFixedBasicAbilityId('SILVER_CORE_SIDEARM'));
  const flexTags = getHexShotAbilityTags('ASH_JACKET_SALVO');
  assert.equal(
    isHexAmmoHeavyShot({ abilityId: 'ASH_JACKET_SALVO', abilityTags: flexTags }),
    false,
  );
  const slugTags = getHexShotAbilityTags('SINGULARITY_SLUG');
  assert.equal(
    isHexAmmoHeavyShot({ abilityId: 'SINGULARITY_SLUG', abilityTags: slugTags }),
    true,
  );
  assert.equal(
    isHexAmmoHeavyShot({ abilityId: 'ZERO_PROTOCOL', abilityTags: getHexShotAbilityTags('ZERO_PROTOCOL') }),
    false,
  );
  assert.equal(
    isHexAmmoHeavyShot({ abilityId: 'SIXTH_SEAL', abilityTags: [] }),
    false,
  );
}

// ── Ammo matrix (all 9) ─────────────────────────────────────────────────
const AMMO: HexAmmoType[] = ['SILVER_CORE', 'WRAITHGLASS', 'STASIS_LOCK'];
for (const familyId of HEX_IDS) {
  for (const ammo of AMMO) {
    const tracker = createHexAmmoCastTracker();
    const r = applyHexAmmoEffect({
      ammoType: ammo,
      isHeavyShot: isHexAmmoHeavyShot({
        abilityId: 'SILVER_CORE_SIDEARM',
        abilityTags: getHexShotAbilityTags('SILVER_CORE_SIDEARM'),
      }),
      hitIndex: 0,
      isBackline: false,
      isBoss: false,
      targetId: 'e1',
      targetHasKineticArmor: true,
      targetHasOccultWard: true,
      targetHasVoidMark: false,
      targetTelegraphing: true,
      overcharged: false,
      tracker,
    });
    if (ammo === 'SILVER_CORE') {
      assert.equal(r.fractureBonusPct, HEX_MAGAZINE_CONFIG.silverFractureBonusPct);
      assert.equal(r.stripArmor, true, `${familyId} SILVER_CORE heavy strip`);
      assert.equal(applyHexAmmoFractureBonus(15, r), Math.floor(15 * 1.25));
    }
    if (ammo === 'WRAITHGLASS') {
      assert.equal(r.occultConversionPct, HEX_MAGAZINE_CONFIG.wraithglassOccultConversionPct);
      assert.equal(r.flatOccultBonus, HEX_MAGAZINE_CONFIG.wraithglassFlatOccult);
      assert.equal(r.applyVoidMark, true);
      assert.equal(r.voidMarkTurns, HEX_MAGAZINE_CONFIG.wraithglassVoidMarkTurns);
      assert.equal(r.stripWard, true, `${familyId} WRAITHGLASS heavy ward strip`);
      const split = splitHexAmmoDamageChannels(100, r);
      assert.equal(split.primaryDamage, 60); // 40% converted
      assert.equal(split.occultDamage, 40 + HEX_MAGAZINE_CONFIG.wraithglassFlatOccult);
    }
    if (ammo === 'STASIS_LOCK') {
      assert.equal(r.damageMultiplier, 0.8);
      assert.equal(r.applyStasisLock, true);
      assert.equal(r.stasisTurns, HEX_MAGAZINE_CONFIG.stasisLockedTurns);
      assert.equal(r.interruptIntent, true);
      assert.ok(r.apReduction >= 1);
    }
    // Action-level strip once: second call must not strip again
    if (ammo === 'SILVER_CORE') {
      const r2 = applyHexAmmoEffect({
        ammoType: ammo,
        isHeavyShot: true,
        hitIndex: 1,
        isBackline: false,
        isBoss: false,
        targetId: 'e1',
        targetHasKineticArmor: true,
        targetHasOccultWard: false,
        targetHasVoidMark: false,
        targetTelegraphing: false,
        overcharged: false,
        tracker: { ...tracker, strippedArmor: true },
      });
      assert.equal(r2.stripArmor, false);
    }
  }
}

// Overcharged Silver flat fracture
{
  const r = applyHexAmmoEffect({
    ammoType: 'SILVER_CORE',
    isHeavyShot: true,
    hitIndex: 0,
    isBackline: false,
    isBoss: false,
    targetId: 'e1',
    targetHasKineticArmor: false,
    targetHasOccultWard: false,
    targetHasVoidMark: false,
    targetTelegraphing: false,
    overcharged: true,
    tracker: createHexAmmoCastTracker(),
  });
  assert.equal(r.flatFractureBonus, 10);
  assert.equal(applyHexAmmoFractureBonus(15, r), Math.floor(15 * 1.25) + 10);
}

// Duration maps
{
  assert.equal(mergeDurationTurns(2, 3), 3);
  assert.deepEqual(tickDurationMap({ a: 2, b: 1 }), { a: 1 });
  const boon = createDefaultClassBoonEncounterState();
  boon.voidMarkTurnsRemaining.e1 = 2;
  boon.voidMarkedUnits.e1 = true;
  assert.equal(isUnitMarked(boon.voidMarkedUnits, boon.voidMarkTurnsRemaining, 'e1'), true);
  boon.voidMarkTurnsRemaining = tickDurationMap(boon.voidMarkTurnsRemaining);
  boon.voidMarkTurnsRemaining = tickDurationMap(boon.voidMarkTurnsRemaining);
  // Hub clears the boolean mirror when turns expire.
  if ((boon.voidMarkTurnsRemaining.e1 ?? 0) <= 0) delete boon.voidMarkedUnits.e1;
  assert.equal(isUnitMarked(boon.voidMarkedUnits, boon.voidMarkTurnsRemaining, 'e1'), false);
}

// Nonqualifying flex does not get heavy strips
{
  const r = applyHexAmmoEffect({
    ammoType: 'SILVER_CORE',
    isHeavyShot: isHexAmmoHeavyShot({
      abilityId: 'ASH_JACKET_SALVO',
      abilityTags: getHexShotAbilityTags('ASH_JACKET_SALVO'),
    }),
    hitIndex: 0,
    isBackline: false,
    isBoss: false,
    targetId: 'e1',
    targetHasKineticArmor: true,
    targetHasOccultWard: true,
    targetHasVoidMark: false,
    targetTelegraphing: false,
    overcharged: false,
    tracker: createHexAmmoCastTracker(),
  });
  assert.equal(r.stripArmor, false);
}

// Defense fixtures — strips vs KA / OW
{
  const ka = applyHexAmmoEffect({
    ammoType: 'SILVER_CORE',
    isHeavyShot: true,
    hitIndex: 0,
    isBackline: false,
    isBoss: false,
    targetId: armored.unitId!,
    targetHasKineticArmor: true,
    targetHasOccultWard: false,
    targetHasVoidMark: false,
    targetTelegraphing: false,
    overcharged: false,
    tracker: createHexAmmoCastTracker(),
  });
  assert.equal(ka.stripArmor, true);
  const ow = applyHexAmmoEffect({
    ammoType: 'WRAITHGLASS',
    isHeavyShot: true,
    hitIndex: 0,
    isBackline: false,
    isBoss: false,
    targetId: warded.unitId!,
    targetHasKineticArmor: false,
    targetHasOccultWard: true,
    targetHasVoidMark: false,
    targetTelegraphing: false,
    overcharged: false,
    tracker: createHexAmmoCastTracker(),
  });
  assert.equal(ow.stripWard, true);
}

// Ash 1/2/3 targets
{
  const one = planFor('hex-carbine', 1, [primary]);
  assert.equal(one.hits.length, 1);
  const two = planFor('hex-carbine', 1, [primary, adj]);
  assert.equal(two.hits.length, 2);
  // FL_1 adjacents are FL_0 + BL_1 only (4-slot grid).
  const three = planFor('hex-carbine', 1, [
    primary,
    adj,
    { ...adj, unitId: 'e6', gridSlot: 'BL_1' } as EnemyCombatProfile,
  ]);
  assert.equal(three.hits.length, 3);
  assert.equal(three.ammoCost, 1);
}

// Preview card uses catalog 10 + once-scaled plan
{
  for (const id of HEX_IDS) {
    const card = resolveWeaponAnchorCardPresentation({
      classId: 'HEX_SHOT',
      abilityId: 'SILVER_CORE_SIDEARM',
      weapon: resolveWeaponState(id),
      runtime: createDefaultWeaponRuntime(),
      catalogBaseDamage: HEX_SHOT_ABILITY_CATALOG.SILVER_CORE_SIDEARM.baseDamage,
      pulseSpreadSecondaryCount: 2,
      currentAmmo: 4,
    });
    assert.ok(card);
    const plan = planFor(id, 1, id === 'hex-carbine' ? [primary, adj] : [primary]);
    const expected = `${plan.hits[0]!.damage} BALLISTIC`;
    assert.equal(card!.primaryOutcome, expected, `${id} card preview`);
    if (id === 'hex-shotgun') {
      assert.ok(card!.secondaryCost?.includes('STAM'), 'Nullbreach stamina in preview');
    }
  }
}

// Names / anchors stable
for (const id of HEX_IDS) {
  assert.equal(getWeaponFamily(id).name, {
    'hex-revolver': 'Revolver',
    'hex-shotgun': 'Shotgun',
    'hex-carbine': 'Carbine',
  }[id]);
  assert.ok(getWeaponAnchorAttack(id));
}

// Ultimate invariance
{
  const seal = planSixthSeal({ grade: 'PERFECT', magSize: 6 });
  assert.equal(seal.precisionShots, 3);
  assert.equal(seal.emptyMagazineAfter, true);
  const knock = planLastKnock({ grade: 'CLEAN', currentAmmo: 3, baseBallistic: 16 });
  assert.ok(!('blocked' in knock));
  if (!('blocked' in knock)) assert.equal(knock.committedRounds, 3);
}

// Phase 3K / W.2 class-specific slot expectation
{
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    const p = getWeaponLoadoutRecommendationProfile(id);
    const classId = getWeaponFamily(id).classId;
    // Aegis + Hex: 3 persisted flex/technique slots. Envoy: 4-slot deck.
    const expected = classId === 'ENVOY' ? 4 : 3;
    p.sampleLoadouts.forEach((s) => assert.equal(s.slots.length, expected, `${id}`));
  });
}

// Aegis representative — Longsword name unchanged
assert.equal(getWeaponFamily('aegis-longsword').name, 'Longsword');
assert.equal(getWeaponFamily('envoy-vambrace').name, 'Vambrace');

console.log('Phase H.2a — all assertions passed');
