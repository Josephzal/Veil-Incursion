/**
 * Envoy Weapon-Kit Phase E.3 — registry, flex schema, normalization, derived 4+3.
 * Run: npx tsx src/data/envoyWeaponKitPhaseE3.test.ts
 */
import assert from 'node:assert/strict';
import {
  ENVOY_HEARTS_DUE_WEAPON_ACTIONS,
  ENVOY_SCYTHE_WEAPON_ACTIONS,
  ENVOY_VAMBRACE_WEAPON_ACTIONS,
} from '../types/envoyWeaponAction';
import {
  DEFAULT_ENVOY_FLEX_LOADOUT,
  DEFAULT_ENVOY_LOADOUT,
} from '../types/operativeClass';
import {
  ALL_ENVOY_WEAPON_FAMILY_IDS,
  assertEnvoyWeaponFamilyRegistryInvariant,
  deriveEnvoyWeaponActions,
  isEnvoyWeaponActionId,
  isEnvoyWeaponActionLiveExecutable,
  isEnvoyWeaponActionPlayerFacingLive,
  isEnvoyWeaponFamilyId,
  requireEnvoyWeaponActions,
} from './envoyWeaponActionRegistry';
import {
  isEnvoyWeaponActionPreviewLive,
  listEnvoyWeaponActionDefinitions,
  requireEnvoyWeaponActionDefinition,
} from './envoyWeaponActionCatalog';
import {
  countEnvoyOrderedFlexTriples,
  countEnvoyUnorderedFlexSets,
  ENVOY_FLEX_POOL,
  enumerateEnvoyOrderedFlexTriples,
  enumerateEnvoyUnorderedFlexSets,
  extractEnvoyFlexCandidates,
  isEnvoyFlexAbilityId,
  projectEnvoyLiveFourSlotDeck,
  sanitizeEnvoyFlexLoadout,
  validateEnvoyFlexLoadoutCommit,
} from './envoyFlexLoadoutEngine';
import {
  buildEnvoyCombatSurface,
  canonicalizeEnvoyCombatActionId,
  isEnvoyCombatSurfaceComplete,
  resolveEnvoyActionOneId,
} from './envoyCombatCompatibility';
import { validateEnvoyWeaponKitTotalAuthority } from './envoyWeaponKitPhaseE3Engine';
import { getAssignableEnvoyAbilities, sanitizeEnvoyCombatLoadout } from './classAbilityUnlockEngine';
import { normalizeWeaponProgression } from './weaponProgressionEngine';
import { STARTER_WEAPON_BY_CLASS, getWeaponFamily } from './weaponRegistry';
import { validateWeaponUnlockPaths } from './weaponUnlockPathEngine';
import { classAbilityTargetMode } from './combatClassTargeting';
import {
  ALL_AEGIS_WEAPON_FAMILY_IDS,
  deriveAegisWeaponActions,
} from './aegisWeaponActionRegistry';
import {
  ALL_HEX_WEAPON_FAMILY_IDS,
  requireHexWeaponActions,
} from './hexWeaponActionRegistry';
import { buildHexCombatSurface } from './hexCombatCompatibility';
import { DEFAULT_HEX_FLEX_LOADOUT } from '../types/operativeClass';

console.log('Envoy Weapon-Kit Phase E.3');

// ---------- 1–4 registry / catalog ----------
assertEnvoyWeaponFamilyRegistryInvariant();
assert.deepEqual(
  [...requireEnvoyWeaponActions('envoy-vambrace')],
  [...ENVOY_VAMBRACE_WEAPON_ACTIONS],
);
assert.deepEqual(
  [...requireEnvoyWeaponActions('envoy-scythe')],
  [...ENVOY_SCYTHE_WEAPON_ACTIONS],
);
assert.deepEqual(
  [...requireEnvoyWeaponActions('envoy-sanguine-prism')],
  [...ENVOY_HEARTS_DUE_WEAPON_ACTIONS],
);
assert.equal(listEnvoyWeaponActionDefinitions().length, 12);
assert.throws(() => requireEnvoyWeaponActions('aegis-longsword' as never));
assert.throws(() => requireEnvoyWeaponActions(null));
assert.equal(deriveEnvoyWeaponActions('hex-carbine'), null);
assert.equal(isEnvoyWeaponFamilyId('envoy-vambrace'), true);

