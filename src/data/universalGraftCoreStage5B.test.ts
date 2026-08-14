import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_AEGIS_TECHNIQUE_LOADOUT } from '../types/aegisCombat';
import {
  DEFAULT_ENVOY_FLEX_LOADOUT,
  DEFAULT_HEX_FLEX_LOADOUT,
} from '../types/operativeClass';
import { buildClassGraftCastPlan, scaleClassGraftDamage } from './classGraftEngine';
import { getHexWeaponActionDefinition } from './hexWeaponActionCatalog';
import {
  aegisWeaponActionTags,
} from './aegisWeaponActionCatalog';
import { buildWeaponActionGraftCastPlan } from './aegisWeaponActionGraftEngine';
import { buildGraftCastPlan, scaleGraftDamage } from './veilGraftEngine';
import {
  canCastBlacksiteTriage,
  resolveCinderlineTickForUnit,
  seedCinderlineHazard,
} from './hexShotPhaseH3bEngine';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import {
  armRuneboundCarapace,
  createRuneboundCarapaceState,
  noteCarapaceInboundHit,
  resolveCarapaceAfterEnemyAction,
} from './aegisRuneboundCarapaceEngine';
import { applyKineticArmorMitigation } from './combatDefenseLayerEngine';
import {
  buildDeterministicSanctuaryGraftOffers,
  buildSanctuaryGraftSurface,
  resolveSanctuaryOfferTarget,
} from './sanctuaryFlowEngine';
import { validateSanctuaryGraftApplication } from './graftSynergy/permanentGraftLoadoutEngine';
import { hydrateGraftIncursionFields } from './graftRunState';
import { evaluateGraftCompatibility } from './graftSynergy/graftCompatibilityEngine';
import {
  applyUniversalDamagePacketUpgrade,
  getUniversalGraftCardData,
  getUniversalGraftDefinition,
  getUniversalGraftForAction,
  normalizeAegisGraftMap,
  normalizeEnvoyGraftMap,
  normalizeHexShotGraftMap,
  normalizeUniversalGraftId,
  normalizeUniversalGraftOffers,
  readUniversalUpgradeValue,
  UNIVERSAL_GRAFT_DEFINITIONS,
  universalGraftMatchesTarget,
  validateUniversalGraftRegistry,
} from './universalGraftRegistry';

console.log('Stage V-B — universal graft core');

assert.deepEqual(validateUniversalGraftRegistry(), []);
assert.equal(UNIVERSAL_GRAFT_DEFINITIONS.length, 70);
assert.equal(normalizeUniversalGraftId('DENSITY_GRAFT'), null);
assert.equal(normalizeUniversalGraftId('unknown'), null);

const quickdraw = getUniversalGraftForAction('HEX_SHOT', 'QUICKDRAW')!;
assert.equal(quickdraw.id, 'graft_hex_shot_quickdraw');
assert.equal(quickdraw.name, 'QUICKDRAW+');
assert.equal(universalGraftMatchesTarget('HEX_SHOT', 'QUICKDRAW', quickdraw.id), true);
assert.equal(universalGraftMatchesTarget('HEX_SHOT', 'SLIPSHOT', quickdraw.id), false);
assert.equal(universalGraftMatchesTarget('ENVOY', 'QUICKDRAW', quickdraw.id), false);
assert.deepEqual(getUniversalGraftCardData('HEX_SHOT', quickdraw.id), {
  id: quickdraw.id,
  actionName: 'QUICKDRAW+',
  currentValue: 100,
  upgradedValue: 110,
  improvedProperty: quickdraw.previewCopy,
  canonicalActionId: 'QUICKDRAW',
});
assert.equal(getUniversalGraftCardData('ENVOY', quickdraw.id), null);

