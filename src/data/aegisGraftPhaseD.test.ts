/**
 * Phase D — Aegis graft eligibility / surface / Echo-Splinter / Grid-Hacker / Martyr.
 */
import assert from 'node:assert/strict';
import {
  buildAegisGraftSurface,
  encodeAegisGraftTargetKey,
  sanitizeAegisAbilityGraftMap,
  coerceLegacyAegisGraftKey,
  isAegisFixedBasicStrike,
  isAegisGraftableUltimateId,
  parseAegisGraftTargetKey,
  resolveAegisAbilityGraftId,
} from './aegisGraftTarget';
import {
  classifyAbilitySocket as classifySocket,
  getGraftSocketAccessForRunDepth,
} from './graftSynergy/graftCapacityEngine';
import { evaluateGraftCompatibility } from './graftSynergy/graftCompatibilityEngine';
import {
  evaluateAegisGraftCompatibility,
  AP_UTILITY_COST_BANNED_GRAFTS,
  weaponActionHasDirectDamage,
} from './aegisGraftCompatibility';
import { AEGIS_AP_UTILITY_TECHNIQUES } from '../types/aegisCombat';
import {
  applyGraftTransformToWeaponPlan,
  buildWeaponActionGraftCastPlan,
} from './aegisWeaponActionGraftEngine';
import { planWardensStrike, planAegisWeaponAction } from './aegisWeaponActionResolveEngine';
import {
  canRefundGridHackerAp,
  createDefaultGraftEncounterSafetyState,
  recordGridHackerApRefund,
  GRID_HACKER_AP_REFUND_CAP_PER_ENCOUNTER,
} from './graftSynergy/graftEncounterSafety';
import { createDefaultBoonEncounterState } from '../types/boonHooks';
import { validateSanctuaryGraftApplication } from './graftSynergy/permanentGraftLoadoutEngine';
import { sanitizeAegisAbilityGrafts } from './graftSynergy/graftSanitizationEngine';
import { canGraftClassAbility } from './classGraftEngine';
import { deriveAegisWeaponActions } from './aegisWeaponActionRegistry';
import { buildAegisCombatSurface } from './aegisCombatCompatibility';

const LONGSWORD_SURFACE = buildAegisGraftSurface({
  weaponFamilyId: 'aegis-longsword',
  techniques: ['RUIN', 'GRAVE_BIND', 'RUNEBOUND_CARAPACE'],
});

// 1. Sanctuary surface = 4 family actions + 3 snapshotted techniques
{
  assert.equal(LONGSWORD_SURFACE.length, 7);
  assert.deepEqual(
    LONGSWORD_SURFACE.filter((r) => r.group === 'WEAPON_ACTION').map((r) => r.actionId),
    [...deriveAegisWeaponActions('aegis-longsword')!],
  );
  assert.deepEqual(
    LONGSWORD_SURFACE.filter((r) => r.group === 'TECHNIQUE').map((r) => r.actionId),
    ['RUIN', 'GRAVE_BIND', 'RUNEBOUND_CARAPACE'],
  );
}

// 2–3. Account edits / other-family cannot restore onto snapshotted surface
{
  const dirty = sanitizeAegisAbilityGraftMap(
    {
      'WA:PAIRED_BLADES_STRIKE': 'DENSITY_GRAFT',
      STRIKE: 'ECHO_GRAFT',
      EVISCERATE: 'APEX_GRAFT',
      'TECH:RUIN': 'FLAYER_GRAFT',
      VEIL_PIERCER: 'NEUTRON_GRAFT', // not in snapshot
    },
    {
      weaponFamilyId: 'aegis-longsword',
      techniques: ['RUIN', 'GRAVE_BIND', 'RUNEBOUND_CARAPACE'],
    },
  );
  assert.equal(dirty['WA:PAIRED_BLADES_STRIKE'], undefined);
  assert.equal(dirty.STRIKE, undefined);
  assert.equal(dirty['TECH:RUIN'], 'FLAYER_GRAFT');
  assert.equal(dirty['TECH:VEIL_PIERCER'], undefined);
}

