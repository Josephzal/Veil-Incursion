import assert from 'node:assert/strict';
import { DEFAULT_AEGIS_TECHNIQUE_LOADOUT } from '../types/aegisCombat';
import {
  DEFAULT_ENVOY_FLEX_LOADOUT,
  DEFAULT_HEX_FLEX_LOADOUT,
} from '../types/operativeClass';
import type { RunStatusEffect } from '../types/narrativeProcedural';
import { buildLoadoutTagLayers } from './boonOffer/boonOfferContext';
import { validateSanctuaryGraftApplication } from './graftSynergy/permanentGraftLoadoutEngine';
import { getUniversalGraftForAction } from './universalGraftRegistry';
import {
  buildDeterministicSanctuaryGraftOffers,
  buildSanctuaryGraftSurface,
  resolveSanctuaryAttune,
  resolveSanctuaryOfferTarget,
  resolveSanctuaryStabilization,
  sanitizeSanctuaryGraftMap,
  sanctuaryVisitId,
} from './sanctuaryFlowEngine';

console.log('Stage V — Sanctuary graft flow');

const minorLow: RunStatusEffect = {
  id: 'minor-low',
  label: 'Minor Low',
  description: 'test',
  source: 'HAZARD',
  sanctuaryAilment: { severity: 'MINOR', priority: 10, removable: true },
};
const minorHigh: RunStatusEffect = {
  id: 'minor-high',
  label: 'Minor High',
  description: 'test',
  source: 'ENVIRONMENT',
  sanctuaryAilment: { severity: 'MINOR', priority: 90, removable: true },
};
const ordinary: RunStatusEffect = {
  id: 'ordinary',
  label: 'Ordinary',
  description: 'test',
  source: 'HAZARD',
  sanctuaryAilment: { severity: 'ORDINARY', priority: 50, removable: true },
};
const major: RunStatusEffect = {
  id: 'major',
  label: 'Major',
  description: 'test',
  source: 'HAZARD',
  sanctuaryAilment: { severity: 'MAJOR', priority: 100, removable: true },
};

const stabilized = resolveSanctuaryStabilization({
  currentHp: 93,
  maxHp: 100,
  statusEffects: [minorHigh],
  alreadyApplied: false,
});
assert.equal(stabilized.currentHp, 100);
assert.equal(stabilized.healed, 7);
assert.equal(stabilized.statusEffects.length, 1);
const repeated = resolveSanctuaryStabilization({
  currentHp: stabilized.currentHp,
  maxHp: 100,
  statusEffects: stabilized.statusEffects,
  alreadyApplied: true,
});
assert.equal(repeated.applied, false);
assert.equal(repeated.healed, 0);

const fullHpStabilization = resolveSanctuaryStabilization({
  currentHp: 100,
  maxHp: 100,
  statusEffects: [minorLow, major, minorHigh],
  alreadyApplied: false,
});
assert.equal(fullHpStabilization.cleansedEffectId, 'minor-high');
assert.deepEqual(
  fullHpStabilization.statusEffects.map((effect) => effect.id),
  ['minor-low', 'major'],
);

const attuned = resolveSanctuaryAttune({
  currentHp: 40,
  maxHp: 100,
  healReceivedMultiplier: 1.5,
  statusEffects: [minorLow, ordinary, major],
});
assert.equal(attuned.currentHp, 85);
assert.deepEqual(attuned.cleansedEffectIds, ['minor-low', 'ordinary']);
assert.deepEqual(attuned.statusEffects.map((effect) => effect.id), ['major']);
assert.equal(resolveSanctuaryAttune({
  currentHp: 95,
  maxHp: 100,
  healReceivedMultiplier: 1,
  statusEffects: [],
}).currentHp, 100);

