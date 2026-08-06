/**
 * Envoy Weapon-Kit Phase E.4 — executors, Action1 consolidation, Catalyst, preview.
 * Run: npx tsx src/data/envoyWeaponKitPhaseE4.test.ts
 */
import assert from 'node:assert/strict';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import {
  ENVOY_EXECUTABLE_WEAPON_ACTION_IDS,
  ENVOY_HEARTS_DUE_WEAPON_ACTIONS,
  ENVOY_SCYTHE_WEAPON_ACTIONS,
  ENVOY_VAMBRACE_WEAPON_ACTIONS,
} from '../types/envoyWeaponAction';
import { DEFAULT_ENVOY_FLEX_LOADOUT } from '../types/operativeClass';
import type { EnemyCombatProfile } from '../types/run';
import {
  ALL_ENVOY_WEAPON_FAMILY_IDS,
  isEnvoyWeaponActionLiveExecutable,
  isEnvoyWeaponActionPlayerFacingLive,
  requireEnvoyWeaponActions,
} from './envoyWeaponActionRegistry';
import {
  listEnvoyWeaponActionDefinitions,
  requireEnvoyWeaponActionDefinition,
} from './envoyWeaponActionCatalog';
import { executeEnvoyWeaponAction } from './envoyWeaponActionExecutor';
import { previewEnvoyWeaponAction } from './envoyWeaponActionPreviewEngine';
import { planEnvoyWeaponAction } from './envoyWeaponActionPlanEngine';
import {
  catalystPrimeForEnvoyCast,
  previewEnvoyCatalystCast,
  resolveEnvoyCatalystCast,
} from './envoyCatalystCastEngine';
import { catalystForEnvoyAbility } from './envoyCatalystEngine';
import { executeEnvoyAbility } from './envoyAbilityExecutor';
import { resolveWeaponState } from './weaponProgressionEngine';
import { infectVeilRot, getVeilRotStacks } from './envoyRotEngine';
import {
  armSanguineExposure,
  hasSanguineExposure,
  expireSanguineExposureEndOfEnemyTurn,
} from './envoySanguineExposureEngine';
import {
  buildEnvoyCombatSurface,
  isEnvoyCombatSurfaceComplete,
} from './envoyCombatCompatibility';
import { sanitizeEnvoyFlexLoadout, projectEnvoyLiveFourSlotDeck } from './envoyFlexLoadoutEngine';
import { STARTER_WEAPON_BY_CLASS, getWeaponFamily } from './weaponRegistry';
import { validateWeaponUnlockPaths } from './weaponUnlockPathEngine';
import { normalizeWeaponProgression } from './weaponProgressionEngine';
import { requireHexWeaponActions, ALL_HEX_WEAPON_FAMILY_IDS } from './hexWeaponActionRegistry';
import { deriveAegisWeaponActions, ALL_AEGIS_WEAPON_FAMILY_IDS } from './aegisWeaponActionRegistry';
import {
  PRISM_BRINK_DAMAGE_MULT,
  PRISM_BRINK_FLUX_THRESHOLD,
  PRISM_SACRIFICE_PAYOFF_DAMAGE_MULT,
  resolveEnvoySplinterBasic,
} from './weaponBasicEngine';
import { createDefaultWeaponRuntime } from './weaponRunState';

console.log('Envoy Weapon-Kit Phase E.4');

function unit(id: string, hp = 40): EnemyCombatProfile {
  return {
    unitId: id,
    designation: id,
    currentHp: hp,
    maxHp: hp,
    gridSlot: id === 'a' ? 'FL_0' : 'FL_1',
  } as EnemyCombatProfile;
}

function makeExec(
  familyId: 'envoy-echo-lantern' | 'envoy-null-conduit' | 'envoy-sanguine-prism',
  actionId: string,
  opts: {
    targetId?: string | null;
    secondaryTargetId?: string | null;
    flux?: number;
    hp?: number;
    maxHp?: number;
    squad?: EnemyCombatProfile[];
    classState?: ReturnType<typeof createDefaultClassCombatEncounterState>;
    resolveCatalyst?: boolean;
  } = {},
) {
  const classState = opts.classState ?? createDefaultClassCombatEncounterState();
  const squad = opts.squad ?? [unit('a'), unit('b')];
  const weapon = resolveWeaponState(familyId, 1);
  const runtime = createDefaultWeaponRuntime();
  let staminaOk = true;
  let lastDamage = 0;
  const result = executeEnvoyWeaponAction({
    actionId,
    familyId,
    squad,
    targetId: opts.targetId === undefined ? 'a' : opts.targetId,
    secondaryTargetId: opts.secondaryTargetId,
    veilFlux: opts.flux ?? 50,
    maxHp: opts.maxHp ?? 100,
    operativeHp: opts.hp ?? 80,
    classState,
    log: () => {},
    resolvedWeapon: weapon,
    weaponRuntime: runtime,
    spendStamina: () => staminaOk,
    applyHpSacrifice: (n) => {
      opts.hp = (opts.hp ?? 80) - n;
    },
    hurtEnemy: (raw) => {
      lastDamage = raw;
      return true;
    },
    patchUnit: (id, patch) => {
      const u = squad.find((s) => s.unitId === id);
      if (u) Object.assign(u, patch);
    },
    healOperative: () => {},
    applyPlayerShield: () => {},
    resolveCatalyst: opts.resolveCatalyst,
  });
  return { result, classState, squad, lastDamage, setStaminaFail: () => { staminaOk = false; } };
}

