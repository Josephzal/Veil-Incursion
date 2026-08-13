/**
 * Phase B — fixed weapon-action runtime + combat surface.
 * Run: npx tsx src/data/aegisWeaponActionPhaseB.test.ts
 */
import assert from 'node:assert/strict';
import {
  DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  PLAYER_ACTION_POINTS_PER_TURN,
  RUNIC_BRAND_CAP,
} from '../types/aegisCombat';
import {
  ALL_AEGIS_WEAPON_FAMILY_IDS,
  deriveAegisWeaponActions,
  deriveAegisWeaponUltimateId,
} from './aegisWeaponActionRegistry';
import {
  assertAegisWeaponActionCatalogComplete,
  aegisWeaponActionApCost,
  listAegisWeaponActionsForFamily,
} from './aegisWeaponActionCatalog';
import { buildAegisCombatSurface } from './aegisCombatCompatibility';
import { resolveClassAbilityCost } from './classAbilityResolver';
import { abilityCarriesStrikeTag } from './aegisRiposteEngine';
import {
  canReachUnitWithMeleeRowSweep,
  resolveDreadHorizonTargets,
  resolveRuptureBrandGain,
} from './aegisWeaponActionRuntime';
import {
  castAegisWeaponAction,
  createSimWorld,
  simBeginPlayerTurn,
  simEndPlayerTurn,
  simEnemyAction,
} from './aegisWeaponActionSimulator';
import { planAegisWeaponAction } from './aegisWeaponActionResolveEngine';
import { migrateAegisTechniqueLoadout } from './aegisMigration';
import type { EnemyCombatProfile } from '../types/run';

console.log('Phase B — Aegis weapon-action runtime');

// 1. Each family exposes exactly its four correct weapon actions.
assert.deepEqual(assertAegisWeaponActionCatalogComplete(), []);
assert.deepEqual(deriveAegisWeaponActions('aegis-longsword'), [
  'WARDENS_STRIKE', 'RUPTURE', 'DREADBIND', 'NO_RESPITE',
]);
assert.deepEqual(deriveAegisWeaponActions('aegis-paired-blades'), [
  'PAIRED_BLADES_STRIKE', 'DIVERGENCE', 'ECLIPSE', 'SEVERANCE',
]);
assert.deepEqual(deriveAegisWeaponActions('aegis-claymore'), [
  'UNMAKER_STRIKE', 'DREAD_HORIZON', 'UNBOWED', 'DOOMFALL',
]);
for (const familyId of ALL_AEGIS_WEAPON_FAMILY_IDS) {
  assert.equal(listAegisWeaponActionsForFamily(familyId).length, 4);
}

// 2. Combat exposes 4 weapon actions + 3 techniques with no compatibility STRIKE.
const surface = buildAegisCombatSurface({
  weaponFamilyId: 'aegis-longsword',
  techniques: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
});
assert.equal(surface.weaponActions.length, 4);
assert.equal(surface.techniques.length, 3);
assert.equal(surface.hudCards.length, 7);
assert.ok(!surface.hudCards.includes('STRIKE'));

// Phase C: canonical technique IDs on HUD — no executor remaps.
assert.equal(surface.techniques[2], 'RUNEBOUND_CARAPACE');
assert.equal(surface.hudCards[6], 'RUNEBOUND_CARAPACE');
const mercySurface = buildAegisCombatSurface({
  weaponFamilyId: 'aegis-longsword',
  techniques: ['FINAL_MERCY', 'RUIN', 'GRAVE_BIND'],
});
assert.equal(mercySurface.techniques[0], 'FINAL_MERCY');
assert.equal(mercySurface.hudCards[4], 'FINAL_MERCY');

// 3. Account edits cannot change an active run’s cards (snapshot frozen at surface build).
const runSnapshot = ['RUIN', 'GRAVE_BIND', 'RUNEBOUND_CARAPACE'] as const;
const accountLater = ['DEVASTATE', 'VEIL_PIERCER', 'ASHEN_MANTLE'] as const;
const runSurface = buildAegisCombatSurface({
  weaponFamilyId: 'aegis-paired-blades',
  techniques: runSnapshot,
});
const accountSurface = buildAegisCombatSurface({
  weaponFamilyId: 'aegis-paired-blades',
  techniques: accountLater,
});
assert.notDeepEqual([...runSurface.techniques], [...accountSurface.techniques]);
assert.deepEqual([...runSurface.techniques], [...runSnapshot]);

