/**
 * Phase 3L — weapon UI / tutorial communication gate suite.
 * Run: npx tsx src/data/weaponPlayerFacingPhase3L.test.ts
 */
import assert from 'node:assert/strict';
import {
  ALL_WEAPON_FAMILY_IDS,
  isWeaponFamilyId,
  STARTER_WEAPON_BY_CLASS,
} from './weaponRegistry';
import {
  assertNoRetiredIdsInPlayerFacing,
  getWeaponPlayerFacingSummary,
  inspectWeaponPlayerFacing,
  listWeaponPlayerFacingSummaries,
  resolveAbilityGuidanceForWeapon,
  resolveWeaponCombatCallouts,
  resolveWeaponSectorPressureNote,
  siblingsAreDistinct,
  weaponTutorialCompletionKey,
} from './weaponPlayerFacing/weaponPlayerFacingEngine';
import {
  hasWeaponBriefAcknowledged,
  normalizeWeaponBriefAcknowledged,
  shouldOpenWeaponFirstUseBrief,
  withWeaponBriefAcknowledged,
} from './weaponPlayerFacing/weaponBriefPersistence';
import {
  canonicalizeEncounterEnemyKey,
  isLegacyEnemyAliasKey,
  listPlayerFacingEnemyKeys,
  playerFacingEnemyDisplayName,
} from './enemyAliasCanonical';
import { allDefinedEnemyKeys } from './enemyDefinitions';
import { getWeaponLoadoutRecommendationProfile } from './weaponLoadoutRecommendationProfiles';
import { WEAPON_DRAWBACK_RECORDS } from './weaponDrawbackEngine';
import { ALL_SECTOR_IDS } from './sectorBiomeBridge';
import { listLiveEnemyAudit } from './weaponMatchup/enemyRosterAudit';
import { listWeaponEnemyMatchups, getWeaponEnemyMatchup } from './weaponMatchup/weaponEnemyMatchupEngine';
import { listWeaponSectorMatchups } from './weaponMatchup/weaponSectorMatchupEngine';
import { CLASS_RANK_MAX } from './classRankEngine';
import { PRISM_BRINK_FLUX_THRESHOLD } from './weaponBasicEngine';
import { createDefaultActiveIncursionState } from '../types/game';
import {
  createDefaultWeaponProgression,
  getEquippedWeaponForClass,
  unlockAllWeapons,
} from './weaponProgressionEngine';
import { verifyEncounterCatalog } from './encounterCatalogAuditEngine';

console.log('Phase 3L — weapon player-facing suite');

// --- Canonical summaries ---
const summaries = listWeaponPlayerFacingSummaries();
assert.equal(summaries.length, 9);
assert.equal(summaries.length, ALL_WEAPON_FAMILY_IDS.length);
for (const id of ALL_WEAPON_FAMILY_IDS) {
  const s = getWeaponPlayerFacingSummary(id);
  assert.equal(s.id, id);
  assert.ok(s.displayName.length > 0);
  assert.ok(s.roleLabel.split(/\s+/).length >= 2 && s.roleLabel.split(/\s+/).length <= 5, s.roleLabel);
  assert.ok(s.selectionSummary.length > 0);
  assert.ok(s.playstyleExplanation.length > 0);
  assert.ok(s.basicExplanation.length > 0);
  assert.ok(s.meterBehavior.length > 0);
  assert.ok(s.strengths.length >= 2);
  assert.equal(s.pressures.length, 2);
  assert.ok(s.buildDirectionTags.length >= 3 && s.buildDirectionTags.length <= 5);
  assert.ok(s.firstUseBrief.coreLoop.length > 0);
  assert.ok(s.firstUseBrief.doThis.length > 0);
  assert.ok(s.firstUseBrief.avoidThis.length > 0);
  assert.ok(s.firstUseBrief.watchThis.length > 0);
  assert.ok(s.firstUseBrief.buildToward.length > 0);
  assert.equal(s.tutorialCompletionKey, weaponTutorialCompletionKey(id));
  assert.ok(!/VOID_AMMO|APEX_TRIGGER|Rift Conduit|Curse Needle/i.test(JSON.stringify(s)));
  if (s.id === 'envoy-echo-lantern') {
    assert.ok(s.buildDirectionTags.includes('Rot'));
    assert.ok(s.loopCueTag.includes('ROT'));
    assert.equal(s.isStarter, true);
  }
  if (s.id === 'envoy-null-conduit') {
    assert.ok(s.buildDirectionTags.includes('Clean Cycle'));
    assert.ok(s.loopCueTag.includes('CLEAN'));
    assert.equal(s.isStarter, false);
  }
  for (const row of [...s.strengths, ...s.pressures]) {
    assert.ok(row.mechanicalSource.length > 0, `${id} missing mechanicalSource`);
  }
  for (const abilityId of s.recommendedAbilityIds) {
    const profile = getWeaponLoadoutRecommendationProfile(id);
    assert.ok(
      profile.recommendations.some((r) => r.abilityId === abilityId),
      `${id} recommends unknown ${abilityId}`,
    );
  }
}