// ---------- Coverage: all 12 executable + preview ----------
assert.equal(ENVOY_EXECUTABLE_WEAPON_ACTION_IDS.length, 12);
assert.equal(listEnvoyWeaponActionDefinitions().length, 12);
for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
  for (const actionId of requireEnvoyWeaponActions(familyId)) {
    assert.equal(isEnvoyWeaponActionLiveExecutable(familyId, actionId), true);
    assert.equal(requireEnvoyWeaponActionDefinition(actionId).executorUnavailable, false);
    const classState = createDefaultClassCombatEncounterState();
    if (actionId === 'GRAVE_TRANSFER' || actionId === 'ROT_KNELL') {
      infectVeilRot(classState, unit('a'), 2, () => {});
    }
    const { result } = makeExec(familyId, actionId, {
      classState,
      secondaryTargetId: actionId === 'GRAVE_TRANSFER' ? 'b' : undefined,
      targetId: actionId === 'CRIMSON_VENT' ? null : 'a',
      resolveCatalyst: true,
    });
    assert.equal(result.ok, true, `${actionId} exec: ${!result.ok ? result.message : ''}`);
    const prev = previewEnvoyWeaponAction({
      actionId,
      familyId,
      classState: createDefaultClassCombatEncounterState(),
      squad: [unit('a'), unit('b')],
      targetId: actionId === 'CRIMSON_VENT' ? null : 'a',
      secondaryTargetId: actionId === 'GRAVE_TRANSFER' ? 'b' : null,
      veilFlux: 50,
      operativeHp: 80,
      maxHp: 100,
      resolvedWeapon: resolveWeaponState(familyId, 1),
    });
    // ROT_KNELL / TRANSFER need stacks for ok preview
    if (actionId === 'ROT_KNELL' || actionId === 'GRAVE_TRANSFER') {
      const st = createDefaultClassCombatEncounterState();
      infectVeilRot(st, unit('a'), 2, () => {});
      const p2 = previewEnvoyWeaponAction({
        actionId,
        familyId,
        classState: st,
        squad: [unit('a'), unit('b')],
        targetId: 'a',
        secondaryTargetId: 'b',
        veilFlux: 50,
        operativeHp: 80,
        maxHp: 100,
        resolvedWeapon: resolveWeaponState(familyId, 1),
      });
      assert.equal(p2.ok, true, `${actionId} preview`);
    } else {
      assert.equal(prev.ok, true, `${actionId} preview ${prev.rejectReason}`);
    }
  }
}

// ---------- Action1 parity vs resolveEnvoySplinterBasic ----------
for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
  const action1 = requireEnvoyWeaponActions(familyId)[0]!;
  const weapon = resolveWeaponState(familyId, 1);
  const a1 = resolveEnvoySplinterBasic({
    weapon,
    catalogDamage: requireEnvoyWeaponActionDefinition(action1).baseDamage,
    catalogFluxCost: 5,
    veilFlux: 20,
    operativeHp: 80,
    maxHp: 100,
    previousCatalyst: 'BLOOD',
  });
  const planned = planEnvoyWeaponAction({
    actionId: action1,
    familyId,
    classState: createDefaultClassCombatEncounterState(),
    squad: [unit('a')],
    targetId: 'a',
    veilFlux: 20,
    operativeHp: 80,
    maxHp: 100,
    resolvedWeapon: weapon,
    previousCatalystForCleanCycle: 'BLOOD',
  });
  assert.equal(planned.ok, true);
  if (planned.ok) {
    assert.equal(planned.authoredOccultDamage, a1.occultDamage);
    assert.equal(planned.fluxCost, a1.fluxCost);
    assert.equal(planned.rotApply, a1.rotStacks);
    assert.equal(planned.hpSacrifice, a1.hpSacrifice);
    assert.equal(planned.cleanCatalystCycle, a1.cleanCatalystCycle);
  }
}

