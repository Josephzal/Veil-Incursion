import assert from 'node:assert/strict';
import {
  assertMechanicOutsideRail,
  buildCombatCommandRailModel,
} from './combatCommandRailLayout';
import { buildEnvoyCombatSurface } from './envoyCombatCompatibility';
import { buildAegisCombatSurface } from './aegisCombatCompatibility';
import { buildHexCombatSurface } from './hexCombatCompatibility';
import {
  DEFAULT_ENVOY_FLEX_LOADOUT,
  DEFAULT_HEX_FLEX_LOADOUT,
} from '../types/operativeClass';
import { DEFAULT_AEGIS_TECHNIQUE_LOADOUT } from '../types/aegisCombat';

const envoy = buildEnvoyCombatSurface({
  weaponFamilyId: 'envoy-echo-lantern',
  flex: DEFAULT_ENVOY_FLEX_LOADOUT,
});
const envoyRail = buildCombatCommandRailModel({
  loadout: envoy.hudCards,
  weaponActionCount: envoy.weaponActionCount,
  techniqueCount: envoy.flexCount,
  classMechanicSlot: 'RIFT_WARD',
});

assert.equal(envoyRail.cards.length, 7);
assert.deepEqual(
  envoyRail.cards.map((c) => c.abilityId),
  [...envoy.weaponActions, ...envoy.flex],
);
assert.equal(envoyRail.weaponActions.length, 4);
assert.equal(envoyRail.techniques.length, 3);
assert.ok(assertMechanicOutsideRail(envoyRail, ['RIFT_WARD', 'CATACLYSM_SIGIL']));
assert.ok(!envoyRail.cards.some((c) => c.abilityId === 'VEIL_SPLINTER'));
assert.ok(!envoyRail.cards.some((c) => c.abilityId === 'BLACK_WICK'));
assert.equal(envoyRail.cards.filter((c) => c.abilityId === envoy.weaponActions[0]).length, 1);

for (const familyId of [
  'envoy-echo-lantern',
  'envoy-null-conduit',
  'envoy-sanguine-prism',
] as const) {
  const surface = buildEnvoyCombatSurface({
    weaponFamilyId: familyId,
    flex: DEFAULT_ENVOY_FLEX_LOADOUT,
  });
  const rail = buildCombatCommandRailModel({
    loadout: surface.hudCards,
    weaponActionCount: 4,
    techniqueCount: 3,
    classMechanicSlot: 'RIFT_WARD',
  });
  assert.equal(rail.cards.length, 7);
  assert.deepEqual(rail.techniques, [...DEFAULT_ENVOY_FLEX_LOADOUT]);
  assert.ok(assertMechanicOutsideRail(rail, ['RIFT_WARD']));
}

const aegis = buildAegisCombatSurface({
  weaponFamilyId: 'aegis-runed-longsword',
  techniques: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
});
const aegisRail = buildCombatCommandRailModel({
  loadout: aegis.hudCards,
  weaponActionCount: 4,
  techniqueCount: 3,
  classMechanicSlot: 'PARRY',
});
assert.equal(aegisRail.cards.length, 7);
assert.deepEqual(aegisRail.cards.map((c) => c.abilityId), [...aegis.hudCards]);
assert.ok(assertMechanicOutsideRail(aegisRail, ['WRAITH_PARRY', 'PARRY']));

const hex = buildHexCombatSurface({
  weaponFamilyId: 'hex-silver-core-sidearm',
  flex: DEFAULT_HEX_FLEX_LOADOUT,
});
const hexRail = buildCombatCommandRailModel({
  loadout: hex.hudCards,
  weaponActionCount: hex.weaponActionCount,
  techniqueCount: hex.techniqueCount,
  classMechanicSlot: 'RELOAD',
});
assert.equal(hexRail.cards.length, 7);
assert.deepEqual(hexRail.cards.map((c) => c.abilityId), [...hex.hudCards]);
assert.ok(assertMechanicOutsideRail(hexRail, ['RELOAD', 'PHASE_SHIFT_RELOAD']));

console.log('combatCommandRailLayout.test.ts: ok');
