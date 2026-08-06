/**
 * Envoy Weapon-Kit Phase E.5 — live 4+3 presentation + three-flex persistence.
 */
import assert from 'node:assert/strict';
import { validateEnvoyWeaponKitPhaseE5 } from './envoyWeaponKitPhaseE5Engine';
import {
  ALL_ENVOY_WEAPON_FAMILY_IDS,
  isEnvoyWeaponActionPlayerFacingLive,
  requireEnvoyWeaponActions,
} from './envoyWeaponActionRegistry';
import {
  buildEnvoyCombatSurface,
  isEnvoyCombatSurfaceComplete,
  canonicalizeEnvoyCombatActionId,
} from './envoyCombatCompatibility';
import {
  DEFAULT_ENVOY_FLEX_LOADOUT,
  DEFAULT_ENVOY_LOADOUT,
} from '../types/operativeClass';
import {
  countEnvoyOrderedFlexTriples,
  countEnvoyUnorderedFlexSets,
  ENVOY_FLEX_POOL,
  sanitizeEnvoyFlexLoadout,
} from './envoyFlexLoadoutEngine';
import { sanitizeEnvoyCombatLoadout } from './classAbilityUnlockEngine';
import {
  normalizeEnvoyLoadoutForCommit,
  validateEnvoyLoadoutCommit,
} from '../utils/classLoadoutUtils';
import {
  executeEnvoyWeaponAction,
} from './envoyWeaponActionExecutor';
import { previewEnvoyWeaponAction } from './envoyWeaponActionPreviewEngine';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import {
  normalizeWeaponProgression,
  resolveWeaponState,
} from './weaponProgressionEngine';
import { createDefaultWeaponRuntime } from './weaponRunState';
import type { EnemyCombatProfile } from '../types/run';
import { STARTER_WEAPON_BY_CLASS } from './weaponRegistry';
import { validateWeaponUnlockPaths } from './weaponUnlockPathEngine';
import { classAbilityTargetMode } from './combatClassTargeting';
import { formatAbilityLabel } from './classLoadoutEngine';
import { resolveEnvoySplinterBasic } from './weaponBasicEngine';
import { getEnvoyAbilityDefinition, getEnvoyAbilityTags } from './envoyAbilities';
import { adjustEnvoyOutgoingDamage } from './envoyBoonHookRunner';
import { ENVOY_EXECUTABLE_WEAPON_ACTION_IDS } from '../types/envoyWeaponAction';

function unit(id: string): EnemyCombatProfile {
  return {
    unitId: id,
    designation: id,
    currentHp: 40,
    maxHp: 40,
    gridSlot: id === 'a' ? 'FL_0' : 'FL_1',
  } as EnemyCombatProfile;
}

console.log('Envoy Weapon-Kit Phase E.5');

const e5Issues = validateEnvoyWeaponKitPhaseE5();
assert.deepEqual(e5Issues, [], e5Issues.map((i) => `${i.code}: ${i.message}`).join('\n'));

// Seven-card surface + order for all families
const expected: Record<string, readonly string[]> = {
  'envoy-echo-lantern': [
    'GRAVEWEAVE', 'GRAVE_TRANSFER', 'VEIL_BRAND', 'ROT_KNELL',
    'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM',
  ],
  'envoy-null-conduit': [
    'NULL_ARC', 'SILENT_EDGE', 'VEIN_CUT', 'SMOKE_ARC',
    'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM',
  ],
  'envoy-sanguine-prism': [
    'BLOOD_REFRACTION', 'EXPOSE_VEIN', 'CRIMSON_VENT', 'HEART_CLAIM',
    'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM',
  ],
};
for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
  const surface = buildEnvoyCombatSurface({
    weaponFamilyId: familyId,
    flex: DEFAULT_ENVOY_FLEX_LOADOUT,
  });
  assert.ok(isEnvoyCombatSurfaceComplete(surface));
  assert.deepEqual([...surface.hudCards], [...expected[familyId]!]);
  assert.equal(surface.hudCards.filter((id) => id === requireEnvoyWeaponActions(familyId)[0]).length, 1);
  assert.ok(!surface.hudCards.includes('VEIL_SPLINTER'));
  assert.ok(!surface.hudCards.includes('BLACK_WICK'));
  assert.ok(!surface.hudCards.includes('RIFT_WARD'));
  for (const id of requireEnvoyWeaponActions(familyId)) {
    assert.equal(isEnvoyWeaponActionPlayerFacingLive(familyId, id), true);
  }
}