assert.deepEqual(assertNoRetiredIdsInPlayerFacing(), []);
assert.deepEqual(siblingsAreDistinct(summaries), []);

// Starters framed as complete
for (const classId of ['AEGIS', 'HEX_SHOT', 'ENVOY'] as const) {
  const starter = STARTER_WEAPON_BY_CLASS[classId];
  const s = getWeaponPlayerFacingSummary(starter);
  assert.equal(s.isStarter, true);
  assert.ok(s.starterFraming && /complete|flexible/i.test(s.starterFraming));
  assert.ok(!/beginner|temporary|obsolete|starter only/i.test(s.playstyleExplanation));
}

assert.equal(inspectWeaponPlayerFacing('not-a-weapon'), null);
assert.ok(inspectWeaponPlayerFacing('aegis-runed-longsword'));

// --- RIOT_VANGUARD legacy-only compatibility ---
assert.equal(canonicalizeEncounterEnemyKey('RIOT_VANGUARD'), 'ECHOING_BRUTE');
assert.equal(playerFacingEnemyDisplayName('RIOT_VANGUARD'), 'ECHOING BRUTE');
assert.equal(playerFacingEnemyDisplayName('ECHOING_BRUTE'), 'ECHOING BRUTE');
assert.ok(isLegacyEnemyAliasKey('RIOT_VANGUARD'));
assert.ok(!allDefinedEnemyKeys().includes('RIOT_VANGUARD' as never));
assert.ok(allDefinedEnemyKeys().includes('ECHOING_BRUTE'));
assert.equal(allDefinedEnemyKeys().length, 51);
const facingKeys = listPlayerFacingEnemyKeys([...allDefinedEnemyKeys(), 'RIOT_VANGUARD']);
assert.ok(!facingKeys.includes('RIOT_VANGUARD' as never));
assert.ok(facingKeys.includes('ECHOING_BRUTE'));
assert.ok(!listLiveEnemyAudit().some((e) => String(e.id) === 'RIOT_VANGUARD'));
assert.equal(listLiveEnemyAudit().filter((e) => e.id === 'ECHOING_BRUTE').length, 1);
assert.equal(listLiveEnemyAudit().length, 51);

// --- Recommendation rendering is inert ---
const beforeDrawback = JSON.stringify(WEAPON_DRAWBACK_RECORDS['hex-pulse-rifle']);
const guidance = resolveAbilityGuidanceForWeapon('hex-pulse-rifle', 'SHRAPNEL_BLOOM' as never)
  ?? resolveAbilityGuidanceForWeapon(
    'hex-pulse-rifle',
    getWeaponLoadoutRecommendationProfile('hex-pulse-rifle').recommendations[1]!.abilityId,
  );
assert.ok(guidance === null || guidance.label.length > 0);
assert.equal(JSON.stringify(WEAPON_DRAWBACK_RECORDS['hex-pulse-rifle']), beforeDrawback);

// --- Sector notes ---
for (const weaponId of ALL_WEAPON_FAMILY_IDS) {
  const missing = resolveWeaponSectorPressureNote(weaponId, null, 1);
  assert.ok(missing.fallbackNeutral.length > 0);
  assert.equal(missing.advantage, null);
  for (const sectorId of ALL_SECTOR_IDS) {
    const note = resolveWeaponSectorPressureNote(weaponId, sectorId, 1);
    assert.ok(!/FAVORABLE|STRAINED|NONVIABLE|RIOT_VANGUARD|favorable-share/i.test(
      `${note.advantage ?? ''} ${note.pressure ?? ''} ${note.preparation ?? ''}`,
    ));
    // No exact enemy IDs in player notes
    assert.ok(!/ECHOING_BRUTE|FRACTURE_HOUND|_[A-Z]{3,}/.test(
      `${note.advantage ?? ''} ${note.pressure ?? ''}`,
    ));
  }
}

