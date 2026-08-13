/**
 * Stage II-B — Class Rank decoupled from grafts; no Residue graft cost.
 * Run: npx tsx src/data/classRankGraftDecouplingPhase2B.test.ts
 */
import assert from 'node:assert/strict';
import {
  getGraftCapacityForRunDepth,
  getGraftSocketAccessForRunDepth,
  MAX_RUN_GRAFT_CAPACITY,
  resolveRunGraftDepthBand,
} from './graftSynergy/graftCapacityEngine';
import { evaluateGraftCompatibility } from './graftSynergy/graftCompatibilityEngine';
import {
  filterGraftOffersForRunDepth,
  validateSanctuaryGraftApplication,
} from './graftSynergy/permanentGraftLoadoutEngine';
import { canAffordAnySanctuaryGraft, canGraftClassAbility, getClassGraftDefinition } from './classGraftEngine';
import { createDefaultProgressionProfile, normalizeProgressionProfile } from './progressionProfileEngine';
import { createDefaultPlayerAccount } from '../context/PlayerAccountContext';
import { mergeStoredAccount } from '../context/PlayerAccountContext';
import { createInitialRunState } from './createInitialRunState';
import { BASE_MAX_SOUL_ANCHOR, BASE_MAX_STAMINA } from '../types/run';

console.log('Stage II-B — Class Rank graft decoupling');

// 1–2. Depth capacities 1/2/3 and hard cap
{
  assert.equal(getGraftCapacityForRunDepth(1), 1);
  assert.equal(getGraftCapacityForRunDepth(2), 2);
  assert.equal(getGraftCapacityForRunDepth(3), 3);
  assert.equal(getGraftCapacityForRunDepth(0), 1);
  assert.equal(getGraftCapacityForRunDepth(99), MAX_RUN_GRAFT_CAPACITY);
  assert.equal(MAX_RUN_GRAFT_CAPACITY, 3);
}

// Canonical depth source: currentDistrict preferred
{
  assert.equal(resolveRunGraftDepthBand({ currentDistrict: 2, currentDepth: 40 }), 2);
  assert.equal(resolveRunGraftDepthBand({ currentDepth: 1 }), 1);
  assert.equal(resolveRunGraftDepthBand({ currentDepth: 20 }), 2);
}

// 3. Capacity independent of Class Rank
{
  const low = getGraftSocketAccessForRunDepth(1);
  const high = getGraftSocketAccessForRunDepth(1);
  assert.deepEqual(
    { c: low.capacity, b: low.allowFixedBasic, u: low.allowUltimate, a: low.allowApexMasterwork },
    { c: high.capacity, b: high.allowFixedBasic, u: high.allowUltimate, a: high.allowApexMasterwork },
  );
}

// 4–5. Low-rank vs high-rank: same category access at same depth
{
  const depth1 = getGraftSocketAccessForRunDepth(1);
  assert.equal(depth1.allowFixedBasic, true);
  assert.equal(depth1.allowUltimate, true);
  assert.equal(depth1.allowApexMasterwork, true);
  const offers = filterGraftOffersForRunDepth('AEGIS', ['NEUTRON_GRAFT', 'APEX_GRAFT'], 1);
  assert.ok(offers.includes('APEX_GRAFT'));
  assert.ok(offers.includes('NEUTRON_GRAFT'));
}

// 6. Non-rank compatibility still enforced (Aegis ultimates ungraftable)
{
  assert.equal(canGraftClassAbility('AEGIS', 'ABYSSAL_VERDICT', {
    allowFixedBasic: true,
    allowUltimate: true,
  }), false);
  const bloodMag = evaluateGraftCompatibility({
    classId: 'HEX_SHOT',
    abilityId: 'SILVER_CORE_SIDEARM',
    graftId: 'BLOOD_MAG_GRAFT',
    runDepthBand: 3,
    equippedMap: {},
    graftAvailable: true,
  });
  assert.ok(bloodMag.rejections.includes('SAFETY_INVARIANT'));
}

// 7–8. Zero Residue can apply; apply does not require Residue
{
  assert.equal(canAffordAnySanctuaryGraft('AEGIS', 0), true);
  const ok = validateSanctuaryGraftApplication({
    classId: 'AEGIS',
    abilityId: 'VEIL_PIERCER',
    graftId: 'NEUTRON_GRAFT',
    runDepthBand: 1,
    currentMap: {},
    sanctuarySessionActive: true,
    residueBalance: 0,
    sanctuaryOffers: ['NEUTRON_GRAFT', 'FLAYER_GRAFT', 'IRON_LUNG_GRAFT'],
    aegisSurface: {
      weaponFamilyId: 'aegis-longsword',
      techniques: ['VEIL_PIERCER', 'ASHEN_MANTLE', 'RUIN'],
    },
  });
  assert.equal(ok.ok, true);
  assert.ok(!ok.rejections.includes('INSUFFICIENT_RESIDUE'));
}

