/**
 * Stage II-C — weapon tier retirement + canonical family ID migration.
 */
import assert from 'node:assert/strict';
import {
  CANONICAL_WEAPON_FAMILY_IDS,
  LEGACY_WEAPON_FAMILY_ID_MAP,
  normalizeWeaponFamilyId,
  normalizeWeaponFamilyIdList,
} from './weaponFamilyIdNormalize';
import { FROZEN_TIER1_BASELINES } from './weaponTier1FrozenBaselines';
import {
  ALL_WEAPON_FAMILY_IDS,
  STARTER_WEAPON_BY_CLASS,
  WEAPON_REGISTRY,
  getWeaponFamily,
  isWeaponFamilyId,
} from './weaponRegistry';
import {
  canUpgradeWeaponTier,
  createDefaultWeaponProgression,
  normalizeWeaponProgression,
  resolveWeaponState,
  unlockAllWeapons,
  upgradeWeaponTier,
} from './weaponProgressionEngine';
import {
  createDefaultWeaponRuntime,
  hydrateWeaponIncursionFields,
  snapshotWeaponForRun,
} from './weaponRunState';
import { buildWeaponDebriefSummary } from './runDebriefWeaponEngine';
import { getHexWeaponActionSet } from './hexWeaponActionRegistry';
import { getEnvoyWeaponActionSet } from './envoyWeaponActionRegistry';
import { getAegisWeaponActionSet } from './aegisWeaponActionRegistry';
import { getWeaponUltimate } from './weaponUltimateRegistry';
import { getWeaponIdentityProfile } from './weaponIdentityProfiles';
import {
  resolveUnmakerTier3FractureBreakReserveAmount,
  weaponHasUnmakerTier3FractureBreakReserve,
} from './unmakerTier3FractureBreakEngine';
import {
  runWeaponOnMeleeHitHooks,
  runWeaponOnReloadHooks,
  runWeaponOnBallisticHitHooks,
  runWeaponOnOccultCastHooks,
  runWeaponOnDebuffAppliedHooks,
} from './weaponCombatEngine';
import type { PlayerAccount } from '../types/game';
import type { ResourceQuantity } from '../types/resourceItem';

console.log('Stage II-C — weapon tier retirement + canonical ID migration');

// 1–2. Exactly nine canonical IDs; no retired live keys
assert.deepEqual([...ALL_WEAPON_FAMILY_IDS].sort(), [...CANONICAL_WEAPON_FAMILY_IDS].sort());
assert.equal(ALL_WEAPON_FAMILY_IDS.length, 9);
const retired = [
  'aegis-runed-longsword',
  'aegis-rift-edge',
  'aegis-claymore-blade',
  'hex-silver-core-sidearm',
  'hex-pulse-rifle',
  'hex-void-cannon',
  'envoy-echo-lantern',
  'envoy-null-conduit',
] as const;
retired.forEach((id) => {
  assert.equal(id in WEAPON_REGISTRY, false, `${id} must not be live registry key`);
  assert.equal(isWeaponFamilyId(id), false);
});

// 3–7. Legacy normalization map
assert.equal(normalizeWeaponFamilyId('aegis-runed-longsword'), 'aegis-longsword');
assert.equal(normalizeWeaponFamilyId('aegis-rift-edge'), 'aegis-paired-blades');
assert.equal(normalizeWeaponFamilyId('aegis-claymore-blade'), 'aegis-claymore');
assert.equal(normalizeWeaponFamilyId('hex-silver-core-sidearm'), 'hex-revolver');
assert.equal(normalizeWeaponFamilyId('hex-pulse-rifle'), 'hex-carbine');
assert.equal(normalizeWeaponFamilyId('hex-void-cannon'), 'hex-shotgun');
assert.equal(normalizeWeaponFamilyId('envoy-echo-lantern'), 'envoy-vambrace');
assert.equal(normalizeWeaponFamilyId('envoy-null-conduit'), 'envoy-scythe');
assert.equal(normalizeWeaponFamilyId('envoy-sanguine-prism'), 'envoy-sanguine-prism');
assert.equal(normalizeWeaponFamilyId('hex-void-cannon'), 'hex-shotgun');
assert.notEqual(normalizeWeaponFamilyId('hex-void-cannon'), 'hex-carbine');
assert.equal(normalizeWeaponFamilyId('hex-pulse-rifle'), 'hex-carbine');
assert.notEqual(normalizeWeaponFamilyId('hex-pulse-rifle'), 'hex-shotgun');
CANONICAL_WEAPON_FAMILY_IDS.forEach((id) => {
  assert.equal(normalizeWeaponFamilyId(id), id);
});
assert.equal(normalizeWeaponFamilyId('unknown-weapon'), null);
assert.equal(normalizeWeaponFamilyId(''), null);
assert.equal(normalizeWeaponFamilyId(null), null);