// --- Tutorial persistence ---
assert.deepEqual(normalizeWeaponBriefAcknowledged(undefined), []);
assert.deepEqual(normalizeWeaponBriefAcknowledged({}), []);
assert.deepEqual(normalizeWeaponBriefAcknowledged(['bad', 'aegis-runed-longsword']), ['aegis-runed-longsword']);
assert.equal(hasWeaponBriefAcknowledged(undefined, 'aegis-runed-longsword'), false);
const ack = withWeaponBriefAcknowledged([], 'aegis-rift-edge');
assert.ok(hasWeaponBriefAcknowledged(ack, 'aegis-rift-edge'));
const ack2 = withWeaponBriefAcknowledged(ack, 'aegis-rift-edge');
assert.equal(ack2.filter((id) => id === 'aegis-rift-edge').length, 1);
// Survives "new run" conceptually — acknowledgement is account-scoped, not cleared by re-normalize empty
assert.ok(hasWeaponBriefAcknowledged(normalizeWeaponBriefAcknowledged(ack2), 'aegis-rift-edge'));

// --- Combat callouts ---
const riftArmed = resolveWeaponCombatCallouts({
  weaponFamilyId: 'aegis-rift-edge',
  operativeClass: 'AEGIS',
  abyssalReserve: 40,
  riftEdgeTempoArmed: true,
});
assert.ok(riftArmed.some((c) => c.label.includes('OCCULT RIDER ARMED')));

const claymore = resolveWeaponCombatCallouts({
  weaponFamilyId: 'aegis-claymore-blade',
  operativeClass: 'AEGIS',
  stamina: 10,
  maxStamina: 100,
  claymoreStaminaCommitted: true,
});
assert.ok(claymore.some((c) => /STAMINA|CASHOUT/i.test(c.label)));

const sidearm = resolveWeaponCombatCallouts({
  weaponFamilyId: 'hex-silver-core-sidearm',
  operativeClass: 'HEX_SHOT',
  currentAmmo: 4,
  maxAmmo: 6,
  hexProtocolCharges: 2,
  hexMaxProtocolCharges: 3,
  perfectReloadWindow: true,
  zeroProtocolReady: true,
});
assert.ok(sidearm.some((c) => c.label.includes('PERFECT RELOAD')));
assert.ok(sidearm.some((c) => c.label.includes('PROTOCOL')));

const pulse = resolveWeaponCombatCallouts({
  weaponFamilyId: 'hex-pulse-rifle',
  operativeClass: 'HEX_SHOT',
  currentAmmo: 2,
  maxAmmo: 4,
  pulseSpreadSecondaryCount: 0,
});
assert.ok(pulse.some((c) => /PRIMARY ONLY/i.test(c.label)));

const conduit = resolveWeaponCombatCallouts({
  weaponFamilyId: 'envoy-null-conduit',
  operativeClass: 'ENVOY',
  veilFlux: 50,
  previousCatalyst: 'NULL',
  cleanCatalystCycleReady: true,
});
assert.ok(conduit.some((c) => /CLEAN CYCLE READY/i.test(c.label)));

const lantern = resolveWeaponCombatCallouts({
  weaponFamilyId: 'envoy-echo-lantern',
  operativeClass: 'ENVOY',
  veilRotStacksTotal: 3,
  lanternDetonationReady: true,
});
assert.ok(lantern.some((c) => /DETONATION READY/i.test(c.label)));

const prismBlocked = resolveWeaponCombatCallouts({
  weaponFamilyId: 'envoy-sanguine-prism',
  operativeClass: 'ENVOY',
  veilFlux: 20,
  prismSacrificePreview: 8,
  prismCanPayFullSacrifice: false,
});
assert.ok(prismBlocked.some((c) => /PARTIAL PAY|UNAVAILABLE/i.test(c.label)));
assert.ok(!prismBlocked.some((c) => /SACRIFICE READY/i.test(c.label)));