const hexMap = {
  QUICKDRAW: quickdraw.id,
  SLIPSHOT: 'WIDOW_CHOKE_GRAFT',
  UNKNOWN: quickdraw.id,
};
const normalizedHex = normalizeHexShotGraftMap(hexMap);
assert.deepEqual(normalizedHex, { QUICKDRAW: quickdraw.id });
assert.deepEqual(normalizeHexShotGraftMap(normalizedHex), normalizedHex);

const graveweave = getUniversalGraftForAction('ENVOY', 'GRAVEWEAVE')!;
const normalizedEnvoy = normalizeEnvoyGraftMap({ GRAVEWEAVE: graveweave.id });
assert.deepEqual(normalizedEnvoy, { GRAVEWEAVE: graveweave.id });
assert.deepEqual(normalizeEnvoyGraftMap(normalizedEnvoy), normalizedEnvoy);

const ruin = getUniversalGraftForAction('AEGIS', 'RUIN')!;
const normalizedAegis = normalizeAegisGraftMap({
  'TECH:RUIN': ruin.id,
  RUIN: ruin.id,
  'WA:RUPTURE': 'DENSITY_GRAFT',
});
assert.deepEqual(normalizedAegis, { 'TECH:RUIN': ruin.id });
assert.deepEqual(normalizeAegisGraftMap(normalizedAegis), normalizedAegis);

const normalizedOffers = normalizeUniversalGraftOffers('AEGIS', [
  ruin.id,
  'DENSITY_GRAFT',
  ruin.id,
]);
assert.deepEqual(normalizedOffers, [ruin.id]);
assert.deepEqual(normalizeUniversalGraftOffers('AEGIS', normalizedOffers), normalizedOffers);

const threeAegisOffers = [
  ruin.id,
  getUniversalGraftForAction('AEGIS', 'VEIL_PIERCER')!.id,
  getUniversalGraftForAction('AEGIS', 'DEVASTATE')!.id,
];
const hydratedGrafts = hydrateGraftIncursionFields({
  activeClass: 'AEGIS' as const,
  abilityGrafts: {
    'TECH:RUIN': ruin.id,
    RUIN: ruin.id,
    'WA:RUPTURE': 'DENSITY_GRAFT',
  },
  hexShotAbilityGrafts: { QUICKDRAW: quickdraw.id, SLIPSHOT: 'unknown' },
  envoyAbilityGrafts: { GRAVEWEAVE: graveweave.id },
  sanctuaryGraftOffers: threeAegisOffers,
  encounterUltimateDisabled: true,
});
assert.deepEqual(hydratedGrafts.abilityGrafts, { 'TECH:RUIN': ruin.id });
assert.deepEqual(hydratedGrafts.hexShotAbilityGrafts, { QUICKDRAW: quickdraw.id });
assert.deepEqual(hydratedGrafts.envoyAbilityGrafts, { GRAVEWEAVE: graveweave.id });
assert.deepEqual(hydratedGrafts.sanctuaryGraftOffers, threeAegisOffers);
assert.equal(hydratedGrafts.encounterUltimateDisabled, false);
assert.deepEqual(hydrateGraftIncursionFields(hydratedGrafts), hydratedGrafts);
assert.equal(hydrateGraftIncursionFields({
  activeClass: 'AEGIS' as const,
  sanctuaryGraftOffers: [ruin.id, quickdraw.id, 'unknown'],
}).sanctuaryGraftOffers, null);

