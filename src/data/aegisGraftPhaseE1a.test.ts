/**
 * Phase E.1a — Aegis graft-scaling correctness + presentation alignment.
 * Proves damageMultiplier is applied exactly once on the transformed WA plan path.
 */
import assert from 'node:assert/strict';
import {
  applyGraftTransformToWeaponPlan,
  buildWeaponActionGraftCastPlan,
  previewWeaponActionGraftHitDamages,
  weaponHitPlanDamage,
  type GraftTaggedWeaponHit,
} from './aegisWeaponActionGraftEngine';
import {
  planAegisWeaponAction,
  planDivergence,
  planNoRespite,
  planWardensStrike,
} from './aegisWeaponActionResolveEngine';
import { evaluateAegisGraftCompatibility, weaponActionHasDirectDamage } from './aegisGraftCompatibility';
import { scaleGraftDamage, buildGraftCastPlan } from './veilGraftEngine';
import { GRAFT_DATABASE, getVeilGraftDefinition } from './veilGraftDatabase';
import type { VeilGraftId } from '../types/veilGraft';
import { COMBAT_CHANCE } from '../types/combatChance';
import { getAbilityDefinition } from './aegisAbilities';
import { resolvePlayerCritChance } from './combatChanceEngine';
import { scaleClassGraftDamage, buildClassGraftCastPlan } from './classGraftEngine';
import { castAegisWeaponAction, createSimWorld } from './aegisWeaponActionSimulator';

const MULTIPLIER_GRAFTS = (Object.keys(GRAFT_DATABASE) as VeilGraftId[]).filter(
  (id) => GRAFT_DATABASE[id].damageMultiplier != null,
);

function planWithBase(baseKinetic: number): ReturnType<typeof planWardensStrike> {
  const plan = planWardensStrike();
  return {
    ...plan,
    hits: plan.hits.map((h) => ({ ...h, kineticDamage: baseKinetic })),
  };
}

function onceScaled(base: number, mult: number): number {
  return Math.floor(base * mult);
}

function squaredScaled(base: number, mult: number): number {
  return Math.floor(onceScaled(base, mult) * mult);
}

// 1. Ungrafted weapon action unchanged
{
  const plan = planWardensStrike();
  const empty = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', undefined);
  const damages = previewWeaponActionGraftHitDamages(plan, empty);
  assert.deepEqual(damages, [14]);
  const passthrough = applyGraftTransformToWeaponPlan(plan, empty);
  assert.equal(passthrough.hits.length, 1);
  assert.equal(weaponHitPlanDamage(passthrough.hits[0]!), 14);
}

// 2–6 + multi-base Density / Marrow / Shrapnel / Echo / Splinter
for (const base of [14, 24, 11, 15]) {
  const plan = planWithBase(base);

  {
    const gp = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'DENSITY_GRAFT');
    const hits = previewWeaponActionGraftHitDamages(plan, gp);
    assert.deepEqual(hits, [onceScaled(base, 2)], `Density once @${base}`);
    assert.notEqual(hits[0], squaredScaled(base, 2));
  }

  {
    const gp = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'ECHO_GRAFT');
    const transformed = applyGraftTransformToWeaponPlan(plan, gp);
    const authored = transformed.hits.filter((h: GraftTaggedWeaponHit) => !h.graftAdded);
    const echoes = transformed.hits.filter((h: GraftTaggedWeaponHit) => h.graftAdded);
    assert.equal(authored.length, 1);
    assert.equal(echoes.length, 1);
    assert.equal(weaponHitPlanDamage(authored[0]!), base);
    assert.equal(weaponHitPlanDamage(echoes[0]!), onceScaled(base, 0.5));
    const total = previewWeaponActionGraftHitDamages(plan, gp).reduce((a, b) => a + b, 0);
    assert.equal(total, base + onceScaled(base, 0.5), `Echo 150% @${base}`);
  }

  {
    const gp = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'SPLINTER_GRAFT');
    const hits = previewWeaponActionGraftHitDamages(plan, gp);
    assert.equal(hits.length, 3);
    const expected = onceScaled(base, 0.8);
    assert.ok(hits.every((d) => d === expected), `Splinter once @${base}`);
    assert.notEqual(expected, squaredScaled(base, 0.8));
  }

  {
    const gp = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'MARROW_GRAFT');
    assert.deepEqual(
      previewWeaponActionGraftHitDamages(plan, gp),
      [onceScaled(base, 0.7)],
      `Marrow once @${base}`,
    );
  }

  {
    const gp = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'SHRAPNEL_GRAFT');
    assert.deepEqual(
      previewWeaponActionGraftHitDamages(plan, gp),
      [onceScaled(base, 0.6)],
      `Shrapnel once @${base}`,
    );
  }
}