// 4. No Aegis weapon action checks or spends Stamina.
for (const familyId of ALL_AEGIS_WEAPON_FAMILY_IDS) {
  for (const id of deriveAegisWeaponActions(familyId)!) {
    const cost = resolveClassAbilityCost('AEGIS', id);
    assert.equal(cost.staminaCost, 0, `${id} staminaCost`);
    assert.equal(cost.staminaCostPct, 0, `${id} staminaCostPct`);
  }
}
{
  const w = createSimWorld();
  const after = castAegisWeaponAction(w, { actionId: 'WARDENS_STRIKE', targetId: 'e0' });
  assert.equal(after.staminaChecks, 0);
  assert.equal(after.staminaSpends, 0);
}

// 5. AP / damage / Fracture / Armor / Reserve / Brand baselines
{
  const w = createSimWorld({
    enemies: [{
      id: 'e0', hp: 100, maxHp: 100, kineticArmor: 2, fracture: 0,
      fractureThreshold: 100, fractured: false, row: 'FL',
    }],
  });
  const after = castAegisWeaponAction(w, { actionId: 'WARDENS_STRIKE', targetId: 'e0' });
  assert.equal(after.player.ap, PLAYER_ACTION_POINTS_PER_TURN - 1);
  assert.equal(after.enemies[0]!.hp, 100 - 14);
  assert.equal(after.enemies[0]!.fracture, 20);
  assert.equal(after.enemies[0]!.kineticArmor, 1);
  assert.equal(after.player.reserve, 8);
}
{
  const plan = planAegisWeaponAction('RUPTURE', {
    tempoArmed: false,
    ruptureMastery: { removedFinalArmor: true, enteredFractured: true },
  });
  assert.equal(plan.apCost, 1);
  assert.equal(plan.hits[0]!.kineticDamage, 8);
  assert.equal(plan.hits[0]!.fractureGain, 40);
  assert.equal(plan.hits[0]!.armorStrip, 2);
  assert.equal(plan.hits[0]!.accuracyBonusPct, 15);
  assert.equal(plan.brandGain, 1);
}

// 6. Rupture awards at most one Brand
{
  const brand = resolveRuptureBrandGain(0, {
    hit: true,
    killed: false,
    removedFinalArmor: true,
    enteredFractured: true,
  });
  assert.equal(brand.brandGain, 1);
  const capped = resolveRuptureBrandGain(RUNIC_BRAND_CAP, {
    hit: true, killed: false, removedFinalArmor: true, enteredFractured: true,
  });
  assert.equal(capped.brandGain, 0);
}

// 7. Dreadbind delayed reward requires authored Perfect Parry
{
  let w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'DREADBIND', targetId: 'e0' });
  assert.ok(w.weapon.dreadboundByUnitId.e0);
  w = simEnemyAction(w, {
    attackerId: 'e0', damage: 20, blockable: true, hit: true,
  });
  assert.equal(w.player.brands, 0); // hit without Perfect Parry — no mastery brand
  w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'DREADBIND', targetId: 'e0' });
  w = simEnemyAction(w, {
    attackerId: 'e0', damage: 20, blockable: true, perfectParry: true,
  });
  assert.equal(w.player.brands, 1);
  assert.ok(w.log.some((l) => l.includes('Dreadbind mastery')));
}

