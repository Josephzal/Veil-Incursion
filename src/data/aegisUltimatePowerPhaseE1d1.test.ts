/**
 * Phase E.1d.1 — REND_THE_VEIL / GRAVEFALL ultimate-owned scaling (matrix preserved).
 * Run: npx tsx src/data/aegisUltimatePowerPhaseE1d1.test.ts
 */
import assert from 'node:assert/strict';
import {
  gravefallBaseStrike,
  rendTheVeilBaseStrike,
  resolveAegisUltimateStrikePower,
} from './aegisUltimatePowerEngine';
import {
  reaveKineticDamage,
  resolveAegisTechniqueStrikePower,
  veilPiercerOccultDamage,
} from './aegisTechniquePowerEngine';
import { planGravefall, planRendTheVeil } from './weaponUltimateNewResolveEngine';
import {
  planPairedBladesStrike,
  planUnmakerStrike,
  planWardensStrike,
} from './aegisWeaponActionResolveEngine';
import { resolveWeaponCombatStatsFromState } from './weaponCombatEngine';
import { resolveWeaponState } from './weaponProgressionEngine';
import { canGraftClassAbility } from './classGraftEngine';
import { ZERO_PROTOCOL_CONFIG } from './hexZeroProtocolEngine';
import { CATACLYSM_SIGIL_DAMAGE_CAP } from './envoyRotEngine';
import { WEAPON_REGISTRY } from './weaponRegistry';

console.log('Phase E.1d.1 — ultimate scaling ownership');

function ultimatePower(familyId: 'aegis-rift-edge' | 'aegis-claymore-blade', tier: 1 | 2 | 3): number {
  const state = resolveWeaponState(familyId, tier);
  const stats = resolveWeaponCombatStatsFromState(state);
  assert.ok(typeof stats.aegisUltimateStrikePower === 'number');
  return stats.aegisUltimateStrikePower!;
}

function techniquePower(
  familyId: 'aegis-rift-edge' | 'aegis-claymore-blade' | 'aegis-runed-longsword',
  tier: 1 | 2 | 3,
): number {
  const state = resolveWeaponState(familyId, tier);
  return resolveWeaponCombatStatsFromState(state).aegisTechniqueStrikePower!;
}

const pairedT1 = ultimatePower('aegis-rift-edge', 1);
const pairedT2 = ultimatePower('aegis-rift-edge', 2);
const pairedT3 = ultimatePower('aegis-rift-edge', 3);
assert.equal(pairedT1, 14);
assert.equal(pairedT2, 14);
assert.equal(pairedT3, 14);

const unmakerT1 = ultimatePower('aegis-claymore-blade', 1);
const unmakerT2 = ultimatePower('aegis-claymore-blade', 2);
const unmakerT3 = ultimatePower('aegis-claymore-blade', 3);
assert.equal(unmakerT1, 17);
assert.equal(unmakerT2, 18);
assert.equal(unmakerT3, 18);

function rendAgg(sd: number, tempo: boolean, grade: 'STANDARD' | 'CLEAN' | 'PERFECT'): number {
  const plan = planRendTheVeil({
    grade,
    baseStrike: rendTheVeilBaseStrike(sd),
    tempoArmed: tempo,
  });
  return plan.kineticHitDamage * 2 + plan.occultRuptureDamage;
}

assert.equal(rendAgg(14, false, 'STANDARD'), 19);
assert.equal(rendAgg(14, true, 'STANDARD'), 25);
assert.equal(rendAgg(14, true, 'CLEAN'), 29);
assert.equal(rendAgg(14, true, 'PERFECT'), 32);
assert.equal(rendAgg(14, false, 'CLEAN'), 22);
assert.equal(rendAgg(14, false, 'PERFECT'), 24);

function gravePrimary(sd: number, grade: 'STANDARD' | 'CLEAN' | 'PERFECT'): number {
  return planGravefall({
    grade,
    baseStrike: gravefallBaseStrike(sd),
    targetFractured: false,
  }).impactDamage;
}