// 4. Discriminated identity
{
  const wa = encodeAegisGraftTargetKey({ kind: 'WEAPON_ACTION', actionId: 'RUPTURE' });
  const tech = encodeAegisGraftTargetKey({ kind: 'TECHNIQUE', techniqueId: 'RUIN' });
  assert.equal(wa, 'WA:RUPTURE');
  assert.equal(tech, 'TECH:RUIN');
  assert.equal(parseAegisGraftTargetKey(wa)?.kind, 'WEAPON_ACTION');
  assert.equal(parseAegisGraftTargetKey(tech)?.kind, 'TECHNIQUE');
  assert.equal(coerceLegacyAegisGraftKey('STRIKE'), null);
  assert.equal(coerceLegacyAegisGraftKey('THREEFOLD_BRAND'), null);
}

// 5. One graft per target / one target per graft
{
  const dup = validateSanctuaryGraftApplication({
    classId: 'AEGIS',
    abilityId: 'RUPTURE',
    graftId: 'FLAYER_GRAFT',
    runDepthBand: 2,
    currentMap: { 'TECH:RUIN': 'FLAYER_GRAFT' },
    sanctuarySessionActive: true,
    residueBalance: 100,
    sanctuaryOffers: ['FLAYER_GRAFT'],
    aegisSurface: {
      weaponFamilyId: 'aegis-longsword',
      techniques: ['RUIN', 'GRAVE_BIND', 'RUNEBOUND_CARAPACE'],
    },
  });
  assert.equal(dup.ok, false);
  assert.ok(dup.rejections.includes('DUPLICATE_GRAFT_ID'));
}

// 6–7. Capacity from run depth + family Strike access flags
{
  assert.equal(getGraftSocketAccessForRunDepth(1).capacity, 1);
  assert.equal(getGraftSocketAccessForRunDepth(2).allowFixedBasic, true);
  assert.equal(getGraftSocketAccessForRunDepth(3).capacity, 3);
  assert.equal(getGraftSocketAccessForRunDepth(3).allowUltimate, true);
  assert.equal(getGraftSocketAccessForRunDepth(3).allowApexMasterwork, true);
  for (const id of ['WARDENS_STRIKE', 'PAIRED_BLADES_STRIKE', 'UNMAKER_STRIKE'] as const) {
    assert.equal(isAegisFixedBasicStrike(id), true);
    assert.equal(classifySocket('AEGIS', id), 'FIXED_BASIC_SIGNATURE');
    assert.equal(canGraftClassAbility('AEGIS', id, { allowFixedBasic: false }), false);
    assert.equal(canGraftClassAbility('AEGIS', id, { allowFixedBasic: true }), true);
  }
}

// 8–11. No generic STRIKE; Parry/Ultimates ungraftable; ABYSSAL_VERDICT Ultimate; THREEFOLD removed
{
  assert.equal(canGraftClassAbility('AEGIS', 'STRIKE', { allowFixedBasic: true }), false);
  assert.equal(canGraftClassAbility('AEGIS', 'WRAITH_PARRY', { allowUltimate: true }), false);
  assert.equal(canGraftClassAbility('AEGIS', 'ABYSSAL_VERDICT', { allowUltimate: true }), false);
  assert.equal(canGraftClassAbility('AEGIS', 'REND_THE_VEIL', { allowUltimate: true }), false);
  assert.equal(canGraftClassAbility('AEGIS', 'GRAVEFALL', { allowUltimate: true }), false);
  assert.equal(classifySocket('AEGIS', 'ABYSSAL_VERDICT'), 'ULTIMATE');
  assert.equal(isAegisGraftableUltimateId('ABYSSAL_VERDICT'), true);
  assert.notEqual(classifySocket('AEGIS', 'THREEFOLD_BRAND'), 'ULTIMATE');
}

