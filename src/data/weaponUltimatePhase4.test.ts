/**
 * WU-4 — six new weapon ultimates resolve plans + fire gates.
 * Run: npx tsx src/data/weaponUltimatePhase4.test.ts
 */
import assert from 'node:assert/strict';
import {
  assertWeaponUltimateNamesMatchRegistry,
  canFireLegacyClassUltimate,
  canFireWeaponUltimate,
  formatWeaponUltimateLogTag,
  getWeaponUltimate,
  listWeaponUltimates,
} from './weaponUltimateRegistry';
import {
  gradeFromStageScores,
  gradePerformanceMult,
  isWu4NewUltimateId,
  planCrimsonRefraction,
  planFuneralKnot,
  planGravefall,
  planLastKnock,
  planRendTheVeil,
  planSixthSeal,
  WU4_ULTIMATE_IDS,
} from './weaponUltimateNewResolveEngine';
import { getWu4StagedScript } from './weaponUltimateStagedScripts';
import { PRISM_BASIC_HP_SACRIFICE_MAX, PRISM_BASIC_HP_SACRIFICE_PCT } from './weaponBasicEngine';

console.log('Phase WU-4 — six new weapon ultimates');

assert.deepEqual(assertWeaponUltimateNamesMatchRegistry(), []);
assert.equal(listWeaponUltimates().filter((u) => u.status === 'WIRED').length, 9);

for (const id of WU4_ULTIMATE_IDS) {
  assert.ok(isWu4NewUltimateId(id));
  assert.ok(getWu4StagedScript(id), `${id} needs staged script`);
  assert.equal(getWu4StagedScript(id)?.stages.length, 3);
}

assert.equal(canFireWeaponUltimate('aegis-rift-edge'), true);
assert.equal(canFireWeaponUltimate('aegis-claymore-blade'), true);
assert.equal(canFireWeaponUltimate('hex-silver-core-sidearm'), true);
assert.equal(canFireWeaponUltimate('hex-void-cannon'), true);
assert.equal(canFireWeaponUltimate('envoy-echo-lantern'), true);
assert.equal(canFireWeaponUltimate('envoy-sanguine-prism'), true);
assert.equal(canFireWeaponUltimate(null), false);

// Sibling rebound gates unchanged
assert.equal(canFireLegacyClassUltimate('EVISCERATE', 'aegis-rift-edge'), false);
assert.equal(canFireLegacyClassUltimate('ZERO_PROTOCOL', 'hex-void-cannon'), false);
assert.equal(canFireLegacyClassUltimate('CATACLYSM_SIGIL', 'envoy-echo-lantern'), false);

assert.equal(gradePerformanceMult('STANDARD'), 1);
assert.equal(gradePerformanceMult('CLEAN'), 1.1);
assert.equal(gradePerformanceMult('PERFECT'), 1.2);
assert.equal(gradeFromStageScores([1, 1, 1]), 'PERFECT');
assert.equal(gradeFromStageScores([0.6, 0.6, 0.6]), 'CLEAN');
assert.equal(gradeFromStageScores([0.2, 0.2, 0.2]), 'STANDARD');
assert.equal(gradeFromStageScores([1, 1, 1], true), 'STANDARD');

const rendCold = planRendTheVeil({ grade: 'STANDARD', baseStrike: 20, tempoArmed: false });
const rendHot = planRendTheVeil({ grade: 'PERFECT', baseStrike: 20, tempoArmed: true });
assert.equal(rendCold.consumeTempo, false);
assert.equal(rendHot.consumeTempo, true);
assert.ok(rendHot.occultRuptureDamage > rendCold.occultRuptureDamage);

const grave = planGravefall({ grade: 'PERFECT', baseStrike: 20, targetFractured: true });
assert.equal(grave.shockwaveSecondary, true);
assert.equal(grave.fractureCashoutHint, true);

const seal = planSixthSeal({ grade: 'PERFECT', magSize: 6 });
assert.equal(seal.reloadQuality, 'PERFECT');
assert.equal(seal.emptyMagazineAfter, true);
assert.equal(planSixthSeal({ grade: 'CLEAN', magSize: 6 }).reloadQuality, 'ACTIVE');
assert.equal(planSixthSeal({ grade: 'STANDARD', magSize: 6 }).reloadQuality, 'NORMAL');

const blocked = planLastKnock({ grade: 'STANDARD', currentAmmo: 0, baseBallistic: 16 });
assert.ok('blocked' in blocked);
const knock = planLastKnock({ grade: 'CLEAN', currentAmmo: 3, baseBallistic: 16 });
assert.ok(!('blocked' in knock));
if (!('blocked' in knock)) {
  assert.equal(knock.committedRounds, 3);
  assert.ok(knock.breachDamage > 0);
  assert.ok(!formatWeaponUltimateLogTag('hex-void-cannon').includes('The Black Door'));
  assert.equal(formatWeaponUltimateLogTag('hex-void-cannon'), '[LAST KNOCK]');
}

const knot = planFuneralKnot({ grade: 'CLEAN', baseOccult: 20 });
assert.equal(knot.detonationEfficiency, 1.1);

const maxSafe = Math.min(
  PRISM_BASIC_HP_SACRIFICE_MAX,
  Math.max(1, Math.floor(100 * PRISM_BASIC_HP_SACRIFICE_PCT)),
);
const crimson = planCrimsonRefraction({
  grade: 'PERFECT',
  baseOccult: 20,
  offeredHp: maxSafe,
  maxSafeOffer: maxSafe,
  operativeHp: 40,
  veilFlux: 20,
});
assert.equal(crimson.fullPay, true);
assert.equal(crimson.brinkAmp, true);
assert.ok(crimson.offeredHp <= maxSafe);
assert.ok(crimson.offeredHp < 40);

const partial = planCrimsonRefraction({
  grade: 'STANDARD',
  baseOccult: 20,
  offeredHp: 2,
  maxSafeOffer: maxSafe,
  operativeHp: 40,
  veilFlux: 50,
});
assert.equal(partial.fullPay, false);
assert.equal(partial.brinkAmp, false);

assert.equal(getWeaponUltimate('aegis-rift-edge').id, 'REND_THE_VEIL');
assert.equal(getWeaponUltimate('envoy-sanguine-prism').displayName, 'CRIMSON REFRACTION');

console.log('Phase WU-4 OK — six ultimates WIRED, plans, staged scripts, fire gates');
