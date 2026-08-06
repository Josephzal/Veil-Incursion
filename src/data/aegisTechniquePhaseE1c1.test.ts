/**
 * Phase E.1c.1 — DEVASTATE Fracture-threshold cashout + VEIL_PIERCER/REAVE technique power.
 * Run: npx tsx src/data/aegisTechniquePhaseE1c1.test.ts
 */
import assert from 'node:assert/strict';
import {
  DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
} from '../types/aegisCombat';
import type { EnemyCombatProfile } from '../types/run';
import { COMBAT_ACTION } from '../types/run';
import {
  executeExtendedAbility,
  type AbilityExecutionContext,
  type PlayerCombatBuffState,
} from './aegisAbilityExecutor';
import { getAbilityDefinition } from './aegisAbilities';
import {
  evaluateAegisGraftCompatibility,
} from './aegisGraftCompatibility';
import {
  applyFractureDamage,
  isEnemyFractured,
  recoverFromFracture,
} from './combatFractureEngine';
import { aggregateMutationModifiers } from './boonEngine';
import {
  commitTechniqueResources,
  devastateDamagePreview,
  devastateFractureCashoutValue,
  devastateTrueDamage,
  DEVASTATE_KINETIC_DAMAGE,
  DEVASTATE_TRUE_DAMAGE_FLOOR,
  resolveTechniqueResourceCosts,
  validateTechniqueCommitment,
} from './aegisTechniqueCommitEngine';
import {
  reaveKineticDamage,
  resolveAegisTechniqueStrikePower,
  veilPiercerOccultDamage,
} from './aegisTechniquePowerEngine';
import { planWardensStrike, planPairedBladesStrike, planUnmakerStrike } from './aegisWeaponActionResolveEngine';
import { resolveWeaponCombatStatsFromState } from './weaponCombatEngine';
import { resolveWeaponState } from './weaponProgressionEngine';
import { WEAPON_REGISTRY } from './weaponRegistry';
import {
  resolveUnmakerTier3FractureBreakReserveGrant,
} from './unmakerTier3FractureBreakEngine';

console.log('Phase E.1c.1 — DEVASTATE + technique power');

function baseBuff(): PlayerCombatBuffState {
  return {
    demonLungCooldown: 0,
    crimsonPactCharges: 0,
    bonusApThisTurn: 0,
    bonusApNextTurn: 0,
    ashenMantleTurnsRemaining: 0,
    initiativeQueued: false,
  };
}

function makeUnit(partial: Partial<EnemyCombatProfile> & { unitId: string }): EnemyCombatProfile {
  return {
    rosterId: 'thrall',
    designation: 'Test',
    currentHp: 80,
    maxHp: 100,
    baseDamage: 8,
    kineticArmor: 0,
    occultWards: 0,
    fractureGauge: 0,
    fractureMax: 100,
    gridSlot: 'FL_0',
    combatTags: [],
    ...partial,
  } as EnemyCombatProfile;
}

function makeCtx(
  abilityId: 'DEVASTATE' | 'VEIL_PIERCER' | 'REAVE',
  overrides: Partial<AbilityExecutionContext> = {},
): AbilityExecutionContext {
  const brands = { value: overrides.runicBrands ?? 0 };
  return {
    abilityId,
    squad: [],
    targetId: null,
    strikeStats: {
      strikeDamage: 15,
      strikeStaminaCost: 0,
      exhaustedStrikeDamage: 8,
      abyssalChargePerStrike: 0,
      label: 'Test',
      aegisTechniqueStrikePower: 15,
    },
    stamina: 100,
    abyssalReserve: 50,
    operativeHp: 80,
    maxSoulAnchor: 100,
    runicBrands: brands.value,
    committedBrandsSpent: overrides.committedBrandsSpent,
    costsCommitted: true,
    buffState: baseBuff(),
    log: () => {},
    spendStamina: () => true,
    spendStaminaPct: () => true,
    hurtEnemy: () => false,
    patchUnit: () => {},
    syncSquad: () => {},
    chargeAr: () => {},
    consumeAbyssalPct: () => 0,
    consumeAbyssalFlat: () => true,
    imprintBrand: () => {
      throw new Error('Techniques must not imprint Brands');
    },
    setRunicBrands: (n) => { brands.value = n; },
    consumeBrands: () => 0,
    healOperative: () => {},
    sacrificeHpPct: () => false,
    grantBonusAp: () => {},
    grantBonusApNextTurn: () => {},
    setAegisOvercharged: () => {},
    restoreStaminaPct: () => {},
    reduceEnemyAp: () => {},
    ownedBoons: [],
    mutationMods: aggregateMutationModifiers([]),
    bloodTitheCooldown: 0,
    ashenMantleCooldown: 0,
    setBloodTitheCooldown: () => {},
    setAshenMantleCooldown: () => {},
    activateRuneboundCarapace: () => {},
    setAshenMantleActive: () => {},
    ...overrides,
  };
}