// 8. No Respite snapshots pre-existing Fractured; once per turn
{
  let w = createSimWorld({
    enemies: [{
      id: 'e0', hp: 100, maxHp: 100, kineticArmor: 0, fracture: 100,
      fractureThreshold: 100, fractured: true, row: 'FL',
    }],
  });
  w = castAegisWeaponAction(w, { actionId: 'NO_RESPITE', targetId: 'e0' });
  assert.ok(w.log.includes('No Respite payoff'));
  assert.equal(w.player.ap, PLAYER_ACTION_POINTS_PER_TURN - 2 + 1);
  assert.equal(w.player.reserve, 10);
  assert.equal(w.weapon.noRespiteUsedThisPlayerTurn, true);
  const apAfterFirst = w.player.ap;
  const payoffLogs = w.log.filter((l) => l === 'No Respite payoff').length;
  w = castAegisWeaponAction(w, { actionId: 'NO_RESPITE', targetId: 'e0' });
  assert.equal(w.log.filter((l) => l === 'No Respite payoff').length, payoffLogs);
  assert.equal(w.player.ap, apAfterFirst - 2);
}

// 9. Divergence split/same targets + locked 5+5
{
  const plan = planAegisWeaponAction('DIVERGENCE', { tempoArmed: false });
  assert.equal(plan.hits[0]!.kineticDamage, 5);
  assert.equal(plan.hits[1]!.kineticDamage, 5);
  assert.equal(plan.hits[0]!.reserveGain, 2);
  let w = createSimWorld({
    enemies: [
      {
        id: 'e0', hp: 100, maxHp: 100, kineticArmor: 0, fracture: 0,
        fractureThreshold: 100, fractured: false, row: 'FL',
      },
      {
        id: 'e1', hp: 100, maxHp: 100, kineticArmor: 0, fracture: 0,
        fractureThreshold: 100, fractured: false, row: 'FL',
      },
    ],
  });
  w = castAegisWeaponAction(w, {
    actionId: 'DIVERGENCE',
    dualTargetIds: ['e0', 'e1'],
  });
  assert.equal(w.enemies[0]!.hp, 95);
  assert.equal(w.enemies[1]!.hp, 95);
  assert.equal(w.player.brands, 1);
  assert.equal(w.player.reserve, 4);
  // same target twice — kill cancels blade 2
  w = createSimWorld({
    enemies: [{
      id: 'e0', hp: 3, maxHp: 100, kineticArmor: 0, fracture: 0,
      fractureThreshold: 100, fractured: false, row: 'FL',
    }],
  });
  w = castAegisWeaponAction(w, {
    actionId: 'DIVERGENCE',
    dualTargetIds: ['e0', 'e0'],
  });
  assert.ok(w.log.some((l) => l.includes('cancelled')));
}

// 10. Eclipse eligible / ineligible / ordinary parry / perfect / evade / expiry
{
  let w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'ECLIPSE', targetId: 'e0', forceMiss: true });
  assert.equal(w.weapon.eclipseActive, true); // posture on miss
  w = simEnemyAction(w, {
    attackerId: 'e0', damage: 10, evade: true, blockable: true,
  });
  assert.equal(w.weapon.tempoArmed, true);
  assert.equal(w.player.brands, 1);
  assert.equal(w.weapon.eclipseActive, false);

  w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'ECLIPSE', targetId: 'e0' });
  w = simEnemyAction(w, {
    attackerId: 'e0', damage: 10, ordinaryParry: true, blockable: true,
  });
  assert.equal(w.weapon.eclipseActive, false);
  assert.equal(w.player.brands, 0);

  w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'ECLIPSE', targetId: 'e0' });
  w = simEnemyAction(w, {
    attackerId: 'e0', damage: 10, environmental: true, hit: true,
  });
  assert.equal(w.weapon.eclipseActive, true); // ineligible — not consumed

  w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'ECLIPSE', targetId: 'e0' });
  w = simEndPlayerTurn(w);
  w = simBeginPlayerTurn(w);
  assert.equal(w.weapon.eclipseActive, false);
}

