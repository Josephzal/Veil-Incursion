/**
 * Phase C — native shared-technique runtime.
 * Run: npx tsx src/data/aegisTechniquePhaseC.test.ts
 */
import assert from 'node:assert/strict';
import {
  ALL_AEGIS_TECHNIQUES,
  AEGIS_AP_UTILITY_TECHNIQUES,
  AEGIS_BRAND_TECHNIQUES,
  DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  RUNIC_BRAND_CAP,
} from '../types/aegisCombat';
import { AEGIS_ABILITY_CATALOG, getAbilityDefinition, isRetiredAegisTechniqueId } from './aegisAbilities';
import { getAegisTechniqueDefinition, isAegisTechniqueId } from './aegisTechniqueCatalog';
import { buildAegisCombatSurface } from './aegisCombatCompatibility';
import {
  commitTechniqueResources,
  devastateTrueDamage,
  finalMercyTrueDamage,
  isFinalMercyEligible,
  resolveTechniqueResourceCosts,
  validateTechniqueCommitment,
  ASHEN_MANTLE_DURATION_TURNS,
  DEVASTATE_KINETIC_DAMAGE,
  FINAL_MERCY_BOSS_TRUE_DAMAGE,
} from './aegisTechniqueCommitEngine';
import {
  applyFractureDamage,
  applyFracturedState,
  isEnemyFractured,
  normalizeFracturedGaugeInvariant,
} from './combatFractureEngine';
import {
  armRuneboundCarapace,
  noteCarapaceInboundHit,
  resolveCarapaceAfterEnemyAction,
  createRuneboundCarapaceState,
} from './aegisRuneboundCarapaceEngine';
import {
  executeExtendedAbility,
  isExtendedAbilityEnabled,
  type AbilityExecutionContext,
  type PlayerCombatBuffState,
} from './aegisAbilityExecutor';
import { applyDeepLungsOnRestore, DEEP_LUNGS_BONUS_RESERVE_PCT } from './aegisBoonHookRunner';
import { aggregateMutationModifiers } from './boonEngine';
import { migrateAegisTechniqueLoadout } from './aegisMigration';
import { abilityCarriesStrikeTag } from './aegisRiposteEngine';
import { ruinFracturePerBrand } from './aegisResourceEngine';
import type { EnemyCombatProfile } from '../types/run';

console.log('Phase C — native Aegis technique runtime');