// ── DEVASTATE: canonical break path ──────────────────────────────────────────
{
  let unit = makeUnit({ unitId: 'e0', fractureMax: 100, fractureGauge: 0, currentHp: 90 });
  const beforeMax = unit.fractureMax ?? 100;
  unit = applyFractureDamage(unit, 40);
  assert.equal(isEnemyFractured(unit), false);
  assert.equal(unit.fractureGauge, 40);
  unit = applyFractureDamage(unit, 60);
  assert.equal(isEnemyFractured(unit), true);
  assert.equal(unit.fractureGauge, 0);
  assert.equal(devastateFractureCashoutValue(unit), beforeMax);
  assert.equal(devastateTrueDamage(unit), 100);

  // Cannot rebuild while Fractured
  const blocked = applyFractureDamage(unit, 50);
  assert.equal(blocked.fractureGauge, 0);
  assert.equal(isEnemyFractured(blocked), true);

  const preview = devastateDamagePreview(unit);
  assert.equal(preview.kinetic, DEVASTATE_KINETIC_DAMAGE);
  assert.equal(preview.trueDamage, 100);

  const hits: Array<{ raw: number; tag: string; ch?: string }> = [];
  let fracturedCleared = false;
  const ctx = makeCtx('DEVASTATE', {
    squad: [unit],
    targetId: 'e0',
    committedBrandsSpent: 3,
    hurtEnemy: (raw, tag, _s, opts) => {
      hits.push({ raw, tag, ch: opts?.channel });
      return false;
    },
    patchUnit: (_id, patch) => {
      if (patch.fracturedThisRound === false) fracturedCleared = true;
    },
  });
  assert.equal(executeExtendedAbility(ctx).ok, true);
  assert.deepEqual(hits.map((h) => h.raw), [4, 100]);
  assert.equal(hits[0]?.ch, 'KINETIC');
  assert.equal(hits[1]?.ch, 'TRUE');
  assert.ok(fracturedCleared);
}

// Low threshold → True floor 8
{
  let unit = makeUnit({ unitId: 'lo', fractureMax: 5, fractureGauge: 0 });
  unit = applyFractureDamage(unit, 5);
  assert.equal(isEnemyFractured(unit), true);
  assert.equal(unit.fractureGauge, 0);
  assert.equal(devastateTrueDamage(unit), DEVASTATE_TRUE_DAMAGE_FLOOR);
  const hits: number[] = [];
  executeExtendedAbility(makeCtx('DEVASTATE', {
    squad: [unit],
    targetId: 'lo',
    committedBrandsSpent: 3,
    hurtEnemy: (raw) => { hits.push(raw); return false; },
  }));
  assert.deepEqual(hits, [4, 8]);
}

// Re-Fracture after recover uses current threshold (no stale cashout field)
{
  let unit = makeUnit({ unitId: 're', fractureMax: 100 });
  unit = applyFractureDamage(unit, 100);
  assert.equal(devastateTrueDamage(unit), 100);
  unit = recoverFromFracture(unit);
  assert.equal(isEnemyFractured(unit), false);
  unit = { ...unit, fractureMax: 50, fractureGauge: 0 };
  unit = applyFractureDamage(unit, 50);
  assert.equal(devastateTrueDamage(unit), 50);
}