// 11. Tempo consumption / preservation
{
  let w = createSimWorld();
  w.weapon = { ...w.weapon, tempoArmed: true, tempoExpiresAfterPlayerTurn: 2 };
  w = castAegisWeaponAction(w, { actionId: 'PAIRED_BLADES_STRIKE', targetId: 'e0' });
  assert.equal(w.weapon.tempoArmed, false);
  w = createSimWorld();
  w.weapon = { ...w.weapon, tempoArmed: true, tempoExpiresAfterPlayerTurn: 2 };
  w = castAegisWeaponAction(w, { actionId: 'PAIRED_BLADES_STRIKE', targetId: 'e0', forceMiss: true });
  assert.equal(w.weapon.tempoArmed, true);
  w = createSimWorld();
  w.weapon = { ...w.weapon, tempoArmed: true, tempoExpiresAfterPlayerTurn: 2 };
  w = castAegisWeaponAction(w, {
    actionId: 'DIVERGENCE',
    dualTargetIds: ['e0', 'e0'],
  });
  assert.equal(w.weapon.tempoArmed, true); // Divergence never consumes
}

// 12. Multi-hit Riposte at most once
{
  let w = createSimWorld({
    enemies: [
      {
        id: 'e0', hp: 100, maxHp: 100, kineticArmor: 0, fracture: 0,
        fractureThreshold: 100, fractured: false, row: 'FL',
      },
      {
        id: 'e1', hp: 100, maxHp: 100, kineticArmor: 0, fracture: 0,
        fractureThreshold: 100, fractured: false, row: 'FL',
      },
    ],
  });
  w.player.riposteReady = true;
  w = castAegisWeaponAction(w, {
    actionId: 'DIVERGENCE',
    dualTargetIds: ['e0', 'e1'],
  });
  assert.equal(w.log.filter((l) => l.startsWith('RIPOSTE')).length, 1);
  assert.equal(w.player.riposteReady, false);
}

// 13. Dread Horizon frontline reach + both hits for Brand
{
  const squad = [
    { unitId: 'f0', gridSlot: 'FL_0', currentHp: 10 },
    { unitId: 'b0', gridSlot: 'BL_0', currentHp: 10 },
  ] as unknown as EnemyCombatProfile[];
  assert.equal(canReachUnitWithMeleeRowSweep(squad, squad[1]!), false);
  assert.equal(canReachUnitWithMeleeRowSweep(squad, squad[0]!), true);
  const row = resolveDreadHorizonTargets(squad, 'f0');
  assert.equal(row.length, 1);
  const emptyFront = [
    { unitId: 'b0', gridSlot: 'BL_0', currentHp: 10 },
    { unitId: 'b1', gridSlot: 'BL_1', currentHp: 10 },
  ] as unknown as EnemyCombatProfile[];
  assert.equal(resolveDreadHorizonTargets(emptyFront, 'b0').length, 2);

  let w = createSimWorld({
    enemies: [
      {
        id: 'e0', hp: 100, maxHp: 100, kineticArmor: 0, fracture: 0,
        fractureThreshold: 100, fractured: false, row: 'FL',
      },
      {
        id: 'e1', hp: 100, maxHp: 100, kineticArmor: 0, fracture: 0,
        fractureThreshold: 100, fractured: false, row: 'FL',
      },
    ],
  });
  w = castAegisWeaponAction(w, {
    actionId: 'DREAD_HORIZON',
    rowTargetIds: ['e0', 'e1'],
  });
  assert.equal(w.player.brands, 1);
  assert.equal(w.player.reserve, 6);
}

// 14. Poise reduces eligible action; Brand only while Committed
{
  let w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'UNBOWED', targetId: 'e0' });
  assert.equal(w.weapon.poiseActive, true);
  w = simEnemyAction(w, { attackerId: 'e0', damage: 100, hit: true, blockable: true });
  assert.ok(w.log.some((l) => l.includes('Incoming damage reduced') || l.includes('Poise')));
  assert.equal(w.player.brands, 0);

  w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'DOOMFALL' }); // charge → committed
  assert.equal(w.weapon.committed, true);
  w = castAegisWeaponAction(w, { actionId: 'UNBOWED', targetId: 'e0' });
  w = simEnemyAction(w, { attackerId: 'e0', damage: 100, hit: true, blockable: true });
  assert.ok(w.log.some((l) => l.includes('Committed payoff')));
  assert.equal(w.player.brands, 1);
}