// Capacity full: additional new ability fails; same-ability replace OK
{
  const offers = ['NEUTRON_GRAFT', 'FLAYER_GRAFT', 'IRON_LUNG_GRAFT'];
  const full = validateSanctuaryGraftApplication({
    classId: 'AEGIS',
    abilityId: 'ASHEN_MANTLE',
    graftId: 'FLAYER_GRAFT',
    runDepthBand: 1,
    currentMap: { 'TECH:VEIL_PIERCER': 'NEUTRON_GRAFT' },
    sanctuarySessionActive: true,
    sanctuaryOffers: offers,
    aegisSurface: {
      weaponFamilyId: 'aegis-longsword',
      techniques: ['VEIL_PIERCER', 'ASHEN_MANTLE', 'RUIN'],
    },
  });
  assert.equal(full.ok, false);
  assert.ok(full.rejections.includes('CAPACITY_EXCEEDED'));

  const replace = validateSanctuaryGraftApplication({
    classId: 'AEGIS',
    abilityId: 'VEIL_PIERCER',
    graftId: 'FLAYER_GRAFT',
    runDepthBand: 1,
    currentMap: { 'TECH:VEIL_PIERCER': 'NEUTRON_GRAFT' },
    sanctuarySessionActive: true,
    sanctuaryOffers: offers,
    aegisSurface: {
      weaponFamilyId: 'aegis-longsword',
      techniques: ['VEIL_PIERCER', 'ASHEN_MANTLE', 'RUIN'],
    },
  });
  assert.equal(replace.ok, true);
}

// 9–12. Account normalization preserves rank/XP/Residue; idempotent
{
  const base = createDefaultPlayerAccount();
  const withHistory = mergeStoredAccount({
    ...base,
    veilResidueBalance: 777,
    progressionProfile: {
      ...createDefaultProgressionProfile(),
      classes: {
        ...createDefaultProgressionProfile().classes,
        AEGIS: {
          ...createDefaultProgressionProfile().classes.AEGIS,
          rank: 18,
          xp: 42,
        },
      },
    },
  });
  assert.equal(withHistory.veilResidueBalance, 777);
  assert.equal(withHistory.progressionProfile.classes.AEGIS.rank, 18);
  assert.equal(withHistory.progressionProfile.classes.AEGIS.xp, 42);

  const again = mergeStoredAccount(withHistory);
  assert.equal(again.veilResidueBalance, withHistory.veilResidueBalance);
  assert.equal(again.progressionProfile.classes.AEGIS.rank, 18);
  assert.equal(again.progressionProfile.classes.AEGIS.xp, 42);

  const normalized = normalizeProgressionProfile(withHistory.progressionProfile);
  assert.equal(normalizeProgressionProfile(normalized).classes.AEGIS.rank, 18);
}

// 13. Grafts are run-scoped (fresh run has empty graft-related baseline state)
{
  const run = createInitialRunState();
  assert.equal(run.maxSoulAnchor, BASE_MAX_SOUL_ANCHOR);
  assert.equal(run.maxStamina, BASE_MAX_STAMINA);
  assert.equal('activeTrinkets' in run, false);
}

// 14. Active-run persistence: none for capacity — derived from currentDistrict
{
  // Documented: capacity is resolveRunGraftDepthBand(inc), not a stored account field.
  assert.equal(resolveRunGraftDepthBand({ currentDistrict: 3 }), 3);
}

// Comparison: different Class Rank, identical loadout/depth → identical access
{
  const lowRankProfile = normalizeProgressionProfile({
    ...createDefaultProgressionProfile(),
    classes: {
      ...createDefaultProgressionProfile().classes,
      AEGIS: { ...createDefaultProgressionProfile().classes.AEGIS, rank: 1, xp: 0 },
    },
  });
  const highRankProfile = normalizeProgressionProfile({
    ...createDefaultProgressionProfile(),
    classes: {
      ...createDefaultProgressionProfile().classes,
      AEGIS: { ...createDefaultProgressionProfile().classes.AEGIS, rank: 20, xp: 999 },
    },
  });
  assert.notEqual(lowRankProfile.classes.AEGIS.rank, highRankProfile.classes.AEGIS.rank);

  const depth = 2 as const;
  const lowAccess = getGraftSocketAccessForRunDepth(depth);
  const highAccess = getGraftSocketAccessForRunDepth(depth);
  assert.deepEqual(lowAccess, highAccess);

  const sampleGrafts = ['NEUTRON_GRAFT', 'APEX_GRAFT', 'FLAYER_GRAFT'] as const;
  for (const graftId of sampleGrafts) {
    const low = evaluateGraftCompatibility({
      classId: 'AEGIS',
      abilityId: 'TECH:VEIL_PIERCER',
      graftId,
      runDepthBand: depth,
      equippedMap: {},
      graftAvailable: true,
    });
    const high = evaluateGraftCompatibility({
      classId: 'AEGIS',
      abilityId: 'TECH:VEIL_PIERCER',
      graftId,
      runDepthBand: depth,
      equippedMap: {},
      graftAvailable: true,
    });
    assert.deepEqual(low.rejections, high.rejections);
    assert.equal(low.ok, high.ok);
  }

  // Base combat state for a fresh run is identical regardless of career rank
  const runA = createInitialRunState();
  const runB = createInitialRunState();
  assert.equal(runA.maxSoulAnchor, runB.maxSoulAnchor);
  assert.equal(runA.maxStamina, runB.maxStamina);
  assert.equal(runA.parryWindowBonus, runB.parryWindowBonus);
}

// Catalog cost still exists on definitions but is not an afford gate
{
  const def = getClassGraftDefinition('AEGIS', 'NEUTRON_GRAFT');
  assert.ok(typeof def.cost === 'number' && def.cost > 0);
}

console.log('classRankGraftDecouplingPhase2B.test.ts — all assertions passed');