// 8–9. Hex kit ownership preserved under new IDs
assert.equal(getHexWeaponActionSet('hex-shotgun')?.familyId, 'hex-shotgun');
assert.equal(getHexWeaponActionSet('hex-carbine')?.familyId, 'hex-carbine');
assert.ok(getWeaponUltimate('hex-shotgun'));
assert.ok(getWeaponUltimate('hex-carbine'));
assert.equal(getWeaponIdentityProfile('hex-shotgun').liveDisplayName, 'Shotgun');
assert.equal(getWeaponIdentityProfile('hex-carbine').liveDisplayName, 'Carbine');

// 10–12. Tierless baselines == frozen Tier I; no T2/T3 in registry
CANONICAL_WEAPON_FAMILY_IDS.forEach((id) => {
  const def = getWeaponFamily(id);
  const frozen = FROZEN_TIER1_BASELINES[id];
  const resolved = resolveWeaponState(id);
  assert.equal(def.name, frozen.displayName);
  assert.deepEqual(def.baselineStatModifiers, frozen.statModifiers);
  assert.deepEqual(resolved.statModifiers, frozen.statModifiers);
  assert.equal(resolved.displayName, frozen.displayName);
  assert.equal('tiers' in def, false);
  assert.equal('oncePerCombatPassive' in resolved, false);
});

// Explicit Hex baseline freeze
assert.deepEqual(
  resolveWeaponState('hex-shotgun').statModifiers,
  { magazineSizeBonus: -2, ballisticDamagePct: 20, armorPierceLayers: 1, strikeStaminaCostPct: 10 },
);
assert.deepEqual(
  resolveWeaponState('hex-carbine').statModifiers,
  { magazineSizeBonus: -1, ballisticDamagePct: -5 },
);

// 13. Tier III passives do not trigger
const runtime = createDefaultWeaponRuntime();
const melee = runWeaponOnMeleeHitHooks(
  { weapon: resolveWeaponState('aegis-longsword'), runtime } as never,
  true,
);
assert.equal(melee.reserveDelta ?? 0, 0);
assert.deepEqual(melee.runtimePatch ?? {}, {});
const reload = runWeaponOnReloadHooks({
  weapon: resolveWeaponState('hex-revolver'),
  runtime,
} as never);
assert.equal(reload.staminaDelta ?? 0, 0);
const occult = runWeaponOnOccultCastHooks({
  weapon: resolveWeaponState('envoy-scythe'),
  runtime,
} as never);
assert.equal(occult.veilFluxDelta ?? 0, 0);
const debuff = runWeaponOnDebuffAppliedHooks(
  { weapon: resolveWeaponState('envoy-vambrace'), runtime } as never,
  {} as never,
);
assert.equal(debuff.playerShieldDelta ?? 0, 0);
const armored = runWeaponOnBallisticHitHooks(
  { weapon: resolveWeaponState('hex-shotgun'), runtime } as never,
  { kineticArmor: 2 } as never,
);
assert.equal(armored.enemyArmorStrip ?? 0, 0);
assert.equal(weaponHasUnmakerTier3FractureBreakReserve(resolveWeaponState('aegis-claymore')), false);
assert.equal(
  resolveUnmakerTier3FractureBreakReserveAmount(resolveWeaponState('aegis-claymore')),
  0,
);