// 15–16. Doomfall charge / interrupt / transition / release / miss / cashout / shared origin
{
  let w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'DOOMFALL' });
  assert.equal(w.weapon.committed, true);
  assert.equal(w.lastPlan?.stage, 'CHARGE');
  assert.equal(w.lastPlan?.originActionId != null, true);
  const origin = w.weapon.doomfallOriginActionId;
  assert.equal(abilityCarriesStrikeTag('AEGIS', 'DOOMFALL', { doomfallReleaseAvailable: false }), false);

  w = simEnemyAction(w, {
    attackerId: 'e0', damage: 5, stunOrKnockdown: true, hit: true,
  });
  assert.equal(w.weapon.committed, false);
  assert.ok(w.log.some((l) => l.includes('Charge cancelled')));

  w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'DOOMFALL' });
  w = simEndPlayerTurn(w);
  w = simBeginPlayerTurn(w);
  assert.equal(w.weapon.doomfallReleaseAvailable, true);
  assert.equal(w.weapon.committed, false);
  assert.equal(aegisWeaponActionApCost('DOOMFALL', { doomfallReleaseAvailable: true }), 0);
  assert.equal(abilityCarriesStrikeTag('AEGIS', 'DOOMFALL', { doomfallReleaseAvailable: true }), true);

  const releaseOrigin = w.weapon.doomfallOriginActionId;
  w.enemies[0]!.fractured = true;
  w = castAegisWeaponAction(w, { actionId: 'DOOMFALL', targetId: 'e0' });
  assert.equal(w.lastPlan?.stage, 'RELEASE');
  assert.equal(w.lastPlan?.originActionId, releaseOrigin);
  assert.equal(w.player.reserve, 24);
  assert.equal(w.enemies[0]!.fractured, false);
  assert.equal(w.weapon.doomfallReleaseAvailable, false);

  // miss loses charge
  w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'DOOMFALL' });
  w = simEndPlayerTurn(w);
  w = simBeginPlayerTurn(w);
  w = castAegisWeaponAction(w, { actionId: 'DOOMFALL', targetId: 'e0', forceMiss: true });
  assert.equal(w.weapon.doomfallReleaseAvailable, false);
  assert.equal(w.enemies[0]!.hp, 100);

  // expiry without release
  w = createSimWorld();
  w = castAegisWeaponAction(w, { actionId: 'DOOMFALL' });
  w = simEndPlayerTurn(w);
  w = simBeginPlayerTurn(w);
  assert.equal(w.weapon.doomfallReleaseAvailable, true);
  w = simEndPlayerTurn(w);
  assert.equal(w.weapon.doomfallReleaseAvailable, false);

  void origin;
}

// 17. Brand cap / bonus hits ignored
{
  const brand = resolveRuptureBrandGain(0, {
    hit: true, killed: false, removedFinalArmor: true, isBonusHit: true,
  });
  assert.equal(brand.brandGain, 0);
}

// 18. Ultimate still derived from family
assert.equal(deriveAegisWeaponUltimateId('aegis-longsword'), 'ABYSSAL_VERDICT');
assert.equal(deriveAegisWeaponUltimateId('aegis-paired-blades'), 'REND_THE_VEIL');
assert.equal(deriveAegisWeaponUltimateId('aegis-claymore'), 'GRAVEFALL');

// 19. Other classes unchanged — cost resolver still works for Hex basic
{
  const hex = resolveClassAbilityCost('HEX_SHOT', 'SILVER_CORE_SIDEARM');
  assert.ok(hex.apCost >= 0);
  assert.ok(hex.label.length > 0);
}

// 20. Phase A migration still green (spot check)
{
  const m = migrateAegisTechniqueLoadout(['STRIKE', 'BLOOD_BOUND_CARAPACE', 'RUIN', 'GRAVE_BIND']);
  assert.ok(m.includes('RUNEBOUND_CARAPACE'));
  assert.ok(m.includes('RUIN'));
  assert.ok(m.includes('GRAVE_BIND'));
  assert.equal(m.length, 3);
}

console.log('Phase B Aegis weapon-action OK');
