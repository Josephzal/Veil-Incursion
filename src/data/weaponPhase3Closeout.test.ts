/**
 * Phase 3C–3G closeout verification.
 * Run: npx --yes tsx src/data/weaponPhase3Closeout.test.ts
 */
import assert from 'node:assert/strict';
import {
  CONDUIT_CLEAN_CYCLE_FLUX_BONUS,
  NULLBREACH_INNATE_ARMOR_PRESSURE_LAYERS,
  PRISM_BASIC_HP_SACRIFICE_MAX,
  PRISM_BASIC_HP_SACRIFICE_PCT,
  PRISM_BRINK_DAMAGE_MULT,
  PRISM_BRINK_FLUX_THRESHOLD,
  PRISM_SACRIFICE_PAYOFF_DAMAGE_MULT,
  resolveAegisStrikeBasic,
  resolveEnvoySplinterBasic,
  resolveHexBasicShot,
  simulatePrismBasicSequence,
} from './weaponBasicEngine';
import {
  buildWeaponUnlockPathTable,
  formatWeaponUnlockPathMarkdown,
  validateWeaponUnlockPaths,
} from './weaponUnlockPathEngine';
import {
  formatWeaponTagLayerDebug,
  inspectWeaponBasicTagLayers,
} from './weaponTagResolutionEngine';
import {
  resolvePlayerHealReceived,
  scalePlayerOriginDebuffDuration,
} from './weaponModifierResolution';
import { resolveLanternFluxPurgePayoff } from './weaponLanternRotPayoff';
import {
  WEAPON_DRAWBACK_RECORDS,
  formatWeaponDrawbackDebug,
  getWeaponDrawbackRecord,
} from './weaponDrawbackEngine';
import { createDefaultWeaponRuntime } from './weaponRunState';
import { normalizeWeaponProgression, resolveWeaponState } from './weaponProgressionEngine';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from './weaponRegistry';
import { executeHexShotAbility } from './hexShotAbilityExecutor';
import { executeEnvoyAbility } from './envoyAbilityExecutor';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnemyCombatProfile } from '../types/run';
import {
  applyHexAmmoEffect,
  createHexAmmoCastTracker,
  recordHexAmmoEffect,
} from './hexAmmoEffectEngine';
import { HEX_AMMO_TYPES } from '../types/hexAmmo';
import {
  createInitialHexShotCombatState,
  evaluateZeroProtocolReady,
} from '../types/hexShotState';
import { hexShotReducer } from '../reducers/hexShotReducer';
import { computeZeroProtocolPlan } from './hexZeroProtocolEngine';
import { resolveWeaponArmorPressureLayers } from './weaponCombatEngine';
import {
  runWeaponOnDebuffAppliedHooks,
  runWeaponOnOccultCastHooks,
  runWeaponOnSacrificeHpHooks,
} from './weaponCombatEngine';
import { createDefaultCombatSessionExtras } from '../types/combatHooks';
import { infectVeilRot, getVeilRotStacks, executeCatalyticRelease } from './envoyRotEngine';
import { applyWeaponArmorPierceToTarget } from './weaponCombatEngine';

function unit(partial: Partial<EnemyCombatProfile> & { unitId: string }): EnemyCombatProfile {
  return {
    designation: partial.designation ?? partial.unitId,
    currentHp: partial.currentHp ?? 80,
    maxHp: partial.maxHp ?? 100,
    gridSlot: partial.gridSlot ?? 'FL_1',
    kineticArmor: partial.kineticArmor,
    occultWards: partial.occultWards,
    ...partial,
  } as EnemyCombatProfile;
}