const prismReady = resolveWeaponCombatCallouts({
  weaponFamilyId: 'envoy-sanguine-prism',
  operativeClass: 'ENVOY',
  veilFlux: 20,
  prismSacrificePreview: 8,
  prismCanPayFullSacrifice: true,
});
assert.ok(prismReady.some((c) => /SACRIFICE READY/i.test(c.label)));

// Inspect helpers do not invent retired weapon IDs
assert.equal(isWeaponFamilyId('hex-pulse-rifle'), true);
assert.equal(isWeaponFamilyId('ash-shotgun'), false);

// --- First-use trigger semantics ---
{
  const id = 'aegis-rift-edge' as const;
  assert.equal(shouldOpenWeaponFirstUseBrief({
    familyId: id, unlocked: true, acknowledged: [], interaction: 'explicit-select',
  }), true);
  assert.equal(shouldOpenWeaponFirstUseBrief({
    familyId: id, unlocked: true, acknowledged: [], interaction: 'explicit-equip',
  }), true);
  assert.equal(shouldOpenWeaponFirstUseBrief({
    familyId: id, unlocked: true, acknowledged: [], interaction: 'silent',
  }), false);
  assert.equal(shouldOpenWeaponFirstUseBrief({
    familyId: id, unlocked: true, acknowledged: [], interaction: 'hover',
  }), false);
  assert.equal(shouldOpenWeaponFirstUseBrief({
    familyId: id, unlocked: true, acknowledged: [], interaction: 'focus',
  }), false);
  assert.equal(shouldOpenWeaponFirstUseBrief({
    familyId: id, unlocked: false, acknowledged: [], interaction: 'locked-browse',
  }), false);
  assert.equal(shouldOpenWeaponFirstUseBrief({
    familyId: id, unlocked: true, acknowledged: [], interaction: 'combat',
  }), false);
  assert.equal(shouldOpenWeaponFirstUseBrief({
    familyId: id, unlocked: true, acknowledged: [id], interaction: 'explicit-select',
  }), false);
  // Duplicate prevention within one interaction (select then equip)
  assert.equal(shouldOpenWeaponFirstUseBrief({
    familyId: id, unlocked: true, acknowledged: [], interaction: 'explicit-equip',
    pendingFirstUseFamilyId: id,
  }), false);
}

// --- Read-only rendering proofs ---
{
  const beforeMatchups = JSON.stringify(listWeaponEnemyMatchups().map((r) => r.key));
  const beforeSectors = JSON.stringify(listWeaponSectorMatchups().map((r) => r.key));
  const beforeDrawbacks = JSON.stringify(WEAPON_DRAWBACK_RECORDS);
  const beforeRank = CLASS_RANK_MAX;
  const beforeBrief = normalizeWeaponBriefAcknowledged(undefined);

  // Inspect / render paths
  for (const id of ALL_WEAPON_FAMILY_IDS) {
    inspectWeaponPlayerFacing(id);
    getWeaponPlayerFacingSummary(id);
    resolveWeaponSectorPressureNote(id, ALL_SECTOR_IDS[0], 1);
    resolveAbilityGuidanceForWeapon(id, getWeaponLoadoutRecommendationProfile(id).recommendations[0]!.abilityId);
    resolveWeaponCombatCallouts({
      weaponFamilyId: id,
      operativeClass: getWeaponPlayerFacingSummary(id).classId,
      veilFlux: PRISM_BRINK_FLUX_THRESHOLD,
      prismCanPayFullSacrifice: false,
      prismSacrificePreview: 8,
    });
  }
  getWeaponEnemyMatchup('aegis-runed-longsword', 'RIOT_VANGUARD');

  assert.equal(JSON.stringify(listWeaponEnemyMatchups().map((r) => r.key)), beforeMatchups);
  assert.equal(JSON.stringify(listWeaponSectorMatchups().map((r) => r.key)), beforeSectors);
  assert.equal(JSON.stringify(WEAPON_DRAWBACK_RECORDS), beforeDrawbacks);
  assert.equal(CLASS_RANK_MAX, beforeRank);
  assert.deepEqual(normalizeWeaponBriefAcknowledged(undefined), beforeBrief);
  assert.equal(hasWeaponBriefAcknowledged(undefined, 'aegis-runed-longsword'), false);
  assert.equal(listWeaponEnemyMatchups().length, 9 * 51);
  assert.equal(listWeaponSectorMatchups().length, 135);
  assert.ok(!listWeaponEnemyMatchups().some((r) => String(r.enemyId) === 'RIOT_VANGUARD'));
}

