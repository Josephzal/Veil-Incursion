/**
 * Phase 3C–3F weapon identity / unique basic verification.
 * Run: npx --yes tsx src/data/weaponBasicEngine.test.ts
 */
import assert from 'node:assert/strict';
import {
  resolveAegisStrikeBasic,
  resolveClaymoreFractureBreakReserve,
  resolveEnvoySplinterBasic,
  resolveHexBasicShot,
  PRISM_BRINK_FLUX_THRESHOLD,
} from './weaponBasicEngine';
import { createDefaultWeaponRuntime } from './weaponRunState';
import { resolveWeaponState } from './weaponProgressionEngine';
import {
  formatWeaponIdentityDebug,
  listWeaponIdentityProfiles,
  validateWeaponIdentityProfiles,
} from './weaponIdentityProfiles';
import { ALL_WEAPON_FAMILY_IDS } from './weaponRegistry';
import {
  runWeaponOnDebuffAppliedHooks,
  runWeaponOnOccultCastHooks,
  runWeaponOnSacrificeHpHooks,
} from './weaponCombatEngine';
import type { CombatSessionExtras } from '../types/combatHooks';
import { createDefaultCombatSessionExtras } from '../types/combatHooks';
import type { EnemyCombatProfile } from '../types/run';

function makeHookCtx(familyId: Parameters<typeof resolveWeaponState>[0], runtime = createDefaultWeaponRuntime()) {
  const weapon = resolveWeaponState(familyId, 3);
  return {
    weapon,
    runtime,
    blueprintId: null,
    player: {
      hp: 100,
      maxHp: 100,
      shield: 0,
      shieldTurnsRemaining: 0,
      debuffs: [] as import('../types/combatHooks').PlayerDebuffId[],
    },
    squad: [] as EnemyCombatProfile[],
  };
}