for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
  const actions = requireEnvoyWeaponActions(familyId);
  actions.forEach((id, i) => {
    const def = requireEnvoyWeaponActionDefinition(id);
    assert.equal(def.familyId, familyId);
    assert.equal(def.order, i + 1);
    assert.equal(def.category, 'ENVOY_WEAPON_ACTION');
    assert.equal(def.previewDispatchId, id);
    assert.equal(def.provenanceId, id);
    assert.equal(def.executorUnavailable, false);
    assert.equal(isEnvoyWeaponActionLiveExecutable(familyId, id), true);
    assert.equal(isEnvoyWeaponActionPreviewLive(id), true);
    if (i === 0) {
      assert.equal(def.executorDispatch, 'LIVE_ANCHOR_BASIC');
    } else {
      assert.equal(def.executorDispatch, 'ENVOY_WA_EXECUTOR');
    }
  });
}

const totalIssues = validateEnvoyWeaponKitTotalAuthority();
assert.deepEqual(totalIssues, [], totalIssues.map((i) => i.message).join('; '));

// ---------- 5–6 flex pool / default ----------
assert.equal(ENVOY_FLEX_POOL.length, 11);
assert.deepEqual([...getAssignableEnvoyAbilities()].sort(), [...ENVOY_FLEX_POOL].sort());
assert.deepEqual([...DEFAULT_ENVOY_FLEX_LOADOUT], ['ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM']);
assert.equal(validateEnvoyFlexLoadoutCommit([...DEFAULT_ENVOY_FLEX_LOADOUT]), null);

// ---------- 7 combinatorics ----------
assert.equal(countEnvoyUnorderedFlexSets(), 165);
assert.equal(countEnvoyOrderedFlexTriples(), 990);
assert.equal(enumerateEnvoyUnorderedFlexSets().length, 165);
assert.equal(enumerateEnvoyOrderedFlexTriples().length, 990);

