import type { ClassType } from '../types/game';
import type {
  WeaponFamilyDefinition,
  WeaponFamilyId,
  WeaponResourceCost,
  WeaponTierDefinition,
} from '../types/weapon';

const EMPTY_COST: readonly WeaponResourceCost[] = [];

function tier(
  tierNumber: 1 | 2 | 3,
  displayName: string,
  statModifiers: WeaponTierDefinition['statModifiers'],
  effectSummary: string,
  upgradeCost: readonly WeaponResourceCost[],
  oncePerCombatPassive?: WeaponTierDefinition['oncePerCombatPassive'],
  passiveBonusPct?: number,
): WeaponTierDefinition {
  return {
    tierNumber,
    displayName,
    statModifiers,
    effectSummary,
    upgradeCost,
    oncePerCombatPassive,
    passiveBonusPct,
  };
}

export const ALL_WEAPON_FAMILY_IDS: readonly WeaponFamilyId[] = [
  'aegis-runed-longsword',
  'aegis-claymore-blade',
  'aegis-rift-edge',
  'hex-silver-core-sidearm',
  'hex-pulse-rifle',
  'hex-void-cannon',
  'envoy-null-conduit',
  'envoy-sanguine-prism',
  'envoy-echo-lantern',
];

export const STARTER_WEAPON_BY_CLASS: Record<ClassType, WeaponFamilyId> = {
  AEGIS: 'aegis-runed-longsword',
  HEX_SHOT: 'hex-silver-core-sidearm',
  ENVOY: 'envoy-echo-lantern',
};