const surfaces = [
  buildSanctuaryGraftSurface({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-longsword',
    aegisTechniques: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
    hexFlex: DEFAULT_HEX_FLEX_LOADOUT,
    envoyFlex: DEFAULT_ENVOY_FLEX_LOADOUT,
  }),
  buildSanctuaryGraftSurface({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-revolver',
    aegisTechniques: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
    hexFlex: DEFAULT_HEX_FLEX_LOADOUT,
    envoyFlex: DEFAULT_ENVOY_FLEX_LOADOUT,
  }),
  buildSanctuaryGraftSurface({
    classId: 'ENVOY',
    weaponFamilyId: 'envoy-vambrace',
    aegisTechniques: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
    hexFlex: DEFAULT_HEX_FLEX_LOADOUT,
    envoyFlex: DEFAULT_ENVOY_FLEX_LOADOUT,
  }),
];
surfaces.forEach((surface) => {
  assert.equal(surface.length, 7);
  assert.equal(new Set(surface.map((row) => row.key)).size, 7);
  assert.equal(surface.filter((row) => row.group === 'WEAPON_ACTION').length, 4);
  assert.equal(surface.filter((row) => row.group === 'TECHNIQUE').length, 3);
});
(['AEGIS', 'HEX_SHOT', 'ENVOY'] as const).forEach((classId, index) => {
  const classOffers = buildDeterministicSanctuaryGraftOffers({
    classId,
    seed: 'shared-sanctuary-seed',
    runDepthBand: 1,
    surface: surfaces[index],
    currentMap: {},
  });
  assert.equal(classOffers.length, 3, `${classId} did not receive exactly three offers`);
  assert.equal(new Set(classOffers).size, 3);
});

const visitId = sanctuaryVisitId({ currentNodeId: 'sanctuary-14', nodesCleared: 13, currentDistrict: 1 });
const aegisSurface = surfaces[0];
const offers = buildDeterministicSanctuaryGraftOffers({
  classId: 'AEGIS',
  seed: visitId,
  runDepthBand: 1,
  surface: aegisSurface,
  currentMap: {},
});
assert.equal(offers.length, 3);
assert.equal(new Set(offers).size, 3);
assert.deepEqual(offers, buildDeterministicSanctuaryGraftOffers({
  classId: 'AEGIS',
  seed: visitId,
  runDepthBand: 1,
  surface: aegisSurface,
  currentMap: {},
}));

const target = resolveSanctuaryOfferTarget('AEGIS', aegisSurface, offers[0])!;
const accepted = validateSanctuaryGraftApplication({
  classId: 'AEGIS',
  abilityId: target.key,
  graftId: offers[0],
  runDepthBand: 1,
  currentMap: {},
  sanctuarySessionActive: true,
  sanctuaryServiceConsumed: false,
  sanctuaryOffers: offers,
  eligibleAbilityIds: aegisSurface.map((row) => row.key),
  aegisSurface: {
    weaponFamilyId: 'aegis-longsword',
    techniques: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  },
});
assert.equal(accepted.ok, true);
assert.equal(Object.keys(accepted.proposedMap).length, 1);
const blockedRepeat = validateSanctuaryGraftApplication({
  classId: 'AEGIS',
  abilityId: target.key,
  graftId: offers[1],
  runDepthBand: 1,
  currentMap: accepted.proposedMap,
  sanctuarySessionActive: true,
  sanctuaryServiceConsumed: true,
  sanctuaryOffers: offers,
  eligibleAbilityIds: aegisSurface.map((row) => row.key),
});
assert.equal(blockedRepeat.ok, false);
const blockedUnequipped = validateSanctuaryGraftApplication({
  classId: 'AEGIS',
  abilityId: 'TECH:EVISCERATE',
  graftId: offers[0],
  runDepthBand: 1,
  currentMap: {},
  sanctuarySessionActive: true,
  sanctuaryOffers: offers,
  eligibleAbilityIds: aegisSurface.map((row) => row.key),
});
assert.equal(blockedUnequipped.ok, false);

assert.deepEqual(
  sanitizeSanctuaryGraftMap(
    { [target.key]: offers[0], 'TECH:EVISCERATE': offers[1] },
    aegisSurface,
  ),
  { [target.key]: offers[0] },
);

const equippedActions = aegisSurface.map((row) => row.actionId);
const ruptureLayers = buildLoadoutTagLayers({
  classId: 'AEGIS',
  weaponFamilyId: 'aegis-longsword',
  equippedAbilityIds: equippedActions,
  abilityGrafts: {
    'WA:RUPTURE': getUniversalGraftForAction('AEGIS', 'RUPTURE')!.id,
  },
});
assert.deepEqual(ruptureLayers.graftAddedTags, []);
assert.deepEqual(ruptureLayers.graftRemovedTags, []);

console.log('Stage V Sanctuary graft flow passed.');