// VEIL_SPLINTER consolidation path
{
  const classState = createDefaultClassCombatEncounterState();
  const squad = [unit('t')];
  const weapon = resolveWeaponState('envoy-echo-lantern', 1);
  const runtime = createDefaultWeaponRuntime();
  let dmg = 0;
  const r = executeEnvoyAbility({
    abilityId: 'VEIL_SPLINTER',
    squad,
    targetId: 't',
    veilFlux: 50,
    maxSoulAnchor: 100,
    classState,
    log: () => {},
    resolvedWeapon: weapon,
    weaponRuntime: runtime,
    operativeHp: 80,
    spendStamina: () => true,
    applyFluxDelta: () => 50,
    hurtEnemy: (raw) => { dmg = raw; return true; },
    patchUnit: () => {},
    syncSquad: () => {},
    healOperative: () => {},
    reduceEnemyAp: () => {},
  });
  assert.equal(r.ok, true);
  assert.ok(dmg > 0);
  assert.ok(getVeilRotStacks(classState, 't') >= 2);
}

// Compatibility
{
  const { result } = makeExec('envoy-echo-lantern', 'BLACK_WICK', { resolveCatalyst: true });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.provenanceActionId, 'GRAVEWEAVE');
}
assert.equal(makeExec('envoy-null-conduit', 'CATACLYSM_SIGIL').result.ok, false);
assert.equal(makeExec('envoy-echo-lantern', 'ASTRAL_LANCE').result.ok, false);
assert.equal(makeExec('envoy-echo-lantern', 'NULL_ARC').result.ok, false);

// ---------- Catalyst centralization + Silencing Echo ----------
{
  const st = createDefaultClassCombatEncounterState();
  st.currentCatalyst = 'NULL';
  const payoff = previewEnvoyCatalystCast({
    classState: st,
    prime: 'ECHO',
    target: unit('a'),
  });
  assert.equal(payoff.payoff?.damageBonusPercent, 15);
  assert.equal(payoff.payoff?.extraWardBreak, 1);
  const cast = resolveEnvoyCatalystCast({
    classState: st,
    prime: 'ECHO',
    target: unit('a'),
    originActionId: 'SILENT_EDGE',
  });
  assert.equal(cast.primed, true);
  assert.equal(cast.previous, 'NULL');
  assert.equal(cast.current, 'ECHO');
  assert.equal(cast.sequenceResolvedOnce, true);
  // Flex prime map unchanged
  assert.equal(catalystForEnvoyAbility('ASTRAL_LANCE'), 'ECHO');
  assert.equal(catalystPrimeForEnvoyCast('SILENT_EDGE'), 'ECHO');
  assert.equal(catalystPrimeForEnvoyCast('ASTRAL_LANCE'), 'ECHO');
}

// CLEAN_CYCLE Scythe
{
  const planned = planEnvoyWeaponAction({
    actionId: 'NULL_ARC',
    familyId: 'envoy-null-conduit',
    classState: createDefaultClassCombatEncounterState(),
    squad: [unit('a')],
    targetId: 'a',
    veilFlux: 50,
    operativeHp: 80,
    maxHp: 100,
    resolvedWeapon: resolveWeaponState('envoy-null-conduit', 1),
    previousCatalystForCleanCycle: 'NULL',
  });
  assert.equal(planned.ok, true);
  if (planned.ok) assert.equal(planned.cleanCatalystCycle, true);
}

// ---------- Rot transfer / knell ----------
{
  const st = createDefaultClassCombatEncounterState();
  infectVeilRot(st, unit('a'), 3, () => {});
  const { result, classState } = makeExec('envoy-echo-lantern', 'GRAVE_TRANSFER', {
    classState: st,
    secondaryTargetId: 'b',
    resolveCatalyst: true,
  });
  assert.equal(result.ok, true);
  assert.equal(getVeilRotStacks(classState, 'a'), 1);
  assert.equal(getVeilRotStacks(classState, 'b'), 2);
}
{
  const st = createDefaultClassCombatEncounterState();
  infectVeilRot(st, unit('a'), 3, () => {});
  const { result, classState, lastDamage } = makeExec('envoy-echo-lantern', 'ROT_KNELL', {
    classState: st,
    resolveCatalyst: true,
  });
  assert.equal(result.ok, true);
  assert.equal(getVeilRotStacks(classState, 'a'), 1);
  // Vambrace T1 occultDamagePct −5% → floor(16 × 0.95) = 15
  assert.equal(lastDamage, 15);
}