// 12. Each current-family weapon action accepts ≥1 compatible graft
{
  const family = deriveAegisWeaponActions('aegis-longsword')!;
  for (const actionId of family) {
    const key = encodeAegisGraftTargetKey({ kind: 'WEAPON_ACTION', actionId });
    const probe = evaluateGraftCompatibility({
      classId: 'AEGIS',
      abilityId: key,
      graftId: actionId === 'WARDENS_STRIKE' ? 'FLAYER_GRAFT' : 'FLAYER_GRAFT',
      runDepthBand: 2,
      equippedMap: {},
      graftAvailable: true,
    });
    assert.equal(probe.ok, true, `${actionId} should accept FLAYER`);
  }
}

// 14–16. Incompatible / AP-utility bans / Conduit×Ruin
{
  const densityOnBind = evaluateAegisGraftCompatibility({
    target: { kind: 'TECHNIQUE', techniqueId: 'GRAVE_BIND' },
    graftId: 'DENSITY_GRAFT',
    allowFixedBasic: true,
  });
  assert.equal(densityOnBind.ok, false);

  for (const tech of AEGIS_AP_UTILITY_TECHNIQUES) {
    for (const graftId of AP_UTILITY_COST_BANNED_GRAFTS) {
      const r = evaluateAegisGraftCompatibility({
        target: { kind: 'TECHNIQUE', techniqueId: tech },
        graftId,
        allowFixedBasic: true,
      });
      assert.equal(r.ok, false, `${graftId} must ban ${tech}`);
    }
  }

  const conduitRuin = evaluateAegisGraftCompatibility({
    target: { kind: 'TECHNIQUE', techniqueId: 'RUIN' },
    graftId: 'CONDUIT_GRAFT',
    allowFixedBasic: true,
  });
  assert.equal(conduitRuin.ok, false);

  const echoOnTech = evaluateAegisGraftCompatibility({
    target: { kind: 'TECHNIQUE', techniqueId: 'RUIN' },
    graftId: 'ECHO_GRAFT',
    allowFixedBasic: true,
  });
  assert.equal(echoOnTech.ok, false);

  const echoOnEclipse = evaluateAegisGraftCompatibility({
    target: { kind: 'WEAPON_ACTION', actionId: 'ECLIPSE' },
    graftId: 'ECHO_GRAFT',
    allowFixedBasic: true,
  });
  assert.equal(echoOnEclipse.ok, false);
  const splinterOnUnbowed = evaluateAegisGraftCompatibility({
    target: { kind: 'WEAPON_ACTION', actionId: 'UNBOWED' },
    graftId: 'SPLINTER_GRAFT',
    allowFixedBasic: true,
  });
  assert.equal(splinterOnUnbowed.ok, false);
  // Incidental 10 Kinetic does not move them onto the direct-damage Echo/Splinter set.
  assert.equal(weaponActionHasDirectDamage('ECLIPSE'), false);
  assert.equal(weaponActionHasDirectDamage('UNBOWED'), false);
}

// 21–23. Echo / Splinter transform
{
  const plan = planWardensStrike();
  const echo = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'ECHO_GRAFT');
  const echoed = applyGraftTransformToWeaponPlan(plan, echo);
  assert.ok(echoed.hits.length >= 2);
  assert.ok(echoed.hits.some((h) => 'graftAdded' in h && h.graftAdded));
  assert.ok(echoed.hits.every((h) => h.fractureGain === 0));
  const authored = echoed.hits.filter((h) => !('graftAdded' in h && h.graftAdded));
  const graftHits = echoed.hits.filter((h) => 'graftAdded' in h && h.graftAdded);
  assert.ok(graftHits.every((h) => h.reserveGain === 0 && h.armorStrip === 0));
  assert.ok(authored[0]!.kineticDamage === 14);

  const splinter = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'SPLINTER_GRAFT');
  const split = applyGraftTransformToWeaponPlan(plan, splinter);
  assert.equal(split.hits.length, 3);
  assert.equal(split.hits.filter((h) => 'graftAdded' in h && h.graftAdded).length, 2);
  assert.equal(split.hits[0]!.kineticDamage, Math.floor(14 * 0.8));
}