// 14–18. Equal base power + account migration
const fresh = createDefaultWeaponProgression();
const legacyMaxTierInput = {
  weaponUnlocks: [
    'aegis-runed-longsword',
    'aegis-rift-edge',
    'aegis-claymore-blade',
    'hex-silver-core-sidearm',
    'hex-pulse-rifle',
    'hex-void-cannon',
    'envoy-echo-lantern',
    'envoy-null-conduit',
    'envoy-sanguine-prism',
  ],
  weaponTiers: {
    'aegis-runed-longsword': 3,
    'aegis-rift-edge': 3,
    'aegis-claymore-blade': 3,
    'hex-silver-core-sidearm': 3,
    'hex-pulse-rifle': 3,
    'hex-void-cannon': 3,
    'envoy-echo-lantern': 3,
    'envoy-null-conduit': 3,
    'envoy-sanguine-prism': 3,
  },
  equippedWeaponByClass: {
    AEGIS: 'aegis-claymore-blade',
    HEX_SHOT: 'hex-void-cannon',
    ENVOY: 'envoy-null-conduit',
  },
};
const migrated = normalizeWeaponProgression(legacyMaxTierInput);
assert.equal('weaponTiers' in migrated, false);
retired.forEach((id) => {
  assert.equal(migrated.weaponUnlocks.includes(id as never), false);
});
assert.ok(migrated.weaponUnlocks.includes('aegis-claymore'));
assert.ok(migrated.weaponUnlocks.includes('hex-shotgun'));
assert.ok(migrated.weaponUnlocks.includes('envoy-scythe'));
assert.equal(migrated.equippedWeaponByClass.AEGIS, 'aegis-claymore');
assert.equal(migrated.equippedWeaponByClass.HEX_SHOT, 'hex-shotgun');
assert.equal(migrated.equippedWeaponByClass.ENVOY, 'envoy-scythe');

const twice = normalizeWeaponProgression(migrated);
assert.deepEqual(twice, migrated);

const freshCombat = resolveWeaponState(STARTER_WEAPON_BY_CLASS.AEGIS);
const maxHistoryCombat = resolveWeaponState('aegis-longsword');
assert.deepEqual(freshCombat.statModifiers, maxHistoryCombat.statModifiers);
assert.deepEqual(
  resolveWeaponState(migrated.equippedWeaponByClass.HEX_SHOT!),
  resolveWeaponState('hex-shotgun'),
);

// Same class + same canonical equipped family → identical combat inputs
const accountA = normalizeWeaponProgression({
  weaponUnlocks: ['aegis-longsword'],
  equippedWeaponByClass: { AEGIS: 'aegis-longsword' },
});
const accountB = normalizeWeaponProgression({
  weaponUnlocks: ['aegis-runed-longsword'],
  weaponTiers: { 'aegis-runed-longsword': 3 },
  equippedWeaponByClass: { AEGIS: 'aegis-runed-longsword' },
});
assert.deepEqual(
  resolveWeaponState(accountA.equippedWeaponByClass.AEGIS!),
  resolveWeaponState(accountB.equippedWeaponByClass.AEGIS!),
);

// 19–22. Ownership recovery + collapse
const tierOnly = normalizeWeaponProgression({
  weaponUnlocks: [],
  weaponTiers: { 'hex-pulse-rifle': 2, 'not-a-weapon': 3 },
  equippedWeaponByClass: {},
});
assert.ok(tierOnly.weaponUnlocks.includes('hex-carbine'));
assert.equal(tierOnly.weaponUnlocks.includes('not-a-weapon' as never), false);

const collapsed = normalizeWeaponFamilyIdList([
  'hex-void-cannon',
  'hex-shotgun',
  'hex-void-cannon',
]);
assert.deepEqual(collapsed, ['hex-shotgun']);

const dupOwn = normalizeWeaponProgression({
  weaponUnlocks: ['aegis-runed-longsword', 'aegis-longsword'],
  equippedWeaponByClass: { AEGIS: 'aegis-longsword' },
});
assert.equal(dupOwn.weaponUnlocks.filter((id) => id === 'aegis-longsword').length, 1);

// 23. Unknown / wrong-class fail closed
const wrongClass = normalizeWeaponProgression({
  weaponUnlocks: ['aegis-longsword'],
  equippedWeaponByClass: { HEX_SHOT: 'aegis-longsword' },
});
assert.equal(wrongClass.equippedWeaponByClass.HEX_SHOT, STARTER_WEAPON_BY_CLASS.HEX_SHOT);
assert.equal(normalizeWeaponFamilyId('totally-fake'), null);

// 24–25. No tier upgrade deductions; stash unchanged
const stash: ResourceQuantity = {
  'nullcrete-shard': 99,
  'echo-glass-shard': 99,
  'rail-capacitor': 99,
};
const before = { ...stash };
assert.equal(canUpgradeWeaponTier(stash, migrated, 'aegis-longsword'), false);
const up = upgradeWeaponTier(stash, migrated, 'aegis-longsword');
assert.equal(up.ok, false);
assert.deepEqual(up.stash, before);
assert.deepEqual(stash, before);