// --- Older-save + run-lifecycle brief persistence ---
{
  // Missing field ⇒ unacknowledged (older saves)
  assert.deepEqual(normalizeWeaponBriefAcknowledged(undefined), []);
  assert.equal(hasWeaponBriefAcknowledged(undefined, 'hex-void-cannon'), false);

  const acknowledged = withWeaponBriefAcknowledged(
    withWeaponBriefAcknowledged([], 'aegis-runed-longsword'),
    'hex-silver-core-sidearm',
  );

  // Run-scoped ActiveIncursion never owns brief flags
  const runState = createDefaultActiveIncursionState();
  assert.equal(Object.prototype.hasOwnProperty.call(runState, 'weaponBriefAcknowledged'), false);

  // Weapon unlock / progression patches do not carry brief fields (cannot wipe by spread)
  const unlockPatch = unlockAllWeapons();
  assert.equal(Object.prototype.hasOwnProperty.call(unlockPatch, 'weaponBriefAcknowledged'), false);
  const progressionReset = createDefaultWeaponProgression();
  assert.equal(Object.prototype.hasOwnProperty.call(progressionReset, 'weaponBriefAcknowledged'), false);

  // Simulated account after extraction / death / deployment cleanup / new-run init:
  // only ActiveIncursion + progression patches apply — brief list remains.
  const accountAfterRunLifecycle = {
    weaponBriefAcknowledged: acknowledged,
    ...unlockPatch,
  };
  assert.deepEqual(
    normalizeWeaponBriefAcknowledged(accountAfterRunLifecycle.weaponBriefAcknowledged),
    acknowledged,
  );

  // VIEW BRIEF reopen path: acknowledged weapons must not re-enter first-use trigger
  assert.equal(shouldOpenWeaponFirstUseBrief({
    familyId: 'aegis-runed-longsword',
    unlocked: true,
    acknowledged,
    interaction: 'explicit-select',
  }), false);
  // Reopen is UI mode only — acknowledgement list unchanged by a second withWeaponBrief call
  const afterReopenAck = withWeaponBriefAcknowledged(acknowledged, 'aegis-runed-longsword');
  assert.deepEqual(afterReopenAck, acknowledged);
}

// --- Inspection does not alter equipped weapon / loadout recommendation data ---
{
  const progression = createDefaultWeaponProgression();
  const beforeEquip = getEquippedWeaponForClass(progression, 'AEGIS');
  const beforeProfile = JSON.stringify(getWeaponLoadoutRecommendationProfile('aegis-runed-longsword'));
  inspectWeaponPlayerFacing('aegis-runed-longsword');
  resolveAbilityGuidanceForWeapon('aegis-runed-longsword', 'DEMONS_LUNG');
  assert.equal(getEquippedWeaponForClass(progression, 'AEGIS'), beforeEquip);
  assert.equal(JSON.stringify(getWeaponLoadoutRecommendationProfile('aegis-runed-longsword')), beforeProfile);
}