// ---------- Brink / sacrifice / exposure ----------
{
  const { result } = makeExec('envoy-sanguine-prism', 'BLOOD_REFRACTION', {
    flux: PRISM_BRINK_FLUX_THRESHOLD,
    hp: 80,
    maxHp: 100,
    resolveCatalyst: false,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.brinkAmplified, true);
    assert.equal(result.plan.sacrificePaidFully, true);
  }
}
{
  const { result } = makeExec('envoy-sanguine-prism', 'BLOOD_REFRACTION', {
    flux: 40,
    hp: 3,
    maxHp: 100,
    resolveCatalyst: false,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.sacrificePaidFully, false);
    assert.ok(result.plan.hpSacrifice <= 2);
  }
}
{
  const st = createDefaultClassCombatEncounterState();
  const { result, classState } = makeExec('envoy-sanguine-prism', 'EXPOSE_VEIN', {
    classState: st,
    flux: 20,
    resolveCatalyst: true,
  });
  assert.equal(result.ok, true);
  assert.equal(hasSanguineExposure(classState, 'a'), true);
  const claim = makeExec('envoy-sanguine-prism', 'HEART_CLAIM', {
    classState,
    flux: 20,
    resolveCatalyst: true,
  });
  assert.equal(claim.result.ok, true);
  if (claim.result.ok) {
    assert.equal(claim.result.plan.exposureAmplified, true);
    assert.equal(hasSanguineExposure(classState, 'a'), false);
  }
  expireSanguineExposureEndOfEnemyTurn(classState);
  assert.equal(Object.keys(classState.sanguineExposure).length, 0);
}

// Mult constants locked
assert.equal(PRISM_BRINK_DAMAGE_MULT, 1.2);
assert.equal(PRISM_SACRIFICE_PAYOFF_DAMAGE_MULT, 1.15);

// ---------- Player-facing (E.5 — all twelve) ----------
for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
  const [a1, a2] = requireEnvoyWeaponActions(familyId);
  assert.equal(isEnvoyWeaponActionPlayerFacingLive(familyId, a1!), true);
  assert.equal(isEnvoyWeaponActionPlayerFacingLive(familyId, a2!), true);
}
assert.deepEqual(
  [...projectEnvoyLiveFourSlotDeck(DEFAULT_ENVOY_FLEX_LOADOUT)],
  ['VEIL_SPLINTER', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
);
const surface = buildEnvoyCombatSurface({
  weaponFamilyId: 'envoy-echo-lantern',
  flex: sanitizeEnvoyFlexLoadout(DEFAULT_ENVOY_FLEX_LOADOUT),
});
assert.ok(isEnvoyCombatSurfaceComplete(surface));
assert.equal(surface.hudCards.length, 7);

// Ownership unchanged
assert.equal(STARTER_WEAPON_BY_CLASS.ENVOY, 'envoy-echo-lantern');
assert.deepEqual(validateWeaponUnlockPaths(), []);
assert.ok(getWeaponFamily('envoy-null-conduit').unlockRequirement.length > 0);
const migrated = normalizeWeaponProgression({
  weaponUnlocks: ['envoy-null-conduit'],
  weaponTiers: { 'envoy-null-conduit': 2 },
  equippedWeaponByClass: { ENVOY: 'envoy-null-conduit' },
} as Parameters<typeof normalizeWeaponProgression>[0]);
assert.equal(migrated.equippedWeaponByClass.ENVOY, 'envoy-null-conduit');
assert.ok(migrated.weaponUnlocks.includes('envoy-echo-lantern'));

// Aegis/Hex containment
for (const id of ALL_AEGIS_WEAPON_FAMILY_IDS) assert.ok(deriveAegisWeaponActions(id));
for (const id of ALL_HEX_WEAPON_FAMILY_IDS) assert.equal(requireHexWeaponActions(id).length, 4);

// Roster freeze
assert.deepEqual([...ENVOY_VAMBRACE_WEAPON_ACTIONS], ['GRAVEWEAVE', 'GRAVE_TRANSFER', 'VEIL_BRAND', 'ROT_KNELL']);
assert.deepEqual([...ENVOY_SCYTHE_WEAPON_ACTIONS], ['NULL_ARC', 'SILENT_EDGE', 'VEIN_CUT', 'SMOKE_ARC']);
assert.deepEqual([...ENVOY_HEARTS_DUE_WEAPON_ACTIONS], ['BLOOD_REFRACTION', 'EXPOSE_VEIN', 'CRIMSON_VENT', 'HEART_CLAIM']);

console.log('Envoy Weapon-Kit Phase E.4 OK');
