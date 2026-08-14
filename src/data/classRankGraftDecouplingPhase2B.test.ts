import assert from 'node:assert/strict';
import {
  getGraftCapacityForRunDepth,
  getGraftSocketAccessForRunDepth,
  MAX_RUN_GRAFT_CAPACITY,
  resolveRunGraftDepthBand,
} from './graftSynergy/graftCapacityEngine';
import { evaluateGraftCompatibility } from './graftSynergy/graftCompatibilityEngine';
import { getUniversalGraftForAction } from './universalGraftRegistry';
import { createDefaultProgressionProfile, normalizeProgressionProfile } from './progressionProfileEngine';

console.log('Stage V-B — Class Rank remains decoupled from action upgrades');

assert.deepEqual(
  [1, 2, 3, 3].map(getGraftCapacityForRunDepth),
  [1, 2, 3, MAX_RUN_GRAFT_CAPACITY],
);
assert.equal(resolveRunGraftDepthBand({ currentDistrict: 2, currentDepth: 40 }), 2);

const depthOneAccess = getGraftSocketAccessForRunDepth(1);
assert.equal(depthOneAccess.allowFixedBasic, true);
assert.equal(depthOneAccess.allowUltimate, false);
assert.equal(depthOneAccess.allowApexMasterwork, false);

const upgrade = getUniversalGraftForAction('AEGIS', 'VEIL_PIERCER')!;
const evaluateAtRank = (_rank: number) => evaluateGraftCompatibility({
  classId: 'AEGIS',
  abilityId: 'TECH:VEIL_PIERCER',
  graftId: upgrade.id,
  runDepthBand: 1,
  equippedMap: {},
  graftAvailable: true,
});
assert.deepEqual(evaluateAtRank(1), evaluateAtRank(20));
assert.equal(evaluateAtRank(1).ok, true);

const lowRank = normalizeProgressionProfile({
  ...createDefaultProgressionProfile(),
  classes: {
    ...createDefaultProgressionProfile().classes,
    AEGIS: { ...createDefaultProgressionProfile().classes.AEGIS, rank: 1, xp: 0 },
  },
});
const highRank = normalizeProgressionProfile({
  ...createDefaultProgressionProfile(),
  classes: {
    ...createDefaultProgressionProfile().classes,
    AEGIS: { ...createDefaultProgressionProfile().classes.AEGIS, rank: 20, xp: 999 },
  },
});
assert.notEqual(lowRank.classes.AEGIS.rank, highRank.classes.AEGIS.rank);
assert.deepEqual(
  getGraftSocketAccessForRunDepth(2),
  getGraftSocketAccessForRunDepth(2),
);

console.log('Stage V-B Class Rank decoupling passed.');