// Canonical Warden 14 examples
{
  const plan = planWardensStrike();
  assert.deepEqual(
    previewWeaponActionGraftHitDamages(plan, buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'DENSITY_GRAFT')),
    [28],
  );
  assert.deepEqual(
    previewWeaponActionGraftHitDamages(plan, buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'ECHO_GRAFT')),
    [14, 7],
  );
  assert.deepEqual(
    previewWeaponActionGraftHitDamages(plan, buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'SPLINTER_GRAFT')),
    [11, 11, 11],
  );
  assert.deepEqual(
    previewWeaponActionGraftHitDamages(plan, buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'MARROW_GRAFT')),
    [9],
  );
  assert.deepEqual(
    previewWeaponActionGraftHitDamages(plan, buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'SHRAPNEL_GRAFT')),
    [8],
  );
}

// 7. Every compatible Aegis damageMultiplier graft applies once (hub must not square)
{
  const families: Array<{ actionId: 'WARDENS_STRIKE' | 'NO_RESPITE' | 'UNMAKER_STRIKE'; base: number }> = [
    { actionId: 'WARDENS_STRIKE', base: 14 },
    { actionId: 'NO_RESPITE', base: 24 },
    { actionId: 'UNMAKER_STRIKE', base: 15 },
  ];
  for (const { actionId, base } of families) {
    const plan = planAegisWeaponAction(actionId, {
      tempoArmed: false,
      targetFracturedAtStart: false,
      noRespiteUsedThisTurn: false,
      doomfallReleaseAvailable: false,
    });
    assert.equal(weaponHitPlanDamage(plan.hits[0]!), base);
    for (const graftId of MULTIPLIER_GRAFTS) {
      const compat = evaluateAegisGraftCompatibility({
        target: { kind: 'WEAPON_ACTION', actionId },
        graftId,
        allowFixedBasic: true,
      });
      if (!compat.ok) continue;
      const gp = buildWeaponActionGraftCastPlan(actionId, graftId);
      const mult = gp.damageMultiplier;
      const damages = previewWeaponActionGraftHitDamages(plan, gp);
      const expectedEach = onceScaled(base, mult);
      // Splinter expands; others keep authored count (Echo adds separate duplicate).
      if (graftId === 'SPLINTER_GRAFT') {
        assert.equal(damages.length, 3);
        assert.ok(damages.every((d) => d === expectedEach), `${graftId} ${actionId}`);
      } else if (graftId === 'ECHO_GRAFT') {
        // Echo has no authored damageMultiplier (defaults 1) — covered above.
        assert.equal(damages[0], base);
      } else {
        assert.equal(damages[0], expectedEach, `${graftId} once on ${actionId}`);
      }
      // Prove hub re-scale would square (regression detector).
      if (mult !== 1 && graftId !== 'ECHO_GRAFT') {
        const hubSquared = scaleGraftDamage(damages[0]!, gp, 0, false);
        assert.equal(hubSquared, squaredScaled(base, mult));
        const hubOnce = scaleGraftDamage(damages[0]!, gp, 0, false, { damageAlreadyScaled: true });
        assert.equal(hubOnce, damages[0]!);
      }
    }
  }
}

// 8. Graft-added hits strip secondary state
{
  const plan = planWardensStrike();
  for (const graftId of ['ECHO_GRAFT', 'SPLINTER_GRAFT'] as const) {
    const gp = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', graftId);
    const transformed = applyGraftTransformToWeaponPlan(plan, gp);
    const graftHits = transformed.hits.filter((h: GraftTaggedWeaponHit) => h.graftAdded);
    assert.ok(graftHits.length > 0);
    assert.ok(graftHits.every((h) => h.reserveGain === 0 && h.armorStrip === 0));
    if (graftId === 'ECHO_GRAFT') {
      assert.ok(graftHits.every((h) => h.fractureGain === 0));
    }
  }
}