// 26–27. Deployment snapshot
const snap = snapshotWeaponForRun('HEX_SHOT', migrated);
assert.equal(snap.activeWeaponFamilyId, 'hex-shotgun');
assert.equal('activeWeaponTier' in snap, false);
assert.deepEqual(Object.keys(snap.weaponRuntime).sort(), [
  'claymoreBreakCashoutUsed',
  'magazineEmptiedThisCombat',
  'riftEdgeTempoArmed',
].sort());
const hydrated = hydrateWeaponIncursionFields(
  {
    activeWeaponFamilyId: 'hex-void-cannon' as any,
    activeWeaponTier: 3 as any,
    weaponRuntime: {
      firstMeleeHitUsed: true,
      riftEdgeTempoArmed: true,
      claymoreBreakCashoutUsed: false,
      magazineEmptiedThisCombat: true,
    } as any,
  },
  'HEX_SHOT',
);
assert.equal(hydrated.activeWeaponFamilyId, 'hex-shotgun');
assert.equal('activeWeaponTier' in hydrated, false);
assert.equal(hydrated.weaponRuntime.riftEdgeTempoArmed, true);
assert.equal(hydrated.weaponRuntime.magazineEmptiedThisCombat, true);
assert.equal('firstMeleeHitUsed' in hydrated.weaponRuntime, false);

// 28–30. Debrief / live names
const fakeAccount = {
  activeClass: 'HEX_SHOT',
  weaponUnlocks: migrated.weaponUnlocks,
  equippedWeaponByClass: migrated.equippedWeaponByClass,
  resourceStash: before,
} as PlayerAccount;
const debrief = buildWeaponDebriefSummary(fakeAccount, {
  activeClass: 'HEX_SHOT',
  activeWeaponFamilyId: 'hex-shotgun',
  isRunActive: true,
} as never);
assert.equal(debrief.equippedDisplayName, 'Shotgun');
assert.equal('equippedTier' in debrief, false);
assert.equal(debrief.lines.some((l) => l.kind === ('UPGRADE_AVAILABLE' as never)), false);
assert.ok(!JSON.stringify(debrief).includes('Nullbreach'));
assert.ok(!JSON.stringify(debrief).includes('Ash Shotgun'));
assert.ok(!JSON.stringify(debrief).toLowerCase().includes('tier i'));

const liveNames = CANONICAL_WEAPON_FAMILY_IDS.map((id) => getWeaponFamily(id).name);
assert.deepEqual(liveNames.sort(), [
  'Carbine',
  'Claymore',
  'Longsword',
  'Paired Blades',
  'Revolver',
  'Sanguine Prism',
  'Scythe',
  'Shotgun',
  'Vambrace',
].sort());

// 31–32. Action kits + ultimates still owned
assert.ok(getAegisWeaponActionSet('aegis-longsword'));
assert.ok(getAegisWeaponActionSet('aegis-paired-blades'));
assert.ok(getAegisWeaponActionSet('aegis-claymore'));
assert.ok(getHexWeaponActionSet('hex-revolver'));
assert.ok(getHexWeaponActionSet('hex-carbine'));
assert.ok(getHexWeaponActionSet('hex-shotgun'));
assert.ok(getEnvoyWeaponActionSet('envoy-vambrace'));
assert.ok(getEnvoyWeaponActionSet('envoy-scythe'));
assert.ok(getEnvoyWeaponActionSet('envoy-sanguine-prism'));
CANONICAL_WEAPON_FAMILY_IDS.forEach((id) => {
  assert.ok(getWeaponUltimate(id), `ultimate missing for ${id}`);
});

// 36. Starters
assert.equal(STARTER_WEAPON_BY_CLASS.AEGIS, 'aegis-longsword');
assert.equal(STARTER_WEAPON_BY_CLASS.HEX_SHOT, 'hex-revolver');
assert.equal(STARTER_WEAPON_BY_CLASS.ENVOY, 'envoy-vambrace');

// Map completeness
assert.equal(Object.keys(LEGACY_WEAPON_FAMILY_ID_MAP).length, 9);
assert.equal(unlockAllWeapons().weaponUnlocks.length, 9);

console.log('weaponTierRetirementPhase2C.test.ts — all assertions passed');