const surface = buildSanctuaryGraftSurface({
  classId: 'AEGIS',
  weaponFamilyId: 'aegis-longsword',
  aegisTechniques: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  hexFlex: DEFAULT_HEX_FLEX_LOADOUT,
  envoyFlex: DEFAULT_ENVOY_FLEX_LOADOUT,
});
const offers = buildDeterministicSanctuaryGraftOffers({
  classId: 'AEGIS',
  seed: 'stage-v-b',
  runDepthBand: 1,
  surface,
  currentMap: {},
});
assert.equal(offers.length, 3);
assert.equal(new Set(offers).size, 3);
assert.deepEqual(offers, buildDeterministicSanctuaryGraftOffers({
  classId: 'AEGIS',
  seed: 'stage-v-b',
  runDepthBand: 3,
  surface,
  currentMap: {},
}));
for (const offer of offers) {
  const definition = getUniversalGraftDefinition(offer)!;
  assert.ok(surface.some((row) => row.actionId === definition.canonicalActionId));
  assert.equal(resolveSanctuaryOfferTarget('AEGIS', surface, offer)?.actionId, definition.canonicalActionId);
}
const firstOffer = offers[0];
const firstTarget = resolveSanctuaryOfferTarget('AEGIS', surface, firstOffer)!;
const offersAfterApply = buildDeterministicSanctuaryGraftOffers({
  classId: 'AEGIS',
  seed: 'stage-v-b',
  runDepthBand: 1,
  surface,
  currentMap: { [firstTarget.key]: firstOffer },
});
assert.ok(!offersAfterApply.includes(firstOffer));

const replacement = validateSanctuaryGraftApplication({
  classId: 'AEGIS',
  abilityId: 'TECH:RUIN',
  graftId: ruin.id,
  runDepthBand: 3,
  currentMap: {
    RUIN: quickdraw.id,
    'WA:RUIN': quickdraw.id,
    'TECH:RUIN': quickdraw.id,
  },
  sanctuarySessionActive: true,
  sanctuaryOffers: [ruin.id],
  eligibleAbilityIds: ['TECH:RUIN'],
  aegisSurface: {
    weaponFamilyId: 'aegis-longsword',
    techniques: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  },
});
assert.equal(replacement.ok, true);
assert.deepEqual(replacement.proposedMap, { 'TECH:RUIN': ruin.id });

const fixedBasic = getUniversalGraftForAction('AEGIS', 'WARDENS_STRIKE')!;
assert.equal(evaluateGraftCompatibility({
  classId: 'AEGIS',
  abilityId: 'WA:WARDENS_STRIKE',
  graftId: fixedBasic.id,
  runDepthBand: 1,
  equippedMap: {},
  graftAvailable: true,
}).ok, true);
assert.equal(evaluateGraftCompatibility({
  classId: 'AEGIS',
  abilityId: 'WA:RUPTURE',
  graftId: fixedBasic.id,
  runDepthBand: 1,
  equippedMap: {},
  graftAvailable: true,
}).ok, false);

const classPlan = buildClassGraftCastPlan('HEX_SHOT', 'QUICKDRAW', quickdraw.id);
assert.deepEqual(classPlan.effectiveTags, getHexWeaponActionDefinition('QUICKDRAW')!.tags);
assert.equal(classPlan.upgradeAxis, 'DIRECT_DAMAGE');
const fixedBasicPlan = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', fixedBasic.id);
assert.deepEqual(fixedBasicPlan.effectiveTags, aegisWeaponActionTags('WARDENS_STRIKE'));
assert.equal(fixedBasicPlan.upgradeAxis, 'DIRECT_DAMAGE');
const ruinPlan = buildGraftCastPlan('RUIN', ruin.id);
assert.equal(ruinPlan.upgradeAxis, 'DIRECT_DAMAGE');

const once = applyUniversalDamagePacketUpgrade({ damage: 6 }, quickdraw);
const twice = applyUniversalDamagePacketUpgrade(once, quickdraw);
assert.equal(once.damage, 7);
assert.deepEqual(twice, once);