// Persistence: pure three-flex
assert.deepEqual([...DEFAULT_ENVOY_LOADOUT], [...DEFAULT_ENVOY_FLEX_LOADOUT]);
assert.equal(DEFAULT_ENVOY_LOADOUT.length, 3);
assert.equal(ENVOY_FLEX_POOL.length, 11);
assert.equal(countEnvoyUnorderedFlexSets(), 165);
assert.equal(countEnvoyOrderedFlexTriples(), 990);

const migrations: readonly (readonly string[])[] = [
  ['VEIL_SPLINTER', 'FLUX_PURGE', 'SOUL_TETHER', 'MIND_SUNDER'],
  ['GRAVEWEAVE', 'FLUX_PURGE', 'SOUL_TETHER', 'MIND_SUNDER'],
  ['NULL_ARC', 'PHASE_STEP', 'FLESH_WARP', 'AETHERIC_TRANSFUSION'],
  ['BLOOD_REFRACTION', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
  ['BLACK_WICK', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
  ['ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
  ['VEIL_SPLINTER', 'ASTRAL_LANCE', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'RIFT_WARD', 'UNKNOWN'],
];
for (const raw of migrations) {
  const out = sanitizeEnvoyCombatLoadout(raw);
  assert.equal(out.length, 3);
  assert.equal(validateEnvoyLoadoutCommit(out), null);
  assert.deepEqual([...normalizeEnvoyLoadoutForCommit(out)], [...out]);
  assert.deepEqual([...sanitizeEnvoyFlexLoadout(out)], [...out]);
  assert.ok(!out.includes('VEIL_SPLINTER' as never));
}

// Family change preserves flex
const flex = sanitizeEnvoyFlexLoadout(['DIMENSIONAL_SHEAR', 'PHASE_STEP', 'FLESH_WARP']);
const v = buildEnvoyCombatSurface({ weaponFamilyId: 'envoy-echo-lantern', flex });
const s = buildEnvoyCombatSurface({ weaponFamilyId: 'envoy-null-conduit', flex });
assert.deepEqual([...v.flex], [...flex]);
assert.deepEqual([...s.flex], [...flex]);
assert.notDeepEqual([...v.weaponActions], [...s.weaponActions]);

// Targeting modes
assert.equal(classAbilityTargetMode('ENVOY', 'GRAVE_TRANSFER'), 'DUAL');
assert.equal(classAbilityTargetMode('ENVOY', 'CRIMSON_VENT'), 'NONE');
assert.equal(classAbilityTargetMode('ENVOY', 'SILENT_EDGE'), 'SINGLE');

// Canonical labels (no VEIL_SPLINTER / retired codenames)
assert.equal(formatAbilityLabel('ENVOY', 'GRAVEWEAVE', 'envoy-echo-lantern').includes('VEIL'), false);
assert.ok(formatAbilityLabel('ENVOY', 'GRAVEWEAVE', 'envoy-echo-lantern').toUpperCase().includes('GRAVE'));
assert.equal(
  canonicalizeEnvoyCombatActionId('VEIL_SPLINTER', 'envoy-echo-lantern').historicalSourceId,
  'VEIL_SPLINTER',
);
assert.equal(
  canonicalizeEnvoyCombatActionId('VEIL_SPLINTER', 'envoy-echo-lantern').canonicalId,
  'GRAVEWEAVE',
);

// E.5V bugfix — WA ids must resolve tags without throwing (hurtEnemy / boon hooks).
for (const actionId of ENVOY_EXECUTABLE_WEAPON_ACTION_IDS) {
  const tags = getEnvoyAbilityTags(actionId);
  assert.ok(Array.isArray(tags), `${actionId} tags`);
  const def = getEnvoyAbilityDefinition(actionId);
  assert.ok(def.label.length > 0, `${actionId} definition`);
  const adjusted = adjustEnvoyOutgoingDamage({
    boons: [],
    mods: {
      damageMultiplier: 1,
      spellDamageFluxBonusPct: 0,
      pendulumDumpBonusPct: 0,
    } as never,
    abilityId: actionId as never,
    target: unit('a'),
    damage: 10,
    channel: 'OCCULT',
    encounter: createDefaultClassCombatEncounterState() as never,
    log: () => {},
  });
  assert.equal(adjusted.damage, 10, `${actionId} adjustEnvoyOutgoingDamage`);
}

// Executor / preview still E.4 authority for all twelve
for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
  for (const actionId of requireEnvoyWeaponActions(familyId)) {
    const weapon = resolveWeaponState(familyId, 1);
    const classState = createDefaultClassCombatEncounterState();
    const squad = [unit('a'), unit('b')];
    if (actionId === 'GRAVE_TRANSFER') {
      classState.veilRotStacks.a = 2;
    }
    if (actionId === 'ROT_KNELL') {
      classState.veilRotStacks.a = 2;
    }
    const preview = previewEnvoyWeaponAction({
      actionId,
      familyId,
      classState,
      squad,
      targetId: actionId === 'CRIMSON_VENT' ? null : 'a',
      secondaryTargetId: actionId === 'GRAVE_TRANSFER' ? 'b' : null,
      veilFlux: 80,
      operativeHp: 80,
      maxHp: 100,
      resolvedWeapon: weapon,
    });
    assert.equal(preview.ok, true, `${actionId} preview: ${preview.rejectReason}`);
    const result = executeEnvoyWeaponAction({
      actionId,
      familyId,
      squad,
      targetId: actionId === 'CRIMSON_VENT' ? null : 'a',
      secondaryTargetId: actionId === 'GRAVE_TRANSFER' ? 'b' : null,
      veilFlux: 80,
      maxHp: 100,
      operativeHp: 80,
      classState,
      log: () => {},
      resolvedWeapon: weapon,
      weaponRuntime: createDefaultWeaponRuntime(),
      spendStamina: () => true,
      hurtEnemy: () => true,
      patchUnit: () => {},
      healOperative: () => {},
      applyHpSacrifice: () => {},
      applyVeilFluxBonus: () => {},
      applyWeaponRuntimePatch: () => {},
      applyPlayerShield: () => {},
    });
    assert.equal(result.ok, true, `${actionId} exec: ${!result.ok ? result.message : ''}`);
    if (result.ok) {
      assert.equal(result.provenanceActionId, actionId);
      assert.notEqual(result.provenanceActionId, 'VEIL_SPLINTER');
    }
  }
}

// Action1 log naming uses live weapon names
const a1 = resolveEnvoySplinterBasic({
  weapon: resolveWeaponState('envoy-echo-lantern', 1),
  catalogDamage: 10,
  catalogFluxCost: 5,
  veilFlux: 20,
  operativeHp: 80,
  maxHp: 100,
  previousCatalyst: null,
});
assert.ok(a1.logLines.some((l) => l.includes('VAMBRACE')));
assert.ok(!a1.logLines.some((l) => l.includes('ECHO LANTERN')));

// Ownership / starter
assert.equal(STARTER_WEAPON_BY_CLASS.ENVOY, 'envoy-echo-lantern');
assert.deepEqual(validateWeaponUnlockPaths(), []);
const migrated = normalizeWeaponProgression({
  weaponUnlocks: ['envoy-null-conduit'],
  weaponTiers: { 'envoy-null-conduit': 2 },
  equippedWeaponByClass: { ENVOY: 'envoy-null-conduit' },
} as Parameters<typeof normalizeWeaponProgression>[0]);
assert.equal(migrated.equippedWeaponByClass.ENVOY, 'envoy-null-conduit');
assert.ok(migrated.weaponUnlocks.includes('envoy-echo-lantern'));

console.log('Envoy Weapon-Kit Phase E.5 OK');