// 9. Divergence — one transform, both blades; graft costs not per-blade in plan AP
{
  const plan = planDivergence();
  assert.equal(plan.hits.length, 2);
  const gp = buildWeaponActionGraftCastPlan('DIVERGENCE', 'DENSITY_GRAFT');
  const transformed = applyGraftTransformToWeaponPlan(plan, gp);
  assert.equal(transformed.hits.filter((h: GraftTaggedWeaponHit) => !h.graftAdded).length, 2);
  assert.equal(weaponHitPlanDamage(transformed.hits[0]!), onceScaled(plan.hits[0]!.kineticDamage, 2));
  assert.equal(weaponHitPlanDamage(transformed.hits[1]!), onceScaled(plan.hits[1]!.kineticDamage, 2));
  assert.equal(transformed.apCost, gp.apCost);
  const echo = buildWeaponActionGraftCastPlan('DIVERGENCE', 'ECHO_GRAFT');
  const echoed = applyGraftTransformToWeaponPlan(plan, echo);
  assert.equal(echoed.hits.filter((h: GraftTaggedWeaponHit) => !h.graftAdded).length, 2);
  assert.equal(echoed.hits.filter((h: GraftTaggedWeaponHit) => h.graftAdded).length, 2);
}

// 10. Doomfall — Charge does not expand; Release transforms once; hub does not rescale
{
  const charge = planAegisWeaponAction('DOOMFALL', {
    tempoArmed: false,
    targetFracturedAtStart: true,
    noRespiteUsedThisTurn: false,
    doomfallReleaseAvailable: false,
  });
  assert.equal(charge.stage, 'CHARGE');
  const density = buildWeaponActionGraftCastPlan('DOOMFALL', 'DENSITY_GRAFT');
  assert.deepEqual(previewWeaponActionGraftHitDamages(charge, density), []);

  const release = planAegisWeaponAction('DOOMFALL', {
    tempoArmed: false,
    targetFracturedAtStart: true,
    noRespiteUsedThisTurn: false,
    doomfallReleaseAvailable: true,
    doomfallOriginActionId: 'DOOMFALL',
  });
  assert.equal(release.stage, 'RELEASE');
  const releaseDamages = previewWeaponActionGraftHitDamages(release, density);
  const releaseBase = weaponHitPlanDamage(release.hits[0]!);
  assert.deepEqual(releaseDamages, [onceScaled(releaseBase, 2)]);
  assert.equal(
    scaleGraftDamage(releaseDamages[0]!, density, 0, false, { damageAlreadyScaled: true }),
    releaseDamages[0]!,
  );
  // Interrupted Charge clears staged plan — ref cleared by hub; plan has no residual hits.
  assert.equal(charge.hits.length, 0);
}

// 11. Technique still applies graft multiplier exactly once (hub path, not WA pre-scale)
{
  const techPlan = buildGraftCastPlan('SHADOW_STEP', 'DENSITY_GRAFT');
  assert.equal(techPlan.damageMultiplier, 2);
  const raw = 16;
  assert.equal(scaleGraftDamage(raw, techPlan, 0, false), 32);
  assert.equal(scaleGraftDamage(raw, techPlan, 0, false, { damageAlreadyScaled: true }), 16);
}

// 12–13. Hex Shot / Envoy representative grafted actions unchanged (class scale path)
{
  const hex = buildClassGraftCastPlan('HEX_SHOT', 'SILVER_CORE_SIDEARM', 'BOTTOMLESS_DRUM_GRAFT');
  assert.equal(hex.damageMultiplier, 1.5);
  const hexScaled = scaleClassGraftDamage(10, hex, {
    currentAmmo: 6, maxAmmo: 6, veilFlux: 0, fluxMaxCap: 100,
  });
  assert.equal(hexScaled, 15);

  const envoy = buildClassGraftCastPlan('ENVOY', 'VEIL_SPLINTER', 'VOID_CONDUCTOR_GRAFT');
  assert.equal(envoy.damageMultiplier, 2);
  const envoyScaled = scaleClassGraftDamage(20, envoy, {
    currentAmmo: 0, maxAmmo: 0, veilFlux: 40, fluxMaxCap: 100,
  });
  assert.equal(envoyScaled, 40);
}