const expectedAxisValues: Record<string, [string, number, number]> = {
  CRIMSON_VENT: ['RESOURCE_GAIN', 15, 17],
  PHOSPHORUS_HEX: ['ACCURACY_PENALTY', 50, 65],
  NULL_SPACE_CLOAK: ['STAMINA_COST', 40, 39],
  GHOST_GRID_CAMO: ['DURATION_TURNS', 1, 2],
  ASTRAL_TARGET_LOCK: ['STAMINA_COST', 25, 24],
  CINDERLINE_SATURATION: ['HAZARD_TICK_DAMAGE', 5, 6],
  BLACKSITE_TRIAGE: ['HEAL_PERCENT', 20, 22],
  PHASE_STEP: ['FLUX_COST', 15, 14],
  AETHERIC_TRANSFUSION: ['HEAL_PERCENT', 25, 28],
  SOUL_TETHER: ['REFLECT_PERCENT', 50, 55],
  FLESH_WARP: ['MAX_HP_REDUCTION', 15, 17],
  PARALYTIC_MIASMA: ['FLUX_COST', 15, 14],
  FINAL_MERCY: ['HEAL_PERCENT', 10, 11],
  GRAVE_BIND: ['EXPOSED_DEFENSE_REDUCTION', 50, 55],
  NAIL_TO_GRID: ['AP_DRAIN', 1, 2],
  ASHEN_MANTLE: ['DURATION_TURNS', 1, 2],
  RUNEBOUND_CARAPACE: ['REFLECT_DAMAGE', 12, 13],
  DEMONS_LUNG: ['RESERVE_GAIN', 30, 33],
  CRIMSON_PACT: ['HP_COST_PERCENT', 12, 11],
};
for (const [actionId, [axis, base, upgraded]] of Object.entries(expectedAxisValues)) {
  const definition = UNIVERSAL_GRAFT_DEFINITIONS.find(
    (entry) => entry.canonicalActionId === actionId,
  )!;
  assert.equal(definition.upgradeAxis, axis);
  assert.equal(definition.baseValue, base);
  const overlay = {
    upgradeAxis: definition.upgradeAxis,
    upgradedAxisValue: definition.upgradedValue,
  };
  assert.equal(readUniversalUpgradeValue(overlay, definition.upgradeAxis, -1), upgraded);
  assert.equal(readUniversalUpgradeValue(overlay, 'DIRECT_DAMAGE', base), base);
}

const salvoPackets = [7, 7, 8].map((damage) =>
  applyUniversalDamagePacketUpgrade({ damage }, quickdraw).damage);
assert.deepEqual(salvoPackets, [8, 8, 9]);
assert.deepEqual(
  [7, 7, 8].map((damage) => scaleClassGraftDamage(damage, classPlan, {
    currentAmmo: 3,
    maxAmmo: 6,
    veilFlux: 50,
    fluxMaxCap: 100,
  })),
  [8, 8, 9],
);
assert.deepEqual(
  [4, 100].map((damage) => scaleGraftDamage(damage, buildGraftCastPlan(
    'DEVASTATE',
    getUniversalGraftForAction('AEGIS', 'DEVASTATE')!.id,
  ))),
  [5, 110],
);
assert.equal(readUniversalUpgradeValue(null, 'FLUX_COST', 15), 15);

for (const file of [
  'src/components/ClassGraftUI.tsx',
  'src/screens/RestScreen.tsx',
  'src/context/RunContext.tsx',
  'src/components/TacticalCombatHub.tsx',
  'src/data/aegisAbilityExecutor.ts',
]) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /Apex Graft|APEX MUTATION|INJECT GRAFT|VEIL-GRAFT TERMINAL|Class graft mutation secured/);
}