assert.equal(gravePrimary(17, 'STANDARD'), 22);
assert.equal(gravePrimary(17, 'CLEAN'), 25);
assert.equal(gravePrimary(17, 'PERFECT'), 27);
assert.equal(gravePrimary(18, 'STANDARD'), 24);
assert.equal(gravePrimary(18, 'CLEAN'), 26);
assert.equal(gravePrimary(18, 'PERFECT'), 29);

const gravePerf = planGravefall({
  grade: 'PERFECT',
  baseStrike: gravefallBaseStrike(17),
  targetFractured: true,
});
assert.equal(gravePerf.shockwaveSecondary, true);
const splash = Math.max(1, Math.floor(gravePerf.impactDamage * 0.35));
assert.equal(splash, 9);
assert.equal(gravePerf.impactDamage + splash * 2, 45);

// Changing legacy strikeDamagePct must not change ultimate when ultimate field present
const pairedMods = resolveWeaponState('aegis-rift-edge', 1).statModifiers;
assert.equal(pairedMods.aegisUltimatePowerPct, -5);
assert.equal(resolveAegisUltimateStrikePower({ ...pairedMods, strikeDamagePct: 99 }), 14);

// Migration fallback when ultimate field absent
assert.equal(resolveAegisUltimateStrikePower({ strikeDamagePct: -5 }), 14);
assert.equal(resolveAegisUltimateStrikePower({ strikeDamagePct: 15 }), 17);

// Technique power unchanged / separate
assert.equal(techniquePower('aegis-rift-edge', 1), 14);
assert.equal(veilPiercerOccultDamage(14), Math.max(8, Math.floor(14 * 0.85)));
assert.equal(reaveKineticDamage(14), Math.max(14, Math.floor(14 * 1.15)));
assert.equal(
  resolveAegisTechniqueStrikePower({ aegisUltimatePowerPct: 50, aegisTechniquePowerPct: 0 }),
  15,
);

// WA kinetic unchanged
assert.equal(planWardensStrike().hits[0]!.kineticDamage, 14);
assert.equal(planPairedBladesStrike({ tempoArmed: false }).hits[0]!.kineticDamage, 11);
assert.equal(planUnmakerStrike().hits[0]!.kineticDamage, 15);

// Registry authors ultimate field on Paired / Unmaker
assert.equal(WEAPON_REGISTRY['aegis-rift-edge'].tiers[0].statModifiers.aegisUltimatePowerPct, -5);
assert.equal(WEAPON_REGISTRY['aegis-claymore-blade'].tiers[0].statModifiers.aegisUltimatePowerPct, 15);

// Hex / Envoy unchanged smoke
assert.equal(ZERO_PROTOCOL_CONFIG.baseTrueDamage, 45);
assert.equal(CATACLYSM_SIGIL_DAMAGE_CAP, 300);
const hex = resolveWeaponCombatStatsFromState(resolveWeaponState('hex-silver-core-sidearm', 1));
assert.equal(hex.aegisUltimateStrikePower, undefined);

// Ungraftable
assert.equal(canGraftClassAbility('AEGIS', 'REND_THE_VEIL', { allowUltimate: true }), false);
assert.equal(canGraftClassAbility('AEGIS', 'GRAVEFALL', { allowUltimate: true }), false);

console.log('Phase E.1d.1 ultimate scaling OK');
console.log(JSON.stringify({
  pairedPower: { T1: pairedT1, T2: pairedT2, T3: pairedT3 },
  unmakerPower: { T1: unmakerT1, T2: unmakerT2, T3: unmakerT3 },
  rendTempoPerfect: rendAgg(14, true, 'PERFECT'),
  graveStd: gravePrimary(17, 'STANDARD'),
  gravePerfectAgg3: 45,
}));