function run(): void {
  const identityIssues = validateWeaponIdentityProfiles();
  assert.equal(identityIssues.length, 0, identityIssues.join('; '));
  assert.equal(listWeaponIdentityProfiles().length, 9);

  // --- Aegis basics diverge ---
  const longsword = resolveAegisStrikeBasic({
    weapon: resolveWeaponState('aegis-runed-longsword', 1),
    runtime: createDefaultWeaponRuntime(),
    riposte: false,
    targetFractured: false,
  });
  const claymore = resolveAegisStrikeBasic({
    weapon: resolveWeaponState('aegis-claymore-blade', 1),
    runtime: createDefaultWeaponRuntime(),
    riposte: false,
    targetFractured: false,
  });
  const riftCold = resolveAegisStrikeBasic({
    weapon: resolveWeaponState('aegis-rift-edge', 1),
    runtime: createDefaultWeaponRuntime(),
    riposte: false,
    targetFractured: false,
  });
  const riftHot = resolveAegisStrikeBasic({
    weapon: resolveWeaponState('aegis-rift-edge', 1),
    runtime: { ...createDefaultWeaponRuntime(), riftEdgeTempoArmed: true },
    riposte: false,
    targetFractured: false,
  });
  assert.ok(claymore.staminaCost > longsword.staminaCost, 'Claymore should cost stamina');
  assert.ok(claymore.fractureGain > longsword.fractureGain, 'Claymore should apply more Fracture');
  assert.equal(riftCold.occultRiderDamage, 0, 'Veil Edge without tempo is Kinetic-only');
  assert.ok(riftHot.occultRiderDamage > 0, 'Veil Edge with tempo adds Occult rider');
  assert.ok(riftHot.consumeTempo, 'Tempo should be consumed on payoff');

  const clayCash1 = resolveClaymoreFractureBreakReserve(
    'aegis-claymore-blade',
    createDefaultWeaponRuntime(),
  );
  const clayCash2 = resolveClaymoreFractureBreakReserve(
    'aegis-claymore-blade',
    { ...createDefaultWeaponRuntime(), claymoreBreakCashoutUsed: true },
  );
  assert.ok(clayCash1.reserveGain > clayCash2.reserveGain, 'First Claymore break cashout is larger');
  assert.equal(
    resolveClaymoreFractureBreakReserve('aegis-runed-longsword', createDefaultWeaponRuntime()).reserveGain,
    0,
  );

  // --- Hex basics diverge; ammo payload is shared (delivery differs) ---
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

  const sidearm = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-silver-core-sidearm', 1),
    squad,
    primaryTargetId: 'e1',
    catalogBaseDamage: 10,
  });
  const breach = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-void-cannon', 1),
    squad,
    primaryTargetId: 'e1',
    catalogBaseDamage: 10,
  });
  const spread = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-pulse-rifle', 1),
    squad,
    primaryTargetId: 'e1',
    catalogBaseDamage: 10,
  });
  assert.equal(sidearm.delivery, 'PRECISION');
  assert.equal(sidearm.hits.length, 1);
  assert.equal(breach.delivery, 'BREACH');
  assert.ok(breach.hits[0]!.damage > sidearm.hits[0]!.damage);
  assert.ok(breach.staminaCost > 0);
  assert.equal(spread.delivery, 'SPREAD');
  assert.ok(spread.hits.length >= 1);
  // Low-HP execution window on sidearm
  const exec = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-silver-core-sidearm', 1),
    squad: [{ ...primary, currentHp: 20 }],
    primaryTargetId: 'e1',
    catalogBaseDamage: 10,
  });
  assert.ok(exec.hits[0]!.damage > sidearm.hits[0]!.damage);

  // --- Envoy basics diverge ---
  const conduit = resolveEnvoySplinterBasic({
    weapon: resolveWeaponState('envoy-null-conduit', 2),
    catalogDamage: 10,
    catalogFluxCost: 5,
    veilFlux: 80,
    operativeHp: 100,
    maxHp: 100,
  });
  const lantern = resolveEnvoySplinterBasic({
    weapon: resolveWeaponState('envoy-echo-lantern', 1),
    catalogDamage: 10,
    catalogFluxCost: 5,
    veilFlux: 80,
    operativeHp: 100,
    maxHp: 100,
  });
  const prismSafe = resolveEnvoySplinterBasic({
    weapon: resolveWeaponState('envoy-sanguine-prism', 1),
    catalogDamage: 10,
    catalogFluxCost: 5,
    veilFlux: 80,
    operativeHp: 100,
    maxHp: 100,
  });
  const prismBrink = resolveEnvoySplinterBasic({
    weapon: resolveWeaponState('envoy-sanguine-prism', 1),
    catalogDamage: 10,
    catalogFluxCost: 5,
    veilFlux: PRISM_BRINK_FLUX_THRESHOLD,
    operativeHp: 100,
    maxHp: 100,
  });
  assert.ok(lantern.rotStacks > conduit.rotStacks);
  assert.ok(lantern.occultDamage < conduit.occultDamage);
  assert.ok(prismSafe.hpSacrifice > 0 && prismSafe.hpSacrifice <= 8);
  assert.ok(prismBrink.brinkAmplified);
  assert.ok(prismBrink.occultDamage > prismSafe.occultDamage);
  assert.ok(conduit.fluxCost <= 5);

  // --- Envoy hooks: correct weapon only, no double-fire ---
  const conduitHook = runWeaponOnOccultCastHooks(makeHookCtx('envoy-null-conduit'));
  assert.ok(conduitHook.veilFluxDelta && conduitHook.veilFluxDelta > 0, 'Conduit T3 occult hook grants Flux');
  const conduitHook2 = runWeaponOnOccultCastHooks({
    ...makeHookCtx('envoy-null-conduit'),
    runtime: { ...createDefaultWeaponRuntime(), firstOccultAbilityUsed: true },
  });
  assert.equal(conduitHook2.veilFluxDelta ?? 0, 0, 'Conduit occult hook does not double-fire');

  const prismHook = runWeaponOnSacrificeHpHooks(makeHookCtx('envoy-sanguine-prism'));
  assert.ok((prismHook.veilFluxDelta ?? 0) > 0, 'Prism sacrifice hook grants Flux');
  const longswordSac = runWeaponOnSacrificeHpHooks(makeHookCtx('aegis-runed-longsword'));
  assert.equal(longswordSac.veilFluxDelta ?? 0, 0, 'Non-Prism weapons do not get Prism sacrifice passive');

  const extras = createDefaultCombatSessionExtras();
  const lanternWard = runWeaponOnDebuffAppliedHooks(makeHookCtx('envoy-echo-lantern'), extras);
  assert.ok(lanternWard.logLines.some((l) => l.includes('ward') || l.includes('ECHO')), 'Lantern first debuff wards');
  assert.ok((extras.playerShield ?? 0) >= 1, 'Lantern ward mutates session extras');

  // Debug inspect string includes affinity + live Carbine name
  const debug = formatWeaponIdentityDebug('hex-pulse-rifle');
  assert.ok(debug.includes('liveName=Carbine'));
  assert.ok(debug.includes('affinity='));
  assert.ok(!debug.includes('plannedName=Ash Shotgun'));

  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    const p = listWeaponIdentityProfiles().find((x) => x.id === id);
    assert.ok(p, `profile ${id}`);
    assert.ok(p!.mechanicalTags.length >= 2);
  });

  console.log('weaponBasicEngine.test.ts — all assertions passed');
}

run();