// 14. Preview totals match transform (executor input)
{
  for (const graftId of MULTIPLIER_GRAFTS) {
    const plan = planWardensStrike();
    const gp = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', graftId);
    const preview = previewWeaponActionGraftHitDamages(plan, gp);
    const exec = applyGraftTransformToWeaponPlan(plan, gp).hits.map(weaponHitPlanDamage);
    assert.deepEqual(preview, exec, `preview==transform ${graftId}`);
  }
}

// 15. Echo copy matches 150% behavior
{
  const desc = getVeilGraftDefinition('ECHO_GRAFT').description.toLowerCase();
  assert.ok(desc.includes('primary') || desc.includes('150%') || desc.includes('echo'));
  assert.ok(!desc.includes('twice at 50%'));
}

// 16. Fractured — NO_RESPITE / simulator / live agree: no 1.25 damage mod
{
  const payoff = planNoRespite({ targetFracturedAtStart: true, alreadyUsedThisTurn: false });
  assert.equal(payoff.noRespiteApRefund, 1);
  assert.equal(payoff.noRespiteReserveBonus, 10);
  assert.equal(weaponHitPlanDamage(payoff.hits[0]!), 24);

  let world = createSimWorld();
  world.enemies[0] = {
    ...world.enemies[0]!,
    hp: 200,
    maxHp: 200,
    fractured: true,
    fracture: 100,
  };
  world = castAegisWeaponAction(world, { actionId: 'NO_RESPITE', targetId: 'e0', forceHit: true });
  const enemy = world.enemies.find((e) => e.id === 'e0')!;
  // 200 - 24 (no 1.25) = 176
  assert.equal(enemy.hp, 176);
}

// 17. VEIL_PIERCER displayed crit matches runtime COMBAT_CHANCE
{
  const def = getAbilityDefinition('VEIL_PIERCER');
  assert.equal(def.critBonusPct, Math.round(COMBAT_CHANCE.VEIL_PIERCER_CRIT_BONUS * 100));
  const { chance } = resolvePlayerCritChance({
    abilityId: 'VEIL_PIERCER',
    target: { evadeChance: 0 } as never,
    factionCritBonus: 0,
    hasShatterPoint: false,
    guaranteedCrits: 0,
  });
  assert.equal(chance, COMBAT_CHANCE.PLAYER_BASE_CRIT + COMBAT_CHANCE.VEIL_PIERCER_CRIT_BONUS);
  assert.ok(def.description.includes('+10% crit'));
}

// 18. ECLIPSE / UNBOWED retain setup-stance Echo/Splinter ineligibility
{
  for (const actionId of ['ECLIPSE', 'UNBOWED'] as const) {
    assert.equal(weaponActionHasDirectDamage(actionId), false);
    for (const graftId of ['ECHO_GRAFT', 'SPLINTER_GRAFT'] as const) {
      const r = evaluateAegisGraftCompatibility({
        target: { kind: 'WEAPON_ACTION', actionId },
        graftId,
        allowFixedBasic: true,
      });
      assert.equal(r.ok, false, `${actionId}+${graftId}`);
    }
    // Incidental kinetic exists but does not grant hit-replacement eligibility.
    const plan = planAegisWeaponAction(actionId, {
      tempoArmed: false,
      targetFracturedAtStart: false,
      noRespiteUsedThisTurn: false,
      doomfallReleaseAvailable: false,
    });
    assert.equal(weaponHitPlanDamage(plan.hits[0]!), 10);
  }
}

// Heal / AoE derive from once-scaled damage (Marrow / Shrapnel plan values)
{
  const plan = planWardensStrike();
  const marrow = applyGraftTransformToWeaponPlan(
    plan,
    buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'MARROW_GRAFT'),
  );
  const marrowDmg = weaponHitPlanDamage(marrow.hits[0]!);
  assert.equal(marrowDmg, 9);
  const healPct = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'MARROW_GRAFT').healOnDamagePct;
  assert.equal(Math.floor(marrowDmg * healPct), 4);

  const shrapnelPlan = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'SHRAPNEL_GRAFT');
  assert.ok(shrapnelPlan.effectiveTags.includes('AOE'));
  assert.equal(
    previewWeaponActionGraftHitDamages(plan, shrapnelPlan)[0],
    8,
  );
}

console.log('aegisGraftPhaseE1a.test.ts: ok');