const RETIRED_GRAFT_IDS = [
  'DENSITY_GRAFT', 'SANGUINE_GRAFT', 'ECHO_GRAFT', 'VOID_GLASS_GRAFT',
  'NEUTRON_GRAFT', 'IRON_LUNG_GRAFT', 'GRID_HACKER_GRAFT', 'SCAVENGER_GRAFT',
  'SHRAPNEL_GRAFT', 'SPLINTER_GRAFT', 'FLAYER_GRAFT', 'CONDUIT_GRAFT',
  'MARROW_GRAFT', 'MARTYR_GRAFT', 'NULL_SPACE_GRAFT', 'APEX_GRAFT',
  'WIDOW_CHOKE_GRAFT', 'HELL_FIRE_COMPENSATOR', 'SILENT_VOID_SUPPRESSOR',
  'SPLITTER_BARREL_GRAFT', 'BLOOD_MAG_GRAFT', 'ECHO_RECEIVER_GRAFT',
  'BOTTOMLESS_DRUM_GRAFT', 'SCAVENGER_BOLT_GRAFT', 'OMNI_LENS_GRAFT',
  'ASTRAL_SIGHT_GRAFT', 'GHOST_BEAM_GRAFT', 'PRECOGNITIVE_SCOPE_GRAFT',
  'RICOCHET_DEFLECTOR_GRAFT', 'NEUTRON_SEAR_GRAFT', 'PARASITE_GRIP_GRAFT',
  'APEX_TRIGGER_GRAFT', 'DEAD_MAN_SWITCH_GRAFT', 'VOID_CONDUCTOR_GRAFT',
  'SPLINTER_RUNE_GRAFT', 'ECLIPSE_SIGIL_GRAFT', 'BLOOD_INK_GRAFT',
  'AETHER_VALVE_GRAFT', 'SANGUINE_CHANNEL_GRAFT', 'ECHO_WEAVE_GRAFT',
  'NULL_STATE_GRAFT', 'PARASITIC_SEAL_GRAFT', 'WITHER_MARK_GRAFT',
  'GHOST_THREAD_GRAFT', 'CHRONO_LOCK_GRAFT', 'ANOMALY_SPARK_GRAFT',
  'OVERLOAD_CATALYST_GRAFT', 'MARTYR_RUNE_GRAFT', 'APEX_CHANNEL_GRAFT',
] as const;

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionTypeScriptFiles(path);
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name) || /\.test\.(?:ts|tsx)$/.test(entry.name)) {
      return [];
    }
    return [path];
  });
}

const compatibilityAllowlist = new Set([
  // Stored encounter snapshots may contain the retired protection source token.
  'src/data/hitAbsorbProtectionEngine.ts',
]);
for (const file of productionTypeScriptFiles('src')) {
  if (compatibilityAllowlist.has(file)) continue;
  const source = readFileSync(file, 'utf8');
  for (const retiredId of RETIRED_GRAFT_IDS) {
    assert.equal(
      source.includes(retiredId),
      false,
      `${file} still references retired graft ID ${retiredId}`,
    );
  }
}

const delayedState = createDefaultClassCombatEncounterState();
seedCinderlineHazard(delayedState, 'FL_0', 6);
assert.equal(resolveCinderlineTickForUnit(delayedState, {
  unitId: 'tick-target',
  gridSlot: 'FL_0',
} as never)?.damage, 6);
assert.equal(canCastBlacksiteTriage(delayedState, 50, 100, 22).ok, true);
assert.equal(
  canCastBlacksiteTriage(delayedState, 50, 100, 22).ok
    ? (canCastBlacksiteTriage(delayedState, 50, 100, 22) as { heal: number }).heal
    : 0,
  22,
);

let carapace = armRuneboundCarapace(createRuneboundCarapaceState(), 13);
carapace = noteCarapaceInboundHit(carapace, {
  armed: true,
  hasAttacker: true,
  attackerId: 'attacker',
  damageApplied: 1,
  fullyNegated: false,
  unblockable: false,
  ranged: false,
  environmental: false,
  damageOverTime: false,
  selfDamage: false,
  controlOnly: false,
  mitigationBypass: false,
});
assert.equal(resolveCarapaceAfterEnemyAction(carapace, true).reflect?.trueDamage, 13);
assert.equal(applyKineticArmorMitigation({
  kineticArmor: 1,
  baseKineticArmor: 1,
  combatTags: ['EXPOSED'],
  exposedDefenseReductionPct: 55,
} as never, 100).damageAfter, 90);

console.log('Stage V-B universal graft core passed.');
