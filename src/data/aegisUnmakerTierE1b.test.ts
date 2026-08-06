/**
 * Phase E.1b — Unmaker Tier III Fracture-break Reserve + Aegis strikeDamagePct presentation.
 */
import assert from 'node:assert/strict';
import { resolveWeaponState } from './weaponProgressionEngine';
import { formatWeaponStatLines, runWeaponOnFractureHooks } from './weaponCombatEngine';
import { createDefaultWeaponRuntime } from './weaponRunState';
import { WEAPON_REGISTRY } from './weaponRegistry';
import {
  UNMAKER_T3_FRACTURE_BREAK_PLAYER_COPY,
  UNMAKER_T3_FRACTURE_BREAK_RESERVE_AMOUNT,
  resolveUnmakerTier3FractureBreakReserveGrant,
  weaponHasUnmakerTier3FractureBreakReserve,
} from './unmakerTier3FractureBreakEngine';
import {
  applyGraftTransformToWeaponPlan,
  buildWeaponActionGraftCastPlan,
  previewWeaponActionGraftHitDamages,
  weaponHitPlanDamage,
} from './aegisWeaponActionGraftEngine';
import { planAegisWeaponAction, planWardensStrike } from './aegisWeaponActionResolveEngine';
import { deriveAegisWeaponActions } from './aegisWeaponActionRegistry';
import { scaleClassGraftDamage, buildClassGraftCastPlan } from './classGraftEngine';

const unmakerT1 = resolveWeaponState('aegis-claymore-blade', 1);
const unmakerT2 = resolveWeaponState('aegis-claymore-blade', 2);
const unmakerT3 = resolveWeaponState('aegis-claymore-blade', 3);

// 1–2. Tier I/II unchanged passives; T3 no Stamina
{
  assert.equal(unmakerT1.oncePerCombatPassive, undefined);
  assert.equal(unmakerT2.oncePerCombatPassive, undefined);
  assert.equal(unmakerT3.oncePerCombatPassive, 'FRACTURE_BREAK_RESERVE');
  assert.equal(unmakerT3.passiveBonusPct, 1);
  assert.ok(!/stamina/i.test(unmakerT3.effectSummary));
  assert.ok(unmakerT3.effectSummary.includes('Abyssal Reserve'));
  assert.equal(unmakerT3.effectSummary, UNMAKER_T3_FRACTURE_BREAK_PLAYER_COPY);
  assert.ok(weaponHasUnmakerTier3FractureBreakReserve(unmakerT3));
  assert.equal(weaponHasUnmakerTier3FractureBreakReserve(unmakerT1), false);
  assert.equal(weaponHasUnmakerTier3FractureBreakReserve(unmakerT2), false);
}

// Legacy stamina hook path grants nothing
{
  const hooks = runWeaponOnFractureHooks({
    weapon: unmakerT3,
    runtime: createDefaultWeaponRuntime(),
    squad: [],
    player: { hp: 100, maxHp: 100 },
  } as never);
  assert.equal(hooks.staminaDelta ?? 0, 0);
  assert.equal((hooks.reserveDelta ?? 0), 0);
  assert.deepEqual(hooks.logLines, []);
}