// 26–27. Grid-Hacker encounter cap
{
  let state = createDefaultGraftEncounterSafetyState();
  assert.equal(canRefundGridHackerAp(state), true);
  state = recordGridHackerApRefund(state);
  assert.equal(state.gridHackerApRefunds, 1);
  assert.equal(canRefundGridHackerAp(state), GRID_HACKER_AP_REFUND_CAP_PER_ENCOUNTER > 1);
  state = recordGridHackerApRefund(state);
  assert.ok(state.gridHackerApRefunds <= GRID_HACKER_AP_REFUND_CAP_PER_ENCOUNTER);
  state = createDefaultGraftEncounterSafetyState();
  assert.equal(canRefundGridHackerAp(state), true);
}

// 28. Martyr two-hit counter shape (with Phase D.2 provenance fields)
{
  const enc = createDefaultBoonEncounterState();
  assert.equal(enc.juggernautShieldHits, 0);
  assert.equal(enc.hitAbsorbProtectionSource, null);
  enc.juggernautShieldHits = 2;
  enc.hitAbsorbProtectionSource = 'MARTYR_GRAFT';
  enc.juggernautShieldHits -= 1;
  assert.equal(enc.juggernautShieldHits, 1);
  assert.equal(enc.hitAbsorbProtectionSource, 'MARTYR_GRAFT');
  enc.juggernautShieldHits -= 1;
  enc.hitAbsorbProtectionSource = enc.juggernautShieldHits > 0 ? enc.hitAbsorbProtectionSource : null;
  assert.equal(enc.juggernautShieldHits, 0);
  assert.equal(enc.hitAbsorbProtectionSource, null);
}

// 32. Stale keys dropped, never redirected
{
  assert.equal(coerceLegacyAegisGraftKey('BLOOD_TITHE'), null);
  assert.equal(coerceLegacyAegisGraftKey('ABYSSAL_FAULT'), null);
  assert.equal(coerceLegacyAegisGraftKey('BLOOD_BOUND_CARAPACE'), null);
  const { map } = sanitizeAegisAbilityGrafts(
    { STRIKE: 'ECHO_GRAFT', EVISCERATE: 'APEX_GRAFT', THREEFOLD_BRAND: 'FLAYER_GRAFT' } as never,
    2,
    {
      weaponFamilyId: 'aegis-longsword',
      techniques: ['RUIN', 'GRAVE_BIND', 'RUNEBOUND_CARAPACE'],
    },
  );
  assert.equal(Object.keys(map).length, 0);
}

// 33. New deployments start empty (engine default)
{
  assert.deepEqual(sanitizeAegisAbilityGraftMap({}, {
    weaponFamilyId: 'aegis-longsword',
    techniques: ['RUIN', 'GRAVE_BIND', 'RUNEBOUND_CARAPACE'],
  }), {});
}

// 36. Combat surface still 4+3
{
  const surface = buildAegisCombatSurface({
    weaponFamilyId: 'aegis-longsword',
    techniques: ['RUIN', 'GRAVE_BIND', 'RUNEBOUND_CARAPACE'],
  });
  assert.equal(surface.weaponActions.length, 4);
  assert.equal(surface.techniques.length, 3);
}

// Lookup prefers encoded keys
{
  const map = { 'WA:RUPTURE': 'FLAYER_GRAFT' as const, RUPTURE: 'DENSITY_GRAFT' as const };
  assert.equal(resolveAegisAbilityGraftId(map, 'RUPTURE'), 'FLAYER_GRAFT');
}

// Doomfall charge stage does not expand Echo hits
{
  const charge = planAegisWeaponAction('DOOMFALL', {
    tempoArmed: false,
    targetFracturedAtStart: false,
    noRespiteUsedThisTurn: false,
    doomfallReleaseAvailable: false,
  });
  assert.equal(charge.stage, 'CHARGE');
  const echo = buildWeaponActionGraftCastPlan('DOOMFALL', 'ECHO_GRAFT');
  // Executor skips transform on CHARGE; transform helper still runs if called — Charge has 0 hits.
  const transformed = applyGraftTransformToWeaponPlan(charge, echo);
  assert.equal(charge.hits.length, 0);
  assert.ok(transformed.hits.length === 0 || transformed.stage === 'CHARGE');
}

console.log('aegisGraftPhaseD.test.ts: ok');