// --- All nine HUD callout models from representative live state ---
{
  const longsword = resolveWeaponCombatCallouts({
    weaponFamilyId: 'aegis-runed-longsword',
    operativeClass: 'AEGIS',
    abyssalReserve: 42,
  });
  assert.ok(longsword.some((c) => c.id === 'aegis-reserve'));

  const riftCold = resolveWeaponCombatCallouts({
    weaponFamilyId: 'aegis-rift-edge',
    operativeClass: 'AEGIS',
    riftEdgeTempoArmed: false,
  });
  const riftHot = resolveWeaponCombatCallouts({
    weaponFamilyId: 'aegis-rift-edge',
    operativeClass: 'AEGIS',
    riftEdgeTempoArmed: true,
  });
  assert.ok(riftCold.some((c) => /TEMPO COLD/i.test(c.label)));
  assert.ok(riftHot.some((c) => /OCCULT RIDER ARMED/i.test(c.label)));

  const claymore = resolveWeaponCombatCallouts({
    weaponFamilyId: 'aegis-claymore-blade',
    operativeClass: 'AEGIS',
    stamina: 8,
    maxStamina: 100,
    claymoreStaminaCommitted: true,
  });
  assert.ok(claymore.some((c) => /BREAK CASHOUT READY/i.test(c.label)));
  assert.ok(!claymore.some((c) => /STAMINA/i.test(c.label)));

  const sidearm = resolveWeaponCombatCallouts({
    weaponFamilyId: 'hex-silver-core-sidearm',
    operativeClass: 'HEX_SHOT',
    currentAmmo: 3,
    maxAmmo: 6,
    hexProtocolCharges: 1,
    hexMaxProtocolCharges: 3,
    perfectReloadWindow: true,
    zeroProtocolReady: false,
  });
  assert.ok(sidearm.some((c) => /AMMO 3\/6/i.test(c.label)));
  assert.ok(sidearm.some((c) => /PERFECT RELOAD/i.test(c.label)));
  assert.ok(sidearm.some((c) => /PROTOCOL 1\/3/i.test(c.label)));

  const nullbreach = resolveWeaponCombatCallouts({
    weaponFamilyId: 'hex-void-cannon',
    operativeClass: 'HEX_SHOT',
    currentAmmo: 1,
    maxAmmo: 3,
  });
  assert.ok(nullbreach.some((c) => /BREACH — PRIORITY TARGET/i.test(c.label)));
  assert.ok(!nullbreach.some((c) => /SPREAD|CROWD/i.test(c.label)));

  const pulseIsolated = resolveWeaponCombatCallouts({
    weaponFamilyId: 'hex-pulse-rifle',
    operativeClass: 'HEX_SHOT',
    currentAmmo: 2,
    maxAmmo: 4,
    pulseSpreadSecondaryCount: 0,
  });
  const pulseCluster = resolveWeaponCombatCallouts({
    weaponFamilyId: 'hex-pulse-rifle',
    operativeClass: 'HEX_SHOT',
    currentAmmo: 2,
    maxAmmo: 4,
    pulseSpreadSecondaryCount: 2,
  });
  assert.ok(pulseIsolated.some((c) => /PRIMARY ONLY/i.test(c.label)));
  assert.ok(!/redirect/i.test(JSON.stringify(pulseIsolated)));
  assert.ok(pulseCluster.some((c) => /SPREAD TARGETS \+2/i.test(c.label)));

  const conduit = resolveWeaponCombatCallouts({
    weaponFamilyId: 'envoy-null-conduit',
    operativeClass: 'ENVOY',
    veilFlux: 55,
    previousCatalyst: 'NULL',
    cleanCatalystCycleReady: true,
  });
  assert.ok(conduit.some((c) => /CLEAN CYCLE READY/i.test(c.label)));

  const lanternSetup = resolveWeaponCombatCallouts({
    weaponFamilyId: 'envoy-echo-lantern',
    operativeClass: 'ENVOY',
    veilRotStacksTotal: 2,
    lanternDetonationReady: false,
  });
  const lanternReady = resolveWeaponCombatCallouts({
    weaponFamilyId: 'envoy-echo-lantern',
    operativeClass: 'ENVOY',
    veilRotStacksTotal: 4,
    lanternDetonationReady: true,
  });
  assert.ok(lanternSetup.some((c) => /DETONATION SETUP/i.test(c.label)));
  assert.ok(lanternReady.some((c) => /DETONATION READY/i.test(c.label)));

  const prismCold = resolveWeaponCombatCallouts({
    weaponFamilyId: 'envoy-sanguine-prism',
    operativeClass: 'ENVOY',
    veilFlux: 40,
    prismBrinkActive: false,
    prismSacrificePreview: 8,
    prismCanPayFullSacrifice: false,
  });
  assert.ok(prismCold.some((c) => /BRINK COLD/i.test(c.label)));
  assert.ok(prismCold.some((c) => /PARTIAL PAY|UNAVAILABLE/i.test(c.label)));
  assert.ok(!prismCold.some((c) => /SACRIFICE READY/i.test(c.label)));
  assert.equal(PRISM_BRINK_FLUX_THRESHOLD, 25);
}

// Encounter registry still coherent after alias collapse
verifyEncounterCatalog();

console.log('Phase 3L OK — summaries=9 enemies=51 matchups=459 riot-legacy-only tutorials+callouts validated');