// ---------- 8–12 normalization ----------
const fourSlot = ['VEIL_SPLINTER', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'] as const;
assert.deepEqual([...sanitizeEnvoyFlexLoadout(fourSlot)], [...DEFAULT_ENVOY_FLEX_LOADOUT]);
assert.deepEqual(
  [...sanitizeEnvoyFlexLoadout(['ASTRAL_LANCE', 'FLUX_PURGE', 'MIND_SUNDER'])],
  ['ASTRAL_LANCE', 'FLUX_PURGE', 'MIND_SUNDER'],
);
assert.deepEqual(
  [...sanitizeEnvoyFlexLoadout(['SPATIAL_COLLAPSE', 'GRAVITY_WELL', 'PHASE_STEP'])],
  ['NECROTIC_BLOOM', 'PARALYTIC_MIASMA', 'PHASE_STEP'],
);
assert.deepEqual(
  [...sanitizeEnvoyFlexLoadout(['BLACK_WICK', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'FLESH_WARP'])],
  ['ASTRAL_LANCE', 'ENTROPY_HEX', 'FLESH_WARP'],
);
assert.deepEqual(
  [...sanitizeEnvoyFlexLoadout(['NULL_ARC', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'])],
  ['ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
);
assert.deepEqual(
  [...sanitizeEnvoyFlexLoadout(['BLOOD_REFRACTION', 'FLUX_PURGE', 'SOUL_TETHER', 'MIND_SUNDER'])],
  ['FLUX_PURGE', 'SOUL_TETHER', 'MIND_SUNDER'],
);
assert.deepEqual(
  [...sanitizeEnvoyFlexLoadout(['ASTRAL_LANCE', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'])],
  ['ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
);
assert.deepEqual(
  [...sanitizeEnvoyFlexLoadout(['RIFT_WARD', 'CATACLYSM_SIGIL', 'GRAVE_TRANSFER', 'UNKNOWN_X'])],
  [...DEFAULT_ENVOY_FLEX_LOADOUT],
);
assert.deepEqual([...sanitizeEnvoyFlexLoadout([])], [...DEFAULT_ENVOY_FLEX_LOADOUT]);
assert.deepEqual([...sanitizeEnvoyFlexLoadout(null)], [...DEFAULT_ENVOY_FLEX_LOADOUT]);
assert.deepEqual(
  [...sanitizeEnvoyFlexLoadout(['ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM', 'FLUX_PURGE', 'PHASE_STEP'])],
  ['ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
);
assert.deepEqual(
  [...sanitizeEnvoyFlexLoadout(['ASTRAL_LANCE', 'VEIL_SPLINTER', 'ENTROPY_HEX', 'NECROTIC_BLOOM'])],
  ['ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
);
assert.deepEqual(
  [...sanitizeEnvoyFlexLoadout(['STRIKE', 'QUICKDRAW', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'FLESH_WARP'])],
  ['ASTRAL_LANCE', 'ENTROPY_HEX', 'FLESH_WARP'],
);

// Pure / idempotent / no mutation
const frozen = Object.freeze(['VEIL_SPLINTER', 'FLUX_PURGE', 'SOUL_TETHER', 'MIND_SUNDER'] as const);
const before = [...frozen];
const once = sanitizeEnvoyFlexLoadout(frozen);
const twice = sanitizeEnvoyFlexLoadout(once);
assert.deepEqual([...once], [...twice]);
assert.deepEqual([...frozen], before);
assert.deepEqual(
  [...sanitizeEnvoyCombatLoadout(frozen)],
  ['FLUX_PURGE', 'SOUL_TETHER', 'MIND_SUNDER'],
);
assert.deepEqual(
  [...projectEnvoyLiveFourSlotDeck(once)],
  ['VEIL_SPLINTER', 'FLUX_PURGE', 'SOUL_TETHER', 'MIND_SUNDER'],
);
assert.deepEqual([...DEFAULT_ENVOY_LOADOUT], [...DEFAULT_ENVOY_FLEX_LOADOUT]);

// Family does not alter flex
const flexA = sanitizeEnvoyFlexLoadout(['DIMENSIONAL_SHEAR', 'PHASE_STEP', 'FLESH_WARP']);
const surfaceV = buildEnvoyCombatSurface({
  weaponFamilyId: 'envoy-vambrace',
  flex: flexA,
});
const surfaceS = buildEnvoyCombatSurface({
  weaponFamilyId: 'envoy-scythe',
  flex: flexA,
});
assert.deepEqual([...surfaceV.flex], [...flexA]);
assert.deepEqual([...surfaceS.flex], [...flexA]);
assert.notDeepEqual([...surfaceV.weaponActions], [...surfaceS.weaponActions]);

// ---------- 13–15 derived surfaces ----------
for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
  const surface = buildEnvoyCombatSurface({
    weaponFamilyId: familyId,
    flex: DEFAULT_ENVOY_FLEX_LOADOUT,
  });
  assert.ok(isEnvoyCombatSurfaceComplete(surface));
  assert.equal(surface.hudCards.length, 7);
  assert.equal(new Set(surface.hudCards).size, 7);
  assert.ok(!surface.hudCards.includes('VEIL_SPLINTER'));
  assert.ok(!surface.hudCards.includes('RIFT_WARD'));
  assert.ok(!surface.hudCards.includes('CATACLYSM_SIGIL'));
  assert.ok(!surface.hudCards.includes('NULL_CIRCUIT'));
  assert.ok(!surface.hudCards.includes('FUNERAL_KNOT'));
  assert.ok(!surface.hudCards.includes('CRIMSON_REFRACTION'));
  assert.deepEqual([...surface.hudCards.slice(4)], [...DEFAULT_ENVOY_FLEX_LOADOUT]);
  assert.equal(surface.liveExecutableIds.length, 4);
}
assert.throws(() =>
  buildEnvoyCombatSurface({ weaponFamilyId: 'aegis-longsword', flex: DEFAULT_ENVOY_FLEX_LOADOUT }),
);

// Compatibility
assert.equal(
  canonicalizeEnvoyCombatActionId('VEIL_SPLINTER', 'envoy-vambrace').canonicalId,
  'GRAVEWEAVE',
);
assert.equal(
  canonicalizeEnvoyCombatActionId('VEIL_SPLINTER', 'envoy-scythe').canonicalId,
  'NULL_ARC',
);
assert.equal(
  canonicalizeEnvoyCombatActionId('BLACK_WICK', 'envoy-vambrace').canonicalId,
  'GRAVEWEAVE',
);
assert.equal(
  canonicalizeEnvoyCombatActionId('CATACLYSM_SIGIL', 'envoy-scythe').kind,
  'ULTIMATE_COMPAT',
);
assert.equal(resolveEnvoyActionOneId('envoy-sanguine-prism'), 'BLOOD_REFRACTION');
assert.equal(isEnvoyWeaponActionId('CATACLYSM_SIGIL'), false);
assert.equal(isEnvoyFlexAbilityId('GRAVEWEAVE'), false);

// Targeting structural recognition
assert.equal(classAbilityTargetMode('ENVOY', 'GRAVE_TRANSFER'), 'DUAL');
assert.equal(classAbilityTargetMode('ENVOY', 'CRIMSON_VENT'), 'NONE');
assert.equal(classAbilityTargetMode('ENVOY', 'VEIL_SPLINTER'), 'SINGLE');

// ---------- 16–18 ownership / unlock unchanged ----------
assert.equal(STARTER_WEAPON_BY_CLASS.ENVOY, 'envoy-vambrace');
assert.equal(getWeaponFamily('envoy-vambrace').unlockRequirement.length, 0);
assert.ok(getWeaponFamily('envoy-scythe').unlockRequirement.length > 0);
assert.deepEqual(validateWeaponUnlockPaths(), []);
const migrated = normalizeWeaponProgression({
  weaponUnlocks: ['envoy-scythe'],
  weaponTiers: { 'envoy-scythe': 2 },
  equippedWeaponByClass: { ENVOY: 'envoy-scythe' },
} as Parameters<typeof normalizeWeaponProgression>[0]);
assert.ok(migrated.weaponUnlocks.includes('envoy-vambrace'));
assert.ok(migrated.weaponUnlocks.includes('envoy-scythe'));
assert.equal(migrated.equippedWeaponByClass.ENVOY, 'envoy-scythe');
assert.equal('weaponTiers' in migrated, false);

// Active-incursion style: 4-slot snapshot remains readable → flex extract
const incSnapshot = ['VEIL_SPLINTER', 'DIMENSIONAL_SHEAR', 'SOUL_TETHER', 'MIND_SUNDER'] as const;
assert.deepEqual(
  [...extractEnvoyFlexCandidates(incSnapshot)],
  ['DIMENSIONAL_SHEAR', 'SOUL_TETHER', 'MIND_SUNDER'],
);
assert.deepEqual(
  [...sanitizeEnvoyCombatLoadout(incSnapshot)],
  ['DIMENSIONAL_SHEAR', 'SOUL_TETHER', 'MIND_SUNDER'],
);

// ---------- 19 Actions 2–4 player-facing after E.5 ----------
for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
  const [a1, a2, a3, a4] = requireEnvoyWeaponActions(familyId);
  assert.equal(isEnvoyWeaponActionLiveExecutable(familyId, a2!), true);
  assert.equal(isEnvoyWeaponActionPlayerFacingLive(familyId, a1!), true);
  assert.equal(isEnvoyWeaponActionPlayerFacingLive(familyId, a2!), true);
  assert.equal(isEnvoyWeaponActionPlayerFacingLive(familyId, a3!), true);
  assert.equal(isEnvoyWeaponActionPlayerFacingLive(familyId, a4!), true);
}

// ---------- 20 Aegis / Hex containment ----------
for (const id of ALL_AEGIS_WEAPON_FAMILY_IDS) {
  assert.ok(deriveAegisWeaponActions(id)?.length === 4);
}
for (const id of ALL_HEX_WEAPON_FAMILY_IDS) {
  assert.equal(requireHexWeaponActions(id).length, 4);
}
const hexSurface = buildHexCombatSurface({
  weaponFamilyId: 'hex-revolver',
  flex: DEFAULT_HEX_FLEX_LOADOUT,
});
assert.equal(hexSurface.hudCards.length, 7);

console.log('Envoy Weapon-Kit Phase E.3 OK');