// 3–9. Grant rules
{
  const base = {
    weapon: unmakerT3,
    causesFractureBreak: true,
    abilityId: 'UNMAKER_STRIKE',
    playerActionId: 'act-1',
    echoHit: false,
    grantedForPlayerActionId: null as string | null,
  };
  const grant = resolveUnmakerTier3FractureBreakReserveGrant(base);
  assert.equal(grant.reserveGain, UNMAKER_T3_FRACTURE_BREAK_RESERVE_AMOUNT);
  assert.equal(grant.nextGrantedForPlayerActionId, 'act-1');
  assert.ok(grant.logLine?.includes('Abyssal Reserve'));

  // No break
  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base, causesFractureBreak: false,
  }).reserveGain, 0);

  // Graft-added
  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base, echoHit: true,
  }).reserveGain, 0);

  // Once per action
  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base, grantedForPlayerActionId: 'act-1',
  }).reserveGain, 0);

  // Multi-hit same action — second call blocked
  const first = resolveUnmakerTier3FractureBreakReserveGrant(base);
  const second = resolveUnmakerTier3FractureBreakReserveGrant({
    ...base,
    grantedForPlayerActionId: first.nextGrantedForPlayerActionId,
  });
  assert.equal(first.reserveGain, 1);
  assert.equal(second.reserveGain, 0);

  // Multi-target (Horizon) — same playerActionId
  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base,
    abilityId: 'DREAD_HORIZON',
    playerActionId: 'act-row',
    grantedForPlayerActionId: 'act-row',
  }).reserveGain, 0);

  // Density etc. do not change count (still 1)
  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base, playerActionId: 'act-dens',
  }).reserveGain, 1);

  // Non-Unmaker WA
  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base, abilityId: 'WARDENS_STRIKE', playerActionId: 'act-w',
  }).reserveGain, 0);

  // T1/T2 never
  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base, weapon: unmakerT1,
  }).reserveGain, 0);
}

// 10–12. Doomfall Charge / Release / interrupt semantics (engine-level)
{
  // Charge has no fracture delivery — no grant without causesFractureBreak
  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    weapon: unmakerT3,
    causesFractureBreak: false,
    abilityId: 'DOOMFALL',
    playerActionId: 'df-charge',
    echoHit: false,
    grantedForPlayerActionId: null,
  }).reserveGain, 0);

  // Release may grant once when break occurs
  const release = resolveUnmakerTier3FractureBreakReserveGrant({
    weapon: unmakerT3,
    causesFractureBreak: true,
    abilityId: 'DOOMFALL',
    playerActionId: 'df-release',
    echoHit: false,
    grantedForPlayerActionId: null,
  });
  assert.equal(release.reserveGain, 1);

  // Interrupted Charge = no Release break → nothing (no grant key without break)
  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    weapon: unmakerT3,
    causesFractureBreak: false,
    abilityId: 'DOOMFALL',
    playerActionId: 'df-interrupted',
    echoHit: false,
    grantedForPlayerActionId: null,
  }).reserveGain, 0);
}

// 13. Cap respected by chargeAr — grant amount is 1 (hub Math.min with cap)
assert.equal(UNMAKER_T3_FRACTURE_BREAK_RESERVE_AMOUNT, 1);

// 14. No Brand/AP/etc. — grant result only exposes reserveGain + log
{
  const g = resolveUnmakerTier3FractureBreakReserveGrant({
    weapon: unmakerT3,
    causesFractureBreak: true,
    abilityId: 'UNBOWED',
    playerActionId: 'act-u',
    echoHit: false,
    grantedForPlayerActionId: null,
  });
  assert.deepEqual(Object.keys(g).sort(), ['logLine', 'nextGrantedForPlayerActionId', 'reserveGain']);
}

// 15–16. strikeDamagePct not applied to WA; UI does not claim Strike Damage for Aegis
{
  const linesT3 = formatWeaponStatLines(unmakerT3);
  assert.ok(!linesT3.some((l) => /Strike Damage/i.test(l)));
  assert.ok(!linesT3.some((l) => /Stamina Cost/i.test(l)));
  assert.ok(linesT3.some((l) => /Fracture from melee/i.test(l)));
  assert.ok(linesT3.some((l) => /Abyssal Reserve/i.test(l)));

  for (const fam of ['aegis-runed-longsword', 'aegis-rift-edge', 'aegis-claymore-blade'] as const) {
    for (const tier of [1, 2, 3] as const) {
      const lines = formatWeaponStatLines(resolveWeaponState(fam, tier));
      assert.ok(
        !lines.some((l) => /Strike Damage/i.test(l)),
        `${fam} T${tier} must not claim Strike Damage for WA surface`,
      );
    }
  }

  // Fields remain dormant on registry (migration/legacy)
  assert.equal(WEAPON_REGISTRY['aegis-claymore-blade'].tiers[2].statModifiers.strikeDamagePct, 25);
}

