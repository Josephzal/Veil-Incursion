/**
 * Phase E.1b — Claymore family Fracture cashout + retired T3 FRACTURE_BREAK_RESERVE.
 * Stage II-C — T3 once-per-combat passives fail closed; family kit cashout remains.
 */
import assert from 'node:assert/strict';
import { resolveWeaponState } from './weaponProgressionEngine';
import { formatWeaponStatLines, runWeaponOnFractureHooks } from './weaponCombatEngine';
import { createDefaultWeaponRuntime } from './weaponRunState';
import { WEAPON_REGISTRY } from './weaponRegistry';
import { resolveClaymoreFractureBreakReserve } from './weaponBasicEngine';
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

const claymore = resolveWeaponState('aegis-claymore');

// Tierless Claymore baseline — no oncePerCombatPassive / T3 FRACTURE_BREAK_RESERVE
{
  assert.equal('oncePerCombatPassive' in claymore, false);
  assert.equal('passiveBonusPct' in claymore, false);
  assert.equal('tiers' in WEAPON_REGISTRY['aegis-claymore'], false);
  assert.deepEqual(claymore.statModifiers, WEAPON_REGISTRY['aegis-claymore'].baselineStatModifiers);
  assert.equal(claymore.effectSummary, WEAPON_REGISTRY['aegis-claymore'].baselineEffectSummary);
  assert.ok(!/stamina/i.test(claymore.effectSummary));
  assert.equal(weaponHasUnmakerTier3FractureBreakReserve(claymore), false);
  // Historical copy retained for compat docs, but not live effectSummary
  assert.ok(UNMAKER_T3_FRACTURE_BREAK_PLAYER_COPY.includes('Abyssal Reserve'));
}

// Legacy stamina / fracture hook path grants nothing (T3 retired)
{
  const hooks = runWeaponOnFractureHooks({
    weapon: claymore,
    runtime: createDefaultWeaponRuntime(),
    squad: [],
    player: { hp: 100, maxHp: 100 },
  } as never);
  assert.equal(hooks.staminaDelta ?? 0, 0);
  assert.equal((hooks.reserveDelta ?? 0), 0);
  assert.deepEqual(hooks.logLines, []);
}

// Family Claymore Fracture-break cashout still works (not the retired T3 passive)
{
  const first = resolveClaymoreFractureBreakReserve('aegis-claymore', createDefaultWeaponRuntime());
  const second = resolveClaymoreFractureBreakReserve(
    'aegis-claymore',
    { ...createDefaultWeaponRuntime(), claymoreBreakCashoutUsed: true },
  );
  assert.ok(first.reserveGain > second.reserveGain);
  assert.equal(first.runtimePatch?.claymoreBreakCashoutUsed, true);
  assert.equal(
    resolveClaymoreFractureBreakReserve('aegis-longsword', createDefaultWeaponRuntime()).reserveGain,
    0,
  );
}

// T3 FRACTURE_BREAK_RESERVE engine always inactive
{
  const base = {
    weapon: claymore,
    causesFractureBreak: true,
    abilityId: 'UNMAKER_STRIKE',
    playerActionId: 'act-1',
    echoHit: false,
    grantedForPlayerActionId: null as string | null,
  };
  const grant = resolveUnmakerTier3FractureBreakReserveGrant(base);
  assert.equal(grant.reserveGain, 0);
  assert.equal(grant.nextGrantedForPlayerActionId, null);
  assert.equal(grant.logLine, null);

  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base, causesFractureBreak: false,
  }).reserveGain, 0);

  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base, echoHit: true,
  }).reserveGain, 0);

  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base, abilityId: 'DOOMFALL', playerActionId: 'df-release',
  }).reserveGain, 0);

  assert.equal(resolveUnmakerTier3FractureBreakReserveGrant({
    ...base, abilityId: 'WARDENS_STRIKE', playerActionId: 'act-w',
  }).reserveGain, 0);
}

assert.equal(UNMAKER_T3_FRACTURE_BREAK_RESERVE_AMOUNT, 1);

{
  const g = resolveUnmakerTier3FractureBreakReserveGrant({
    weapon: claymore,
    causesFractureBreak: true,
    abilityId: 'UNBOWED',
    playerActionId: 'act-u',
    echoHit: false,
    grantedForPlayerActionId: null,
  });
  assert.deepEqual(Object.keys(g).sort(), ['logLine', 'nextGrantedForPlayerActionId', 'reserveGain']);
  assert.equal(g.reserveGain, 0);
}

// strikeDamagePct not applied to WA; UI does not claim Strike Damage for Aegis
{
  const lines = formatWeaponStatLines(claymore);
  assert.ok(!lines.some((l) => /Strike Damage/i.test(l)));
  assert.ok(!lines.some((l) => /Stamina Cost/i.test(l)));
  assert.ok(lines.some((l) => /Fracture from melee/i.test(l)));
  assert.ok(!lines.some((l) => /Abyssal Reserve/i.test(l)));

  for (const fam of ['aegis-longsword', 'aegis-paired-blades', 'aegis-claymore'] as const) {
    const famLines = formatWeaponStatLines(resolveWeaponState(fam));
    assert.ok(
      !famLines.some((l) => /Strike Damage/i.test(l)),
      `${fam} must not claim Strike Damage for WA surface`,
    );
  }

  // Baseline retains dormant strikeDamagePct / technique fields (former T1)
  assert.equal(WEAPON_REGISTRY['aegis-claymore'].baselineStatModifiers.strikeDamagePct, 15);
  assert.equal(WEAPON_REGISTRY['aegis-claymore'].baselineStatModifiers.aegisTechniquePowerPct, 15);
}

// All 12 ungrafted WA damage plans unchanged
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

// E.1a graft totals unchanged
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
    weapon: claymore,
    causesFractureBreak: true,
    abilityId: 'UNMAKER_STRIKE',
    playerActionId: 'echo-act',
    echoHit: true,
    grantedForPlayerActionId: null,
  }).reserveGain, 0);
}

// Hex / Envoy smoke — class graft scale unchanged
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

assert.deepEqual(deriveAegisWeaponActions('aegis-claymore'), [
  'UNMAKER_STRIKE', 'DREAD_HORIZON', 'UNBOWED', 'DOOMFALL',
]);

// Deprecated alias still fails closed (Stage II-C)
assert.equal(weaponHasUnmakerTier3FractureBreakReserve({
  familyId: 'aegis-claymore',
}), false);

console.log('aegisUnmakerTierE1b.test.ts: ok');