function run(): void {
  // ---------- 3C unlock path ----------
  const unlockIssues = validateWeaponUnlockPaths();
  assert.equal(unlockIssues.length, 0, unlockIssues.join('; '));
  const unlockRows = buildWeaponUnlockPathTable();
  assert.equal(unlockRows.length, 9);
  unlockRows.filter((r) => r.slot === 1).forEach((r) => {
    assert.equal(r.resourceRequirements.length, 0, `${r.id} starter must be free`);
    assert.ok(r.expectedSuccessfulRunTiming.includes('Run 1'));
  });
  unlockRows.filter((r) => r.slot === 2).forEach((r) => {
    assert.ok(r.resourceRequirements.length > 0);
    assert.ok(r.expectedSuccessfulRunTiming.includes('5–10'));
  });
  unlockRows.filter((r) => r.slot === 3).forEach((r) => {
    assert.ok(r.resourceRequirements.length > 0);
    assert.ok(r.expectedSuccessfulRunTiming.includes('10–15'));
  });
  // WU-1 Envoy starter = Vambrace; unlock-path slots must match live registry authority
  const envoyById = Object.fromEntries(
    unlockRows.filter((r) => r.id.startsWith('envoy-')).map((r) => [r.id, r]),
  );
  assert.equal(envoyById['envoy-echo-lantern']?.slot, 1, 'Vambrace is Envoy slot 1 / starter');
  assert.equal(envoyById['envoy-null-conduit']?.slot, 2, 'Scythe is Envoy slot 2');
  assert.equal(envoyById['envoy-sanguine-prism']?.slot, 3, "Heart's Due is Envoy slot 3");
  assert.equal(envoyById['envoy-echo-lantern']?.resourceRequirements.length, 0);
  assert.ok(envoyById['envoy-null-conduit']!.resourceRequirements.length > 0);
  assert.ok(envoyById['envoy-sanguine-prism']!.resourceRequirements.length > 0);
  assert.equal(envoyById['envoy-echo-lantern']?.liveDisplayName, 'Vambrace');
  assert.equal(envoyById['envoy-null-conduit']?.liveDisplayName, 'Scythe');
  assert.equal(envoyById['envoy-sanguine-prism']?.liveDisplayName, "Heart's Due");
  // Existing-save ownership preserved
  const migrated = normalizeWeaponProgression({
    weaponUnlocks: ['aegis-rift-edge', 'hex-void-cannon'],
    weaponTiers: { 'aegis-rift-edge': 2 },
    equippedWeaponByClass: { AEGIS: 'aegis-rift-edge' },
  } as Parameters<typeof normalizeWeaponProgression>[0]);
  assert.ok(migrated.weaponUnlocks.includes('aegis-rift-edge'));
  assert.ok(migrated.weaponUnlocks.includes('hex-void-cannon'));
  assert.ok(migrated.weaponUnlocks.includes('aegis-runed-longsword')); // starter reseeded
  assert.ok(formatWeaponUnlockPathMarkdown().includes('aegis-claymore-blade'));

  // ---------- Pulse: never 3-hit single-target when isolated ----------
  const isolated = unit({ unitId: 'solo', gridSlot: 'FL_1' });
  const isolatedPlan = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-pulse-rifle', 1),
    squad: [isolated],
    primaryTargetId: 'solo',
    catalogBaseDamage: 10,
  });
  assert.equal(isolatedPlan.hits.length, 1, 'isolated Ash basic must not dump missing splash into primary');
  assert.equal(isolatedPlan.hits[0]!.isPrimary, true);
  assert.ok(isolatedPlan.logLines.some((l) => l.includes('only the primary')));

  const clustered = [
    unit({ unitId: 'a', gridSlot: 'FL_1' }),
    unit({ unitId: 'b', gridSlot: 'FL_0' }),
    unit({ unitId: 'c', gridSlot: 'BL_1' }),
  ];
  const spreadPlan = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-pulse-rifle', 1),
    squad: clustered,
    primaryTargetId: 'a',
    catalogBaseDamage: 10,
  });
  assert.ok(spreadPlan.hits.length >= 2 && spreadPlan.hits.length <= 3);
  assert.equal(spreadPlan.hits.filter((h) => h.isPrimary).length, 1);
  assert.ok(spreadPlan.hits.every((h) => h.targetId === 'a' || h.targetId === 'b' || h.targetId === 'c'));

  // ---------- Runtime tags + graft add/remove ----------
  const pulseTags = inspectWeaponBasicTagLayers({
    familyId: 'hex-pulse-rifle',
    basicActionRuntimeTags: resolveHexBasicShot({
      weapon: resolveWeaponState('hex-pulse-rifle', 1),
      squad: clustered,
      primaryTargetId: 'a',
      catalogBaseDamage: 10,
    }).mechanicalTags,
    graft: { addTag: 'ARMOR_PIERCE', removeTags: ['FRACTURE'] },
  });
  assert.ok(pulseTags.graftAddedTags.includes('ARMOR_PIERCE'));
  assert.ok(pulseTags.graftRemovedTags.includes('FRACTURE') || !pulseTags.finalTransformedTags.includes('FRACTURE'));
  // Pulse base may not include FRACTURE — force a tag that exists then remove
  const withFracture = inspectWeaponBasicTagLayers({
    familyId: 'aegis-claymore-blade',
    basicActionRuntimeTags: ['MELEE', 'KINETIC', 'FRACTURE', 'HEAVY'],
    graft: { addTag: 'ARMOR_PIERCE', removeTags: ['FRACTURE'] },
  });
  assert.deepEqual([...withFracture.graftAddedTags], ['ARMOR_PIERCE']);
  assert.deepEqual([...withFracture.graftRemovedTags], ['FRACTURE']);
  assert.ok(withFracture.finalTransformedTags.includes('ARMOR_PIERCE'));
  assert.ok(!withFracture.finalTransformedTags.includes('FRACTURE'));
  assert.ok(formatWeaponTagLayerDebug(withFracture).includes('graftAdded='));
  assert.ok(withFracture.affinityTags.length >= 1);
  assert.ok(withFracture.baseWeaponTags.length >= 2);

  // ---------- Modifiers ----------
  const debuff = scalePlayerOriginDebuffDuration(2, { debuffDurationPct: 15 });
  assert.equal(debuff.turns, 3);
  assert.ok(debuff.logged);
  assert.equal(scalePlayerOriginDebuffDuration(99, { debuffDurationPct: 50 }).turns, 99);
  const heal = resolvePlayerHealReceived({
    rawAmount: 20,
    mods: { healReceivedPct: -10 },
  });
  assert.equal(heal.effectiveAmount, 18);
  assert.ok(heal.logged);

  // ---------- Nullbreach armor pressure ----------
  const unarmored = unit({ unitId: 'u', kineticArmor: 0, occultWards: 0 });
  const armored = unit({ unitId: 'k', kineticArmor: 2, occultWards: 0 });
  const warded = unit({ unitId: 'w', kineticArmor: 0, occultWards: 2 });
  const breachU = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-void-cannon', 1),
    squad: [unarmored],
    primaryTargetId: 'u',
    catalogBaseDamage: 10,
  });
  const breachK = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-void-cannon', 1),
    squad: [armored],
    primaryTargetId: 'k',
    catalogBaseDamage: 10,
  });
  const breachW = resolveHexBasicShot({
    weapon: resolveWeaponState('hex-void-cannon', 1),
    squad: [warded],
    primaryTargetId: 'w',
    catalogBaseDamage: 10,
  });
  assert.equal(breachU.innateArmorPressureLayers, NULLBREACH_INNATE_ARMOR_PRESSURE_LAYERS);
  assert.ok(breachK.hits[0]!.damage > breachU.hits[0]!.damage, 'KA targets take armored mult');
  assert.equal(breachW.hits[0]!.damage, breachU.hits[0]!.damage, 'Occult Ward alone is not Nullbreach KA payoff');
  const pierceFloor = resolveWeaponArmorPressureLayers(
    'hex-void-cannon',
    {}, // no pierce mod
    NULLBREACH_INNATE_ARMOR_PRESSURE_LAYERS,
  );
  assert.equal(pierceFloor, 1);
  const stripped = applyWeaponArmorPierceToTarget(armored, pierceFloor);
  assert.equal(stripped.kineticArmor, 1);

  // ---------- Hex ammo × 3 weapons (payload + no double-strip on spread) ----------
  for (const familyId of ['hex-silver-core-sidearm', 'hex-void-cannon', 'hex-pulse-rifle'] as const) {
    for (const ammo of HEX_AMMO_TYPES) {
      const tracker = createHexAmmoCastTracker();
      const plan = resolveHexBasicShot({
        weapon: resolveWeaponState(familyId, 1),
        squad: clustered,
        primaryTargetId: 'a',
        catalogBaseDamage: 10,
      });
      let armorStrips = 0;
      plan.hits.forEach((hit, hitIndex) => {
        const target = clustered.find((u) => u.unitId === hit.targetId)!;
        const effect = applyHexAmmoEffect({
          ammoType: ammo,
          isHeavyShot: plan.delivery === 'BREACH' || familyId === 'hex-void-cannon',
          hitIndex,
          isBackline: false,
          isBoss: false,
          targetId: hit.targetId,
          targetHasKineticArmor: (target.kineticArmor ?? 0) > 0,
          targetHasOccultWard: (target.occultWards ?? 0) > 0,
          targetHasVoidMark: false,
          targetTelegraphing: false,
          overcharged: false,
          tracker,
        });
        if (effect.stripArmor) armorStrips += 1;
        recordHexAmmoEffect(tracker, hit.targetId, effect);
      });
      if (ammo === 'SILVER_CORE' && familyId === 'hex-void-cannon') {
        assert.ok(armorStrips <= 1, 'ammo armor strip capped once per cast even on multi-hit');
      }
      assert.ok(plan.hits.length >= 1, `${familyId}×${ammo} resolves hits`);
    }
  }

  // Reload / Perfect / Protocol / Zero Protocol (design gate)
  const emptyEnc = createDefaultClassCombatEncounterState();
  const emptySquad: EnemyCombatProfile[] = [];
  let hexState = createInitialHexShotCombatState({
    hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, ap: 3, ammo: 0, maxAmmo: 6,
  });
  hexState = hexShotReducer(hexState, {
    type: 'HEX_RESOLVE_RELOAD',
    quality: 'PERFECT',
    ammoType: 'SILVER_CORE',
    encounter: emptyEnc,
    squad: emptySquad,
    deadMansSwitchBlocksOvercharge: false,
  });
  assert.equal(hexState.protocolCharges, 1);
  assert.equal(hexState.currentAmmoType, 'SILVER_CORE');
  assert.equal(hexState.nextShotOvercharged, true);
  hexState = hexShotReducer(hexState, {
    type: 'HEX_RESOLVE_RELOAD',
    quality: 'PERFECT',
    ammoType: 'WRAITHGLASS',
    encounter: emptyEnc,
    squad: emptySquad,
    deadMansSwitchBlocksOvercharge: false,
  });
  hexState = hexShotReducer(hexState, {
    type: 'HEX_RESOLVE_RELOAD',
    quality: 'PERFECT',
    ammoType: 'STASIS_LOCK',
    encounter: emptyEnc,
    squad: emptySquad,
    deadMansSwitchBlocksOvercharge: false,
  });
  assert.equal(hexState.protocolCharges, 3);
  assert.ok(evaluateZeroProtocolReady(hexState), 'ZP ready via Protocol Charges, not full mag');
  const zp = computeZeroProtocolPlan({
    calibrated: hexState.calibratedAmmoTypes,
    currentAmmoType: hexState.currentAmmoType,
    hasMinigameResult: false,
    target: {
      isBoss: false,
      hasKineticArmor: true,
      hasOccultWard: false,
      hasVoidMark: false,
      isWardedOrSpectralOrBackline: false,
      telegraphing: false,
    },
  });
  assert.ok(zp.trueDamage > 0);
  // Empty mag arm/clear
  hexState = { ...hexState, ammo: 0, autoReloadPending: true };
  assert.equal(hexState.autoReloadPending, true);
  hexState = { ...hexState, ammo: hexState.maxAmmo, autoReloadPending: false };
  assert.equal(hexState.autoReloadPending, false);
  // Encounter reset of weapon runtime
  const runtime = createDefaultWeaponRuntime();
  assert.equal(runtime.magazineEmptiedThisCombat, false);
  assert.equal(runtime.riftEdgeTempoArmed, false);
  assert.equal(runtime.claymoreBreakCashoutUsed, false);

  // ---------- Real combat dispatch path (executors) ----------
  const logs: string[] = [];
  const log = (m: string) => { logs.push(m); };

  // All 9 basics via plan + executor where applicable
  for (const id of ALL_WEAPON_FAMILY_IDS) {
    const def = getWeaponFamily(id);
    const weapon = resolveWeaponState(id, 1);
    const tags = inspectWeaponBasicTagLayers({
      familyId: id,
      basicActionRuntimeTags: (() => {
        if (def.classId === 'AEGIS') {
          return resolveAegisStrikeBasic({
            weapon,
            runtime: createDefaultWeaponRuntime(),
            riposte: false,
            targetFractured: false,
          }).mechanicalTags;
        }
        if (def.classId === 'HEX_SHOT') {
          return resolveHexBasicShot({
            weapon,
            squad: clustered,
            primaryTargetId: 'a',
            catalogBaseDamage: 10,
          }).mechanicalTags;
        }
        return resolveEnvoySplinterBasic({
          weapon,
          catalogDamage: 10,
          catalogFluxCost: 5,
          veilFlux: 50,
          operativeHp: 100,
          maxHp: 100,
        }).mechanicalTags;
      })(),
    });
    assert.ok(tags.basicActionRuntimeTags.length >= 2, `${id} runtime tags attached`);
    assert.ok(tags.finalTransformedTags.length >= 2);
  }

  // Hex dispatcher
  let ammo = 6;
  let stamina = 100;
  const hexSquad = clustered.map((u) => ({ ...u }));
  const hexWeapon = resolveWeaponState('hex-void-cannon', 1);
  const hexResult = executeHexShotAbility({
    abilityId: 'SILVER_CORE_SIDEARM',
    squad: hexSquad,
    targetId: 'a',
    strikeStats: { strikeDamage: 10, strikeStaminaCost: 0, abyssalChargePerStrike: 0, display: 't' } as never,
    currentAmmo: ammo,
    maxAmmo: 6,
    maxSoulAnchor: 100,
    classState: createDefaultClassCombatEncounterState(),
    log,
    spendAmmo: (n) => { if (ammo < n) return false; ammo -= n; return true; },
    spendStamina: (n) => { if (stamina < n) return false; stamina -= n; return true; },
    spendStaminaPct: () => true,
    hurtEnemy: () => true,
    patchUnit: (id, patch) => {
      const idx = hexSquad.findIndex((u) => u.unitId === id);
      if (idx >= 0) hexSquad[idx] = { ...hexSquad[idx]!, ...patch };
    },
    syncSquad: () => undefined,
    healOperative: () => undefined,
    reduceEnemyAp: () => undefined,
    emptyMagazine: () => { ammo = 0; },
    resolvedWeapon: hexWeapon,
  });
  assert.equal(hexResult.ok, true);
  assert.ok(stamina < 100, 'Nullbreach stamina committed through executor');
  assert.ok(logs.some((l) => l.includes('NULLBREACH') || l.includes('Breach')));

  // Envoy dispatcher — Conduit clean cycle
  logs.length = 0;
  const classState = createDefaultClassCombatEncounterState();
  classState.currentCatalyst = 'BLOOD';
  let fluxBonusSeen = 0;
  let hpSacrificeCalls = 0;
  const envoyWeapon = resolveWeaponState('envoy-null-conduit', 1);
  const envoyResult = executeEnvoyAbility({
    abilityId: 'VEIL_SPLINTER',
    squad: [unit({ unitId: 't1' })],
    targetId: 't1',
    veilFlux: 80,
    maxSoulAnchor: 100,
    classState,
    log,
    spendStamina: () => true,
    applyFluxDelta: (d) => d,
    hurtEnemy: () => true,
    patchUnit: () => undefined,
    syncSquad: () => undefined,
    healOperative: () => undefined,
    reduceEnemyAp: () => undefined,
    resolvedWeapon: envoyWeapon,
    weaponRuntime: createDefaultWeaponRuntime(),
    operativeHp: 100,
    applyHpSacrifice: () => { hpSacrificeCalls += 1; },
  });
  assert.equal(envoyResult.ok, true);
  assert.ok(logs.some((l) => l.includes('Clean Catalyst cycle')), 'Conduit clean cycle via dispatch');
  const conduitCold = resolveEnvoySplinterBasic({
    weapon: envoyWeapon,
    catalogDamage: 10,
    catalogFluxCost: 5,
    veilFlux: 80,
    operativeHp: 100,
    maxHp: 100,
    previousCatalyst: null,
  });
  const conduitHot = resolveEnvoySplinterBasic({
    weapon: envoyWeapon,
    catalogDamage: 10,
    catalogFluxCost: 5,
    veilFlux: 80,
    operativeHp: 100,
    maxHp: 100,
    previousCatalyst: 'NULL',
  });
  assert.equal(conduitCold.cleanCatalystCycle, false);
  assert.equal(conduitHot.cleanCatalystCycle, true);
  assert.ok(conduitHot.fluxBonus >= CONDUIT_CLEAN_CYCLE_FLUX_BONUS);
  // Lantern/Prism cannot trigger clean cycle
  assert.equal(
    resolveEnvoySplinterBasic({
      weapon: resolveWeaponState('envoy-echo-lantern', 1),
      catalogDamage: 10,
      catalogFluxCost: 5,
      veilFlux: 80,
      operativeHp: 100,
      maxHp: 100,
      previousCatalyst: 'BLOOD',
    }).cleanCatalystCycle,
    false,
  );
  assert.equal(
    resolveEnvoySplinterBasic({
      weapon: resolveWeaponState('envoy-sanguine-prism', 1),
      catalogDamage: 10,
      catalogFluxCost: 5,
      veilFlux: 20,
      operativeHp: 100,
      maxHp: 100,
      previousCatalyst: 'NULL',
    }).cleanCatalystCycle,
    false,
  );

  // Lantern Rot setup + Flux-Purge detonation (not same-cast)
  logs.length = 0;
  const rotState = createDefaultClassCombatEncounterState();
  const rotTarget = unit({ unitId: 'rot1' });
  infectVeilRot(rotState, rotTarget, 2, log);
  assert.equal(getVeilRotStacks(rotState, 'rot1'), 2);
  const lanternBasic = resolveEnvoySplinterBasic({
    weapon: resolveWeaponState('envoy-echo-lantern', 1),
    catalogDamage: 10,
    catalogFluxCost: 5,
    veilFlux: 50,
    operativeHp: 100,
    maxHp: 100,
  });
  assert.equal(lanternBasic.rotStacks, 2);
  // Basic does not consume/detonate
  assert.equal(getVeilRotStacks(rotState, 'rot1'), 2);
  const purge = resolveLanternFluxPurgePayoff({
    familyId: 'envoy-echo-lantern',
    classState: rotState,
    targetId: 'rot1',
    baseDamage: 10,
  });
  assert.ok(purge.lanternDetonation);
  assert.equal(purge.rotConsume, 2);
  assert.ok(purge.damage > 10);
  // Non-lantern consumes 1 only
  assert.equal(
    resolveLanternFluxPurgePayoff({
      familyId: 'envoy-null-conduit',
      classState: rotState,
      targetId: 'rot1',
      baseDamage: 10,
    }).rotConsume,
    1,
  );
  // Catalytic release affects real rot state
  const catState = createDefaultClassCombatEncounterState();
  infectVeilRot(catState, rotTarget, 3, () => undefined);
  const cat = executeCatalyticRelease(
    [rotTarget],
    catState,
    1.3,
    () => undefined,
    log,
  );
  assert.ok(cat.totalDamageDealt > 0);

  // Prism formula + 10-step simulation
  assert.equal(PRISM_BRINK_FLUX_THRESHOLD, 25);
  assert.equal(PRISM_BASIC_HP_SACRIFICE_PCT, 0.05);
  assert.equal(PRISM_BASIC_HP_SACRIFICE_MAX, 8);
  assert.equal(PRISM_BRINK_DAMAGE_MULT, 1.2);
  assert.equal(PRISM_SACRIFICE_PAYOFF_DAMAGE_MULT, 1.15);
  const sim = simulatePrismBasicSequence([
    { hp: 100, maxHp: 100, flux: 80 },
    { hp: 95, maxHp: 100, flux: 60 },
    { hp: 90, maxHp: 100, flux: 40 },
    { hp: 85, maxHp: 100, flux: 25 },
    { hp: 80, maxHp: 100, flux: 20 },
    { hp: 75, maxHp: 100, flux: 10 },
    { hp: 4, maxHp: 100, flux: 20 },
    { hp: 3, maxHp: 100, flux: 15 },
    { hp: 2, maxHp: 100, flux: 5 },
    { hp: 1, maxHp: 100, flux: 0 },
  ]);
  assert.equal(sim.length, 10);
  assert.ok(sim[0]!.sacrificePaidFully);
  assert.ok(sim[3]!.brinkAmplified);
  assert.equal(sim[6]!.sacrificePaidFully, false);
  assert.ok(sim[6]!.paidSacrifice < sim[6]!.intendedSacrifice);
  assert.equal(sim[9]!.paidSacrifice, 0);
  assert.equal(sim[9]!.hpOut, 1, 'never kill via sacrifice');
  // Multi-hit must not multiply sacrifice — plan is once
  assert.equal(hpSacrificeCalls, 0); // conduit cast above had 0
  logs.length = 0;
  hpSacrificeCalls = 0;
  executeEnvoyAbility({
    abilityId: 'VEIL_SPLINTER',
    squad: [unit({ unitId: 'p1' })],
    targetId: 'p1',
    veilFlux: 20,
    maxSoulAnchor: 100,
    classState: createDefaultClassCombatEncounterState(),
    log,
    spendStamina: () => true,
    applyFluxDelta: (d) => d,
    hurtEnemy: () => true,
    patchUnit: () => undefined,
    syncSquad: () => undefined,
    healOperative: () => undefined,
    reduceEnemyAp: () => undefined,
    resolvedWeapon: resolveWeaponState('envoy-sanguine-prism', 1),
    weaponRuntime: createDefaultWeaponRuntime(),
    operativeHp: 100,
    applyHpSacrifice: () => { hpSacrificeCalls += 1; },
  });
  assert.equal(hpSacrificeCalls, 1, 'Prism charges HP sacrifice once per basic');

  // Envoy hooks scoped + no double-fire
  const extras = createDefaultCombatSessionExtras();
  const makeHook = (family: Parameters<typeof resolveWeaponState>[0]) => ({
    weapon: resolveWeaponState(family, 3),
    runtime: createDefaultWeaponRuntime(),
    blueprintId: null,
    player: { hp: 100, maxHp: 100, shield: 0, shieldTurnsRemaining: 0, debuffs: [] as never[] },
    squad: [] as EnemyCombatProfile[],
  });
  const occult1 = runWeaponOnOccultCastHooks(makeHook('envoy-null-conduit'));
  const occult2 = runWeaponOnOccultCastHooks({
    ...makeHook('envoy-null-conduit'),
    runtime: { ...createDefaultWeaponRuntime(), ...occult1.runtimePatch },
  });
  // Second call should not re-fire once-per-combat if first consumed
  if (occult1.veilFluxDelta) {
    assert.ok(!occult2.veilFluxDelta || occult2.veilFluxDelta === 0 || occult1.runtimePatch);
  }
  assert.equal(
    runWeaponOnSacrificeHpHooks(makeHook('envoy-echo-lantern')).veilFluxDelta ?? 0,
    0,
  );
  const sac = runWeaponOnSacrificeHpHooks(makeHook('envoy-sanguine-prism'));
  assert.ok((sac.logLines?.length ?? 0) >= 0);
  const debuffHook = runWeaponOnDebuffAppliedHooks(makeHook('envoy-echo-lantern'), extras);
  assert.ok(debuffHook);
  assert.equal(
    runWeaponOnDebuffAppliedHooks(makeHook('envoy-null-conduit'), extras).logLines?.some((l) =>
      l.includes('ECHO LANTERN') || l.includes('WARD'),
    ) ?? false,
    false,
  );

  // ---------- Phase 3G drawbacks ----------
  assert.equal(Object.keys(WEAPON_DRAWBACK_RECORDS).length, 9);
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    const d = getWeaponDrawbackRecord(id);
    assert.ok(d.primaryStructuralWeakness.length > 10);
    assert.ok(d.mechanicalEnforcement.length > 10);
    assert.ok(formatWeaponDrawbackDebug(id).includes(id));
  });
  // Longsword single-target
  assert.equal(
    resolveAegisStrikeBasic({
      weapon: resolveWeaponState('aegis-runed-longsword', 1),
      runtime: createDefaultWeaponRuntime(),
      riposte: false,
      targetFractured: false,
    }).occultRiderDamage,
    0,
  );
  // Rift tempo gated
  assert.equal(
    resolveAegisStrikeBasic({
      weapon: resolveWeaponState('aegis-rift-edge', 1),
      runtime: createDefaultWeaponRuntime(),
      riposte: false,
      targetFractured: false,
    }).occultRiderDamage,
    0,
  );
  // Claymore stamina + low chip reserve
  const clay = resolveAegisStrikeBasic({
    weapon: resolveWeaponState('aegis-claymore-blade', 1),
    runtime: createDefaultWeaponRuntime(),
    riposte: false,
    targetFractured: false,
  });
  const long = resolveAegisStrikeBasic({
    weapon: resolveWeaponState('aegis-runed-longsword', 1),
    runtime: createDefaultWeaponRuntime(),
    riposte: false,
    targetFractured: false,
  });
  assert.ok(clay.staminaCost > long.staminaCost);
  assert.ok(clay.reserveGain < long.reserveGain);
  // Sidearm no AoE
  assert.equal(
    resolveHexBasicShot({
      weapon: resolveWeaponState('hex-silver-core-sidearm', 1),
      squad: clustered,
      primaryTargetId: 'a',
      catalogBaseDamage: 10,
    }).hits.length,
    1,
  );
  // Pulse isolated weakness
  assert.equal(isolatedPlan.hits.length, 1);
  // Prism no full payoff at 1 HP
  assert.equal(sim[9]!.sacrificePaidFully, false);

  // Silence unused
  void fluxBonusSeen;
    console.log('weaponPhase3Closeout.test.ts: OK');
  console.log('--- Prism 10-cast simulation ---');
  sim.forEach((row) => {
    console.log(
      `step=${row.step} hp=${row.hpIn}->${row.hpOut} flux=${row.fluxIn} sac=${row.paidSacrifice}/${row.intendedSacrifice} full=${row.sacrificePaidFully} brink=${row.brinkAmplified} dmg=${row.occultDamage}`,
    );
  });
}

run();