// Commit costs: 1 AP + 3 Brands; non-Fractured rejects without spend path
{
  const ok = validateTechniqueCommitment({
    techniqueId: 'DEVASTATE',
    loadout: ['DEVASTATE', 'RUIN', 'GRAVE_BIND'],
    state: { ap: 3, brands: 3, operativeHp: 80, maxSoulAnchor: 100 },
    target: applyFractureDamage(makeUnit({ unitId: 't', fractureMax: 100 }), 100),
    demonLungCooldown: 0,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    const committed = commitTechniqueResources(
      { ap: 3, brands: 3, operativeHp: 80, maxSoulAnchor: 100 },
      ok.costs,
      'pa-dev',
      'DEVASTATE',
    );
    assert.equal(committed.snapshot.apSpent, 1);
    assert.equal(committed.snapshot.brandsSpent, 3);
    assert.equal(committed.next.brands, 0);
  }
  const bad = validateTechniqueCommitment({
    techniqueId: 'DEVASTATE',
    loadout: ['DEVASTATE', 'RUIN', 'GRAVE_BIND'],
    state: { ap: 3, brands: 3, operativeHp: 80, maxSoulAnchor: 100 },
    target: makeUnit({ unitId: 'healthy' }),
    demonLungCooldown: 0,
  });
  assert.equal(bad.ok, false);
  assert.deepEqual(resolveTechniqueResourceCosts('DEVASTATE', 3).brandsToSpend, 3);
}

// Echo/Splinter ineligible on DEVASTATE
{
  for (const graftId of ['ECHO_GRAFT', 'SPLINTER_GRAFT'] as const) {
    const r = evaluateAegisGraftCompatibility({
      target: { kind: 'TECHNIQUE', techniqueId: 'DEVASTATE' },
      graftId,
      allowFixedBasic: true,
    });
    assert.equal(r.ok, false);
  }
}

// DEVASTATE does not grant Unmaker T3 WA-only break reserve (technique id / no WA break)
{
  const unmakerT3 = resolveWeaponState('aegis-claymore-blade', 3);
  const grant = resolveUnmakerTier3FractureBreakReserveGrant({
    weapon: unmakerT3,
    causesFractureBreak: true,
    abilityId: 'DEVASTATE',
    playerActionId: 'pa-tech-DEVASTATE',
    echoHit: false,
    grantedForPlayerActionId: null,
  });
  assert.equal(grant.reserveGain, 0);
}

// Description must not claim live gauge
{
  const desc = getAbilityDefinition('DEVASTATE').description.toLowerCase();
  assert.ok(desc.includes('threshold'));
  assert.ok(!desc.includes('gauge'));
}

// ── VEIL_PIERCER / REAVE matrix preservation ─────────────────────────────────
const EXPECTED: Array<{
  family: 'aegis-runed-longsword' | 'aegis-rift-edge' | 'aegis-claymore-blade';
  tier: 1 | 2 | 3;
  power: number;
  vp: number;
  reave: number;
}> = [
  { family: 'aegis-runed-longsword', tier: 1, power: 15, vp: 12, reave: 17 },
  { family: 'aegis-runed-longsword', tier: 2, power: 16, vp: 13, reave: 18 },
  { family: 'aegis-runed-longsword', tier: 3, power: 17, vp: 14, reave: 19 },
  { family: 'aegis-rift-edge', tier: 1, power: 14, vp: 11, reave: 16 },
  { family: 'aegis-rift-edge', tier: 2, power: 14, vp: 11, reave: 16 },
  { family: 'aegis-rift-edge', tier: 3, power: 14, vp: 11, reave: 16 },
  { family: 'aegis-claymore-blade', tier: 1, power: 17, vp: 14, reave: 19 },
  { family: 'aegis-claymore-blade', tier: 2, power: 18, vp: 15, reave: 20 },
  { family: 'aegis-claymore-blade', tier: 3, power: 18, vp: 15, reave: 20 },
];

for (const row of EXPECTED) {
  const state = resolveWeaponState(row.family, row.tier);
  const stats = resolveWeaponCombatStatsFromState(state);
  const power = resolveAegisTechniqueStrikePower(state.statModifiers);
  assert.equal(stats.aegisTechniqueStrikePower, row.power, `${row.family} T${row.tier} power field`);
  assert.equal(power, row.power, `${row.family} T${row.tier} resolve`);
  assert.equal(veilPiercerOccultDamage(power), row.vp, `${row.family} T${row.tier} VP`);
  assert.equal(reaveKineticDamage(power), row.reave, `${row.family} T${row.tier} Reave`);
  // Authored technique field is the live authority (not silent strikeDamagePct alone)
  assert.equal(
    state.statModifiers.aegisTechniquePowerPct,
    state.statModifiers.aegisTechniquePowerPct ?? state.statModifiers.strikeDamagePct ?? 0,
  );
  assert.ok(state.statModifiers.aegisTechniquePowerPct != null || row.tier === 1);
}

// Migration fallback: missing aegisTechniquePowerPct uses strikeDamagePct
assert.equal(resolveAegisTechniqueStrikePower({ strikeDamagePct: 10 }), 16);
assert.equal(resolveAegisTechniqueStrikePower({ aegisTechniquePowerPct: 18, strikeDamagePct: 99 }), 17);

// WA kinetic unchanged
assert.equal(planWardensStrike().hits[0]!.kineticDamage, 14);
assert.equal(planPairedBladesStrike({ tempoArmed: false }).hits[0]!.kineticDamage, 11);
assert.equal(planUnmakerStrike().hits[0]!.kineticDamage, 15);

// Executor uses technique power field (not inflated strikeDamage)
{
  const hits: number[] = [];
  executeExtendedAbility(makeCtx('VEIL_PIERCER', {
    squad: [makeUnit({ unitId: 'v' })],
    targetId: 'v',
    committedBrandsSpent: 1,
    strikeStats: {
      strikeDamage: 99,
      strikeStaminaCost: 0,
      exhaustedStrikeDamage: 8,
      abyssalChargePerStrike: 0,
      label: 't',
      aegisTechniqueStrikePower: 15,
    },
    hurtEnemy: (raw, _t, _s, opts) => {
      hits.push(raw);
      assert.equal(opts?.channel, 'OCCULT');
      assert.equal(opts?.ignoreDefenses, true);
      return false;
    },
  }));
  assert.deepEqual(hits, [12]);
}
{
  const hits: number[] = [];
  const target = makeUnit({ unitId: 'r', gridSlot: 'FL_0' });
  executeExtendedAbility(makeCtx('REAVE', {
    squad: [target],
    targetId: 'r',
    strikeStats: {
      strikeDamage: 99,
      strikeStaminaCost: 0,
      exhaustedStrikeDamage: 8,
      abyssalChargePerStrike: 0,
      label: 't',
      aegisTechniqueStrikePower: 15,
    },
    hurtEnemy: (raw, _t, _s, opts) => {
      hits.push(raw);
      assert.equal(opts?.channel, 'KINETIC');
      assert.equal(opts?.fractureGain, 12);
      return false;
    },
  }));
  assert.deepEqual(hits, [17]);
}

// Hex / Envoy smoke: strikeDamage still from strikeDamagePct (no aegisTechniqueStrikePower)
{
  const hex = resolveWeaponCombatStatsFromState(resolveWeaponState('hex-silver-core-sidearm', 1));
  assert.equal(hex.aegisTechniqueStrikePower, undefined);
  assert.ok(hex.strikeDamage >= COMBAT_ACTION.ABYSSAL_STRIKE_DAMAGE);
  const envoy = resolveWeaponCombatStatsFromState(resolveWeaponState('envoy-echo-lantern', 1));
  assert.equal(envoy.aegisTechniqueStrikePower, undefined);
}

// Registry still carries dormant strikeDamagePct where it did historically (migration)
assert.equal(WEAPON_REGISTRY['aegis-claymore-blade'].tiers[2].statModifiers.strikeDamagePct, 25);
assert.equal(WEAPON_REGISTRY['aegis-claymore-blade'].tiers[2].statModifiers.aegisTechniquePowerPct, 25);

console.log('Phase E.1c.1 OK');
console.log('loadout default', DEFAULT_AEGIS_TECHNIQUE_LOADOUT.join(','));