// 17. All 12 ungrafted WA damage plans unchanged
{
  const expected: Record<string, number[]> = {
    WARDENS_STRIKE: [14],
    RUPTURE: [8],
    DREADBIND: [10],
    NO_RESPITE: [24],
    PAIRED_BLADES_STRIKE: [11],
    DIVERGENCE: [5, 5],
    ECLIPSE: [10],
    SEVERANCE: [12, 12],
    UNMAKER_STRIKE: [15],
    DREAD_HORIZON: [12, 12],
    UNBOWED: [10],
  };
  for (const [id, hits] of Object.entries(expected)) {
    const plan = planAegisWeaponAction(id as never, {
      tempoArmed: false,
      targetFracturedAtStart: false,
      noRespiteUsedThisTurn: false,
      doomfallReleaseAvailable: false,
    });
    assert.deepEqual(plan.hits.map(weaponHitPlanDamage), hits, id);
  }
  const charge = planAegisWeaponAction('DOOMFALL', {
    tempoArmed: false,
    targetFracturedAtStart: false,
    noRespiteUsedThisTurn: false,
    doomfallReleaseAvailable: false,
  });
  assert.equal(charge.stage, 'CHARGE');
  assert.deepEqual(charge.hits, []);
  const release = planAegisWeaponAction('DOOMFALL', {
    tempoArmed: false,
    targetFracturedAtStart: true,
    noRespiteUsedThisTurn: false,
    doomfallReleaseAvailable: true,
    doomfallOriginActionId: 'DOOMFALL',
  });
  assert.deepEqual(release.hits.map(weaponHitPlanDamage), [46]);
}

// 18. E.1a graft totals unchanged
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
  // Graft-added cannot grant (echo hits tagged)
  const echoed = applyGraftTransformToWeaponPlan(
    planAegisWeaponAction('UNMAKER_STRIKE', {
      tempoArmed: false,
      targetFracturedAtStart: false,
      noRespiteUsedThisTurn: false,
      doomfallReleaseAvailable: false,
    }),
    buildWeaponActionGraftCastPlan('UNMAKER_STRIKE', 'ECHO_GRAFT'),
  );
  assert.ok(echoed.hits.some((h) => h.graftAdded));
  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    weapon: unmakerT3,
    causesFractureBreak: true,
    abilityId: 'UNMAKER_STRIKE',
    playerActionId: 'echo-act',
    echoHit: true,
    grantedForPlayerActionId: null,
  }).reserveGain, 0);
}

// 19. Hex / Envoy smoke — class graft scale unchanged
{
  const hex = buildClassGraftCastPlan('HEX_SHOT', 'SILVER_CORE_SIDEARM', 'BOTTOMLESS_DRUM_GRAFT');
  assert.equal(scaleClassGraftDamage(10, hex, {
    currentAmmo: 6, maxAmmo: 6, veilFlux: 0, fluxMaxCap: 100,
  }), 15);
  const envoy = buildClassGraftCastPlan('ENVOY', 'VEIL_SPLINTER', 'VOID_CONDUCTOR_GRAFT');
  assert.equal(scaleClassGraftDamage(20, envoy, {
    currentAmmo: 0, maxAmmo: 0, veilFlux: 40, fluxMaxCap: 100,
  }), 40);
}

// Surface still 4 Unmaker actions
assert.deepEqual(deriveAegisWeaponActions('aegis-claymore-blade'), [
  'UNMAKER_STRIKE', 'DREAD_HORIZON', 'UNBOWED', 'DOOMFALL',
]);

// Deprecated alias still recognized
assert.ok(weaponHasUnmakerTier3FractureBreakReserve({
  familyId: 'aegis-claymore-blade',
  oncePerCombatPassive: 'FIRST_FRACTURE_STAMINA_REFUND',
}));

console.log('aegisUnmakerTierE1b.test.ts: ok');