function makeUnit(partial: Partial<EnemyCombatProfile> & { unitId: string }): EnemyCombatProfile {
  return {
    rosterId: 'thrall',
    designation: 'Test',
    currentHp: 40,
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

function makeCtx(
  abilityId: keyof typeof AEGIS_ABILITY_CATALOG,
  overrides: Partial<AbilityExecutionContext> = {},
): AbilityExecutionContext {
  const buff = baseBuff();
  const brands = { value: overrides.runicBrands ?? 0 };
  return {
    abilityId,
    squad: [],
    targetId: null,
    strikeStats: {
      strikeDamage: 20,
      strikeStaminaCost: 0,
      exhaustedStrikeDamage: 10,
      abyssalChargePerStrike: 0,
      label: 'Test',
    },
    stamina: 100,
    abyssalReserve: 50,
    operativeHp: 80,
    maxSoulAnchor: 100,
    runicBrands: brands.value,
    committedBrandsSpent: overrides.committedBrandsSpent,
    costsCommitted: true,
    buffState: buff,
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

// 1–2: All twelve have native catalog + ready resolvers; IDs agree on surface
for (const id of ALL_AEGIS_TECHNIQUES) {
  assert.ok(isAegisTechniqueId(id));
  assert.ok(AEGIS_ABILITY_CATALOG[id], id);
  assert.equal(getAegisTechniqueDefinition(id).combatResolverReady, true, id);
  assert.equal(getAbilityDefinition(id).staminaCost, 0, id);
  assert.ok(!abilityCarriesStrikeTag('AEGIS', id), `${id} must be non-STRIKE`);
}

const surface = buildAegisCombatSurface({
  weaponFamilyId: 'aegis-runed-longsword',
  techniques: ['FINAL_MERCY', 'RUNEBOUND_CARAPACE', 'RUIN'],
});
assert.deepEqual([...surface.techniques], ['FINAL_MERCY', 'RUNEBOUND_CARAPACE', 'RUIN']);
assert.deepEqual(surface.hudCards.slice(4), ['FINAL_MERCY', 'RUNEBOUND_CARAPACE', 'RUIN']);
assert.equal(surface.weaponActions.length, 4);
assert.equal(surface.hudCards.length, 7);

// 3–5: FINAL_MERCY / RUNEBOUND never substitute; no duplicate remaps
assert.equal(surface.techniques[0], 'FINAL_MERCY');
assert.equal(surface.techniques[1], 'RUNEBOUND_CARAPACE');
assert.ok(!('techniqueExecutorIds' in surface));

// 6: Brand technique costs
const brandCosts: Record<string, { required: number; mode: 'ALL' | number }> = {
  RUIN: { required: 1, mode: 'ALL' },
  VEIL_PIERCER: { required: 1, mode: 1 },
  DEVASTATE: { required: 3, mode: 3 },
  FINAL_MERCY: { required: 2, mode: 2 },
  DEMONS_LUNG: { required: 1, mode: 1 },
  CRIMSON_PACT: { required: 1, mode: 1 },
};
for (const id of AEGIS_BRAND_TECHNIQUES) {
  const def = getAbilityDefinition(id);
  const expect = brandCosts[id]!;
  assert.equal(def.requiredBrands, expect.required, id);
  assert.equal(def.brandsConsumed, expect.mode, id);
  assert.equal(def.reserveCost ?? 0, 0, id);
  assert.equal(def.reserveCostPct ?? 0, 0, id);
}

// 7: AP utilities spend no Brand / Reserve / Stam / HP
for (const id of AEGIS_AP_UTILITY_TECHNIQUES) {
  const def = getAbilityDefinition(id);
  assert.equal(def.requiredBrands ?? 0, 0, id);
  assert.equal(def.brandsConsumed, undefined, id);
  assert.equal(def.reserveCost ?? 0, 0, id);
  assert.equal(def.reserveCostPct ?? 0, 0, id);
  assert.equal(def.hpCostPct ?? 0, 0, id);
  assert.equal(def.staminaCost, 0, id);
}

// 8–10: Brand generation restrictions (catalog + Deep Lungs)
assert.equal(getAbilityDefinition('STRIKE').brandsImprinted ?? 0, 0);
assert.equal(getAbilityDefinition('VEIL_PIERCER').brandsImprinted ?? 0, 0);
let deepLungsReserve = 0;
applyDeepLungsOnRestore(['DEEP_LUNGS'], 'DEMONS_LUNG', (pct) => { deepLungsReserve += pct; }, () => {});
assert.equal(deepLungsReserve, DEEP_LUNGS_BONUS_RESERVE_PCT);

// 11–13: Atomic commit / rollback
{
  const v = validateTechniqueCommitment({
    techniqueId: 'RUIN',
    loadout: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
    state: { ap: 3, brands: 0, operativeHp: 50, maxSoulAnchor: 100 },
    target: null,
    demonLungCooldown: 0,
  });
  assert.equal(v.ok, false);

  const ok = validateTechniqueCommitment({
    techniqueId: 'RUIN',
    loadout: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
    state: { ap: 3, brands: 2, operativeHp: 50, maxSoulAnchor: 100 },
    target: null,
    demonLungCooldown: 0,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    const committed = commitTechniqueResources(
      { ap: 3, brands: 2, operativeHp: 50, maxSoulAnchor: 100 },
      ok.costs,
      'pa-test',
      'RUIN',
    );
    assert.equal(committed.snapshot.brandsSpent, 2);
    assert.equal(committed.next.brands, 0);
    assert.equal(committed.next.ap, 1);
  }
}

// 15: RUIN fracture scale 1/2/3
assert.equal(ruinFracturePerBrand(1), 50);
assert.equal(ruinFracturePerBrand(2), 80);
assert.equal(ruinFracturePerBrand(3), 110);

// 16: VEIL spends 1 Brand; costs
assert.deepEqual(resolveTechniqueResourceCosts('VEIL_PIERCER', 3).brandsToSpend, 1);

// 17: DEVASTATE requires Fractured — cashout uses Fracture threshold (not live gauge)
{
  const healthy = makeUnit({ unitId: 'a', currentHp: 50, maxHp: 100, fractureMax: 100 });
  assert.equal(
    isExtendedAbilityEnabled('DEVASTATE', 0, 0, 50, 100, baseBuff(), 3, { target: healthy }),
    false,
  );
  let unit = makeUnit({
    unitId: 'b',
    currentHp: 80,
    maxHp: 100,
    fractureGauge: 0,
    fractureMax: 100,
  });
  unit = applyFractureDamage(unit, 100);
  assert.equal(isEnemyFractured(unit), true);
  assert.equal(unit.fractureGauge, 0);
  assert.equal(devastateTrueDamage(unit), 100);
  assert.equal(
    isExtendedAbilityEnabled('DEVASTATE', 0, 0, 50, 100, baseBuff(), 3, { target: unit }),
    true,
  );
  let order: string[] = [];
  let hits: Array<{ raw: number; tag: string }> = [];
  let cleared = false;
  const ctx = makeCtx('DEVASTATE', {
    squad: [unit],
    targetId: 'b',
    committedBrandsSpent: 3,
    hurtEnemy: (raw, tag) => {
      hits.push({ raw, tag });
      order.push(tag);
      return false;
    },
    patchUnit: (_id, patch) => {
      if (patch.fracturedThisRound === false) cleared = true;
    },
  });
  const result = executeExtendedAbility(ctx);
  assert.equal(result.ok, true);
  assert.equal(hits[0]?.raw, DEVASTATE_KINETIC_DAMAGE);
  assert.equal(hits[1]?.raw, 100);
  assert.ok(order.some((t) => t.includes('DETONATION')));
  assert.ok(cleared);
  // Corruption/migration: FRACTURED + nonzero gauge is illegal — normalize; cashout uses threshold
  const illegal = {
    ...applyFracturedState(makeUnit({ unitId: 'c', fractureMax: 100, fractureGauge: 0 })),
    fractureGauge: 40,
  };
  const corrupt = normalizeFracturedGaugeInvariant(illegal);
  assert.equal(corrupt.fractureGauge, 0);
  assert.equal(devastateTrueDamage(illegal), 100);
}

// 18: FINAL_MERCY threshold / boss / heal
{
  const low = makeUnit({ unitId: 'm', currentHp: 20, maxHp: 100 });
  assert.equal(isFinalMercyEligible(low), true);
  assert.equal(finalMercyTrueDamage(low), 20);
  const boss = makeUnit({ unitId: 'boss', currentHp: 20, maxHp: 100, isBoss: true });
  assert.equal(isFinalMercyEligible(boss), true);
  assert.equal(finalMercyTrueDamage(boss), FINAL_MERCY_BOSS_TRUE_DAMAGE);
  let healed = 0;
  const ctx = makeCtx('FINAL_MERCY', {
    squad: [low],
    targetId: 'm',
    committedBrandsSpent: 2,
    hurtEnemy: () => true,
    healOperative: (n) => { healed = n; },
  });
  assert.equal(executeExtendedAbility(ctx).ok, true);
  assert.equal(healed, 10);
}

// 19: DEMONS_LUNG cooldown + Deep Lungs
{
  const buff = baseBuff();
  buff.demonLungCooldown = 2;
  assert.equal(
    isExtendedAbilityEnabled('DEMONS_LUNG', 0, 0, 50, 100, buff, 1),
    false,
  );
  let charged = 0;
  const ctx = makeCtx('DEMONS_LUNG', {
    committedBrandsSpent: 1,
    ownedBoons: ['DEEP_LUNGS'],
    chargeAr: (pct) => { charged += pct; },
  });
  assert.equal(executeExtendedAbility(ctx).ok, true);
  assert.equal(charged, 30 + DEEP_LUNGS_BONUS_RESERVE_PCT);
  assert.equal(ctx.buffState.demonLungCooldown, 3);
}

// 20: CRIMSON_PACT 12% HP
assert.equal(getAbilityDefinition('CRIMSON_PACT').hpCostPct, 12);
assert.equal(aggregateMutationModifiers([]).crimsonPactHpCostPct, 12);

// 21: AP utility costs
assert.equal(getAbilityDefinition('SHADOW_STEP').apCost, 1);
assert.equal(getAbilityDefinition('REAVE').apCost, 2);
assert.equal(ASHEN_MANTLE_DURATION_TURNS, 1);

// 22: Runebound carapace state machine
{
  let state = armRuneboundCarapace(createRuneboundCarapaceState());
  state = noteCarapaceInboundHit(state, {
    armed: true,
    hasAttacker: true,
    attackerId: 'e1',
    damageApplied: 10,
    fullyNegated: false,
    unblockable: false,
    ranged: false,
    environmental: false,
    damageOverTime: false,
    selfDamage: false,
    controlOnly: false,
    mitigationBypass: false,
  });
  // Second hit same action — still one pending
  state = noteCarapaceInboundHit(state, {
    armed: true,
    hasAttacker: true,
    attackerId: 'e2',
    damageApplied: 5,
    fullyNegated: false,
    unblockable: false,
    ranged: false,
    environmental: false,
    damageOverTime: false,
    selfDamage: false,
    controlOnly: false,
    mitigationBypass: false,
  });
  assert.equal(state.pendingAttackerId, 'e1');
  const resolved = resolveCarapaceAfterEnemyAction(state, true);
  assert.equal(resolved.reflect?.trueDamage, 12);
  assert.equal(resolved.reflect?.fracture, 24);
  assert.equal(resolved.next.armed, false);
}

// 23: Retired IDs not in catalog
assert.ok(isRetiredAegisTechniqueId('BLOOD_TITHE'));
assert.ok(isRetiredAegisTechniqueId('ABYSSAL_FAULT'));
assert.ok(isRetiredAegisTechniqueId('BLOOD_BOUND_CARAPACE'));
assert.ok(!('BLOOD_TITHE' in AEGIS_ABILITY_CATALOG));
assert.ok(!('ABYSSAL_FAULT' in AEGIS_ABILITY_CATALOG));
assert.ok(!('BLOOD_BOUND_CARAPACE' in AEGIS_ABILITY_CATALOG));

// 24: Migration BLOOD_BOUND → RUNEBOUND
{
  const migrated = migrateAegisTechniqueLoadout([
    'STRIKE',
    'BLOOD_BOUND_CARAPACE',
    'RUIN',
    'GRAVE_BIND',
  ]);
  assert.ok(migrated.includes('RUNEBOUND_CARAPACE'));
  assert.ok(!migrated.includes('BLOOD_BOUND_CARAPACE' as never));
}

// 25: Combat surface shape
assert.equal(surface.hudCards.length, 7);
assert.equal(RUNIC_BRAND_CAP, 3);

// Cap brands
assert.ok(AEGIS_BRAND_TECHNIQUES.length === 6);
assert.ok(AEGIS_AP_UTILITY_TECHNIQUES.length === 6);

console.log('Phase C Aegis technique runtime OK');