export const WEAPON_REGISTRY: Record<WeaponFamilyId, WeaponFamilyDefinition> = {
  'aegis-runed-longsword': {
    id: 'aegis-runed-longsword',
    classId: 'AEGIS',
    name: 'Runed Longsword',
    shortName: 'Longsword',
    description: 'Runed longsword — balanced damage, fracture, and Reserve generation.',
    flavorText: 'Agency-standard rune etching. For operatives learning the Aegis rhythm.',
    role: 'Starter / balanced fracture setup',
    tags: ['MELEE', 'KINETIC', 'BALANCED', 'FRACTURE'],
    startingUnlocked: true,
    unlockRequirement: EMPTY_COST,
    uiSummary: 'Steady Fracture strike — reliable Parry and Reserve setup.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Longsword I', { aegisTechniquePowerPct: 0 }, 'Baseline Fracture and Reserve generation.', [
        { resourceId: 'nullcrete-shard', quantity: 4 },
        { resourceId: 'echo-glass-shard', quantity: 3 },
      ]),
      // strikeDamagePct: dormant WA/basic migration. aegisTechniquePowerPct: VP/Reave (E.1c.1).
      tier(2, 'Longsword II', { strikeDamagePct: 10, aegisTechniquePowerPct: 10, fractureFromMeleePct: 10 }, '+10% Fracture from melee.', [
        { resourceId: 'nullcrete-shard', quantity: 6 },
        { resourceId: 'legion-blood-iron', quantity: 1 },
      ]),
      tier(3, 'Longsword III', { strikeDamagePct: 18, aegisTechniquePowerPct: 18, fractureFromMeleePct: 15 }, 'First melee hit each combat generates +5 Abyssal Reserve.', EMPTY_COST, 'FIRST_MELEE_RESERVE_BONUS', 5),
    ],
  },
  'aegis-claymore-blade': {
    id: 'aegis-claymore-blade',
    classId: 'AEGIS',
    name: 'Unmaker',
    shortName: 'Unmaker',
    description: 'Massive claymore — heavy Fracture pressure and break cashouts.',
    flavorText: 'Legion-forged mass transfer lattice for breaking armored Veil entities.',
    role: 'Heavy Fracture-break cashout',
    tags: ['MELEE', 'KINETIC', 'HEAVY', 'FRACTURE'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'legion-blood-iron', quantity: 3 },
      { resourceId: 'rail-capacitor', quantity: 2 },
      { resourceId: 'combustion-cylinder', quantity: 2 },
    ],
    uiSummary: 'Heavy Fracture commitment — cash out on breaks.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      // strikeDamagePct: dormant WA/basic migration. aegisTechniquePowerPct: VP/Reave.
      // aegisUltimatePowerPct: REND/GRAVEFALL (E.1d.1) — mirrors prior strikeDamagePct matrices.
      tier(1, 'Unmaker I', { strikeDamagePct: 15, aegisTechniquePowerPct: 15, aegisUltimatePowerPct: 15, fractureFromMeleePct: 20, strikeStaminaCostPct: 10 }, '+20% Fracture from melee.', [
        { resourceId: 'combustion-cylinder', quantity: 2 },
        { resourceId: 'legion-blood-iron', quantity: 1 },
      ]),
      tier(2, 'Unmaker II', { strikeDamagePct: 22, aegisTechniquePowerPct: 22, aegisUltimatePowerPct: 22, fractureFromMeleePct: 28, strikeStaminaCostPct: 10 }, '+28% Fracture from melee.', [
        { resourceId: 'rail-capacitor', quantity: 2 },
        { resourceId: 'legion-blood-iron', quantity: 2 },
      ]),
      tier(
        3,
        'Unmaker III',
        { strikeDamagePct: 25, aegisTechniquePowerPct: 25, aegisUltimatePowerPct: 25, fractureFromMeleePct: 32, strikeStaminaCostPct: 10 },
        'Fracture Break: Gain 1 Abyssal Reserve when an Unmaker action breaks Fracture. Once per action.',
        EMPTY_COST,
        'FRACTURE_BREAK_RESERVE',
        1,
      ),
    ],
  },
  'aegis-rift-edge': {
    id: 'aegis-rift-edge',
    classId: 'AEGIS',
    name: 'Paired Blades',
    shortName: 'Paired',
    description: 'Two equal-length swords — crit and Reserve over raw kinetic output.',
    flavorText: 'Cuts along the membrane between worlds. Occult resonance over brute force.',
    role: 'Tempo / evade / execution',
    tags: ['MELEE', 'OCCULT', 'FAST', 'CRIT', 'RESOURCE'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'ossified-ley-knot', quantity: 2 },
      { resourceId: 'resonant-filament', quantity: 2 },
      { resourceId: 'echo-glass-shard', quantity: 6 },
    ],
    uiSummary: 'Kinetic cut — Occult rider after evade/parry tempo.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      // strikeDamagePct: dormant WA/basic. aegisTechniquePowerPct: VP/Reave (E.1c.1).
      // aegisUltimatePowerPct: REND_THE_VEIL (E.1d.1) — mirrors prior strikeDamagePct matrices.
      tier(1, 'Paired Blades I', { strikeDamagePct: -5, aegisTechniquePowerPct: -5, aegisUltimatePowerPct: -5, reserveGainFlat: 3, critChancePct: 5 }, 'Melee generates extra Reserve; +5% crit.', [
        { resourceId: 'echo-glass-shard', quantity: 6 },
        { resourceId: 'sanguine-ampoule', quantity: 1 },
      ]),
      tier(2, 'Paired Blades II', { strikeDamagePct: -3, aegisTechniquePowerPct: -3, aegisUltimatePowerPct: -3, reserveGainFlat: 5, critChancePct: 8 }, 'Improved crit and Reserve bonuses.', [
        { resourceId: 'echo-glass-shard', quantity: 10 },
        { resourceId: 'ossified-ley-knot', quantity: 1 },
      ]),
      tier(3, 'Paired Blades III', { strikeDamagePct: -3, aegisTechniquePowerPct: -3, aegisUltimatePowerPct: -3, reserveGainFlat: 5, critChancePct: 10 }, 'Melee crits generate +5 additional Reserve.', EMPTY_COST, 'MELEE_CRIT_RESERVE_BONUS', 5),
    ],
  },
  'hex-silver-core-sidearm': {
    id: 'hex-silver-core-sidearm',
    classId: 'HEX_SHOT',
    name: 'Silver-Core Sidearm',
    shortName: 'Sidearm',
    description: 'Silver-Core Sidearm — consistent ballistic damage and manageable ammo.',
    flavorText: 'Terran Grid warded sidearm. The Riftshot operative\'s default field piece.',
    role: 'Starter / precision reload-tempo',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'BALANCED', 'AMMO'],
    startingUnlocked: true,
    unlockRequirement: EMPTY_COST,
    uiSummary: 'Efficient sidearm — reload tempo and precise finishes.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Silver-Core Sidearm I', {}, 'Baseline sidearm stats.', [
        { resourceId: 'nullcrete-shard', quantity: 4 },
        { resourceId: 'echo-glass-shard', quantity: 3 },
      ]),
      tier(2, 'Silver-Core Sidearm II', { ballisticDamagePct: 10, strikeStaminaCostPct: -5 }, '+10% ballistic damage; smoother reload stamina.', [
        { resourceId: 'rail-capacitor', quantity: 2 },
        { resourceId: 'encrypted-grid-drive', quantity: 1 },
      ]),
      tier(3, 'Silver-Core Sidearm III', { ballisticDamagePct: 20, strikeStaminaCostPct: -8 }, 'First reload each combat restores 10 Stamina.', EMPTY_COST, 'FIRST_RELOAD_STAMINA', 10),
    ],
  },
  'hex-pulse-rifle': {
    id: 'hex-pulse-rifle',
    classId: 'HEX_SHOT',
    name: 'Ash Shotgun',
    shortName: 'Ash Shotgun',
    description: 'Ash Shotgun — multi-target pressure and reload tempo.',
    flavorText: 'Recovered encrypted tech lattice. Spread pattern favors clustered frontliners over precision.',
    role: 'Close-range AoE / crowd clear',
    tags: ['BALLISTIC', 'RANGED', 'AMMO', 'RELOAD', 'SUSTAINED'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'encrypted-grid-drive', quantity: 3 },
      { resourceId: 'rail-capacitor', quantity: 2 },
      { resourceId: 'containment-seal', quantity: 1 },
      { resourceId: 'nullcrete-shard', quantity: 4 },
    ],
    uiSummary: 'Spread basic — crowd clear, poor backline, frequent reload.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Ash Shotgun I', { magazineSizeBonus: -1, ballisticDamagePct: -5 }, 'Tighter magazine; spread-pattern basic; slight per-pellet trade.', [
        { resourceId: 'rail-capacitor', quantity: 2 },
        { resourceId: 'encrypted-grid-drive', quantity: 1 },
      ]),
      tier(2, 'Ash Shotgun II', { magazineSizeBonus: -1, ballisticDamagePct: 0 }, 'Improved spread damage with same reload pressure.', [
        { resourceId: 'rail-capacitor', quantity: 3 },
        { resourceId: 'encrypted-grid-drive', quantity: 2 },
      ]),
      tier(3, 'Ash Shotgun III', { magazineSizeBonus: 0, ballisticDamagePct: 5 }, 'After reloading, next Ballistic attack deals +10% damage.', EMPTY_COST, 'POST_RELOAD_BALLISTIC_DAMAGE', 10),
    ],
  },
  'hex-void-cannon': {
    id: 'hex-void-cannon',
    classId: 'HEX_SHOT',
    name: 'Nullbreach',
    shortName: 'Nullbreach',
    description: 'Nullbreach — high burst, low magazine, armor interaction.',
    flavorText: 'Dangerous single-shot lattice. Pierces armored hostiles at risky tempo.',
    role: 'Armor-breach single-target burst',
    tags: ['BALLISTIC', 'RANGED', 'VOID_AMMO', 'HEAVY', 'ARMOR_PIERCE'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'encrypted-grid-drive', quantity: 1 },
      { resourceId: 'combustion-cylinder', quantity: 2 },
      { resourceId: 'rail-capacitor', quantity: 1 },
      { resourceId: 'breach-thread', quantity: 1 },
    ],
    uiSummary: 'Breach weapon — small mag, armor pressure, weak crowds.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Nullbreach I', { magazineSizeBonus: -2, ballisticDamagePct: 20, armorPierceLayers: 1, strikeStaminaCostPct: 10 }, 'Lower magazine; higher damage; pierces 1 armor layer.', [
        { resourceId: 'cinder-wire', quantity: 3 },
        { resourceId: 'combustion-cylinder', quantity: 1 },
      ]),
      tier(2, 'Nullbreach II', { magazineSizeBonus: -2, ballisticDamagePct: 28, armorPierceLayers: 1, strikeStaminaCostPct: 8 }, 'Improved damage and armor interaction.', [
        { resourceId: 'rail-capacitor', quantity: 2 },
        { resourceId: 'combustion-cylinder', quantity: 2 },
        { resourceId: 'encrypted-grid-drive', quantity: 1 },
      ]),
      tier(3, 'Nullbreach III', { magazineSizeBonus: -2, ballisticDamagePct: 32, armorPierceLayers: 1, strikeStaminaCostPct: 8 }, 'First hit vs armored enemy removes 1 additional armor.', EMPTY_COST, 'FIRST_ARMORED_HIT_EXTRA_ARMOR_STRIP', 1),
    ],
  },
  'envoy-null-conduit': {
    id: 'envoy-null-conduit',
    classId: 'ENVOY',
    name: 'Scythe',
    shortName: 'Scythe',
    description: 'Occult scythe — stable occult output and resource flow.',
    flavorText: 'Agency-issue focusing scythe. Reliable occult throughput for field casters.',
    role: 'Clean Flux / Catalyst specialist',
    tags: ['OCCULT', 'RANGED', 'BALANCED', 'RESOURCE'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'echo-glass-shard', quantity: 8 },
      { resourceId: 'resonant-filament', quantity: 3 },
      { resourceId: 'encrypted-grid-drive', quantity: 1 },
      { resourceId: 'sanguine-ampoule', quantity: 1 },
    ],
    uiSummary: 'Clean Flux cycle — stable Catalyst sequencing.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Scythe I', {}, 'Baseline occult damage and Veil-Flux generation.', [
        { resourceId: 'nullcrete-shard', quantity: 4 },
        { resourceId: 'echo-glass-shard', quantity: 3 },
      ]),
      tier(2, 'Scythe II', { occultDamagePct: 10, veilFluxGainPct: 8 }, '+10% occult damage; +8% Veil-Flux generation.', [
        { resourceId: 'mycelial-ichor', quantity: 2 },
        { resourceId: 'sanguine-ampoule', quantity: 1 },
      ]),
      tier(3, 'Scythe III', { occultDamagePct: 18, veilFluxGainPct: 12 }, 'First Occult ability each combat generates +5 Veil-Flux.', EMPTY_COST, 'FIRST_OCCULT_RESOURCE_BONUS', 5),
    ],
  },
  'envoy-sanguine-prism': {
    id: 'envoy-sanguine-prism',
    classId: 'ENVOY',
    name: "Heart's Due",
    shortName: 'Heart',
    description: 'Floating blood focus — converts blood into Veil power at elevated risk.',
    flavorText: 'Blood-for-power exchange. Rewards sacrifice without runaway healing loops.',
    role: 'Sacrifice / Brink',
    tags: ['OCCULT', 'SACRIFICE', 'RESOURCE', 'HIGH_RISK'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'sanguine-ampoule', quantity: 3 },
      { resourceId: 'mycelial-ichor', quantity: 1 },
      { resourceId: 'ossified-ley-knot', quantity: 2 },
    ],
    uiSummary: 'Brink caster — capped HP sacrifice near low Flux.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, "Heart's Due I", { occultDamagePct: 10, sacrificeResourceBonus: 5, healReceivedPct: -10 }, '+10% occult; sacrifice generates extra Veil-Flux; −10% healing received.', [
        { resourceId: 'sanguine-ampoule', quantity: 2 },
        { resourceId: 'echo-glass-shard', quantity: 4 },
      ]),
      tier(2, "Heart's Due II", { occultDamagePct: 15, sacrificeResourceBonus: 8, healReceivedPct: -10 }, 'Improved resource return from sacrifice.', [
        { resourceId: 'sanguine-ampoule', quantity: 3 },
        { resourceId: 'ossified-ley-knot', quantity: 1 },
      ]),
      tier(3, "Heart's Due III", { occultDamagePct: 20, sacrificeResourceBonus: 10, healReceivedPct: -10 }, 'Once per combat, paying HP for an ability grants +10 Veil-Flux.', EMPTY_COST, 'SACRIFICE_HP_RESOURCE_BONUS', 10),
    ],
  },
  'envoy-echo-lantern': {
    id: 'envoy-echo-lantern',
    classId: 'ENVOY',
    name: 'Vambrace',
    shortName: 'Vambrace',
    description: 'Hand/forearm curseweave — control and debuff synergy over raw damage.',
    flavorText: 'Crystallized runner echoes bound to the forearm. Support and control doctrine.',
    role: 'Starter / Rot / curse / detonation',
    tags: ['OCCULT', 'ECHO', 'CONTROL', 'DEBUFF'],
    startingUnlocked: true,
    unlockRequirement: EMPTY_COST,
    uiSummary: 'Rot setup — delay detonation for board payoff.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Vambrace I', { occultDamagePct: -5, debuffDurationPct: 15 }, 'Debuffs last 15% longer; slightly reduced raw damage.', [
        { resourceId: 'echo-glass-shard', quantity: 6 },
        { resourceId: 'sanguine-ampoule', quantity: 1 },
      ]),
      tier(2, 'Vambrace II', { occultDamagePct: -3, debuffDurationPct: 22 }, 'Improved control and debuff bonus.', [
        { resourceId: 'echo-glass-shard', quantity: 12 },
        { resourceId: 'encrypted-grid-drive', quantity: 1 },
        { resourceId: 'sanguine-ampoule', quantity: 1 },
      ]),
      tier(3, 'Vambrace III', { occultDamagePct: 0, debuffDurationPct: 25 }, 'First debuff applied each combat grants +1 temporary ward.', EMPTY_COST, 'FIRST_DEBUFF_WARD', 1),
    ],
  },
};

export function isWeaponFamilyId(id: string): id is WeaponFamilyId {
  return id in WEAPON_REGISTRY;
}

export function getWeaponFamily(id: WeaponFamilyId): WeaponFamilyDefinition {
  return WEAPON_REGISTRY[id];
}

export function listWeaponFamiliesForClass(classId: ClassType): WeaponFamilyDefinition[] {
  return ALL_WEAPON_FAMILY_IDS
    .map((id) => WEAPON_REGISTRY[id])
    .filter((def) => def.classId === classId);
}

export function getStarterWeaponForClass(classId: ClassType): WeaponFamilyId {
  return STARTER_WEAPON_BY_CLASS[classId];
}
