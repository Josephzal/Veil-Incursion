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
  ENVOY: 'envoy-null-conduit',
};

export const WEAPON_REGISTRY: Record<WeaponFamilyId, WeaponFamilyDefinition> = {
  'aegis-runed-longsword': {
    id: 'aegis-runed-longsword',
    classId: 'AEGIS',
    name: 'Runed Longsword',
    shortName: 'Longsword',
    description: 'Reliable supernatural blade — balanced damage, fracture, and Reserve generation.',
    flavorText: 'Agency-standard rune etching. For operatives learning the Aegis rhythm.',
    role: 'Balanced starter',
    tags: ['MELEE', 'KINETIC', 'BALANCED', 'FRACTURE'],
    startingUnlocked: true,
    unlockRequirement: EMPTY_COST,
    uiSummary: 'Baseline melee — reliable fracture and Reserve flow.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Runed Longsword I', {}, 'Baseline melee damage, fracture, and Reserve generation.', [
        { resourceId: 'ley-slag', quantity: 5 },
        { resourceId: 'echo-glass-shard', quantity: 3 },
      ]),
      tier(2, 'Runed Longsword II', { strikeDamagePct: 10, fractureFromMeleePct: 10 }, '+10% melee damage and fracture.', [
        { resourceId: 'ley-slag', quantity: 8 },
        { resourceId: 'legion-blood-iron', quantity: 1 },
      ]),
      tier(3, 'Runed Longsword III', { strikeDamagePct: 18, fractureFromMeleePct: 15 }, 'First melee hit each combat generates +5 Abyssal Reserve.', EMPTY_COST, 'FIRST_MELEE_RESERVE_BONUS', 5),
    ],
  },
  'aegis-claymore-blade': {
    id: 'aegis-claymore-blade',
    classId: 'AEGIS',
    name: 'Claymore-Blade',
    shortName: 'Claymore',
    description: 'Brutal oversized blade — higher damage and fracture at elevated stamina cost.',
    flavorText: 'Legion-forged mass transfer lattice for breaking armored Veil entities.',
    role: 'Heavy fracture',
    tags: ['MELEE', 'KINETIC', 'HEAVY', 'FRACTURE'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'legion-blood-iron', quantity: 3 },
      { resourceId: 'ley-slag', quantity: 5 },
    ],
    uiSummary: 'Heavy melee — big fracture, higher stamina draw.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Claymore-Blade I', { strikeDamagePct: 15, fractureFromMeleePct: 20, strikeStaminaCostPct: 10 }, '+15% damage, +20% fracture, +10% stamina cost.', [
        { resourceId: 'ley-slag', quantity: 5 },
        { resourceId: 'legion-blood-iron', quantity: 1 },
      ]),
      tier(2, 'Claymore-Blade II', { strikeDamagePct: 22, fractureFromMeleePct: 28, strikeStaminaCostPct: 10 }, 'Improved damage and fracture.', [
        { resourceId: 'ley-slag', quantity: 8 },
        { resourceId: 'legion-blood-iron', quantity: 2 },
      ]),
      tier(3, 'Claymore-Blade III', { strikeDamagePct: 25, fractureFromMeleePct: 32, strikeStaminaCostPct: 10 }, 'First Fracture each combat restores 15 Stamina.', EMPTY_COST, 'FIRST_FRACTURE_STAMINA_REFUND', 15),
    ],
  },
  'aegis-rift-edge': {
    id: 'aegis-rift-edge',
    classId: 'AEGIS',
    name: 'Rift Edge',
    shortName: 'Rift Edge',
    description: 'Thin Veil-edge katana — crit and Reserve over raw kinetic output.',
    flavorText: 'Cuts along the membrane between worlds. Occult resonance over brute force.',
    role: 'Fast crit / occult hybrid',
    tags: ['MELEE', 'OCCULT', 'FAST', 'CRIT', 'RESOURCE'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'ossified-ley-knot', quantity: 2 },
      { resourceId: 'echo-glass-shard', quantity: 8 },
    ],
    uiSummary: 'Fast blade — Reserve and crit over fracture.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Rift Edge I', { strikeDamagePct: -5, reserveGainFlat: 3, critChancePct: 5 }, 'Melee generates extra Reserve; reduced kinetic damage; +5% crit.', [
        { resourceId: 'echo-glass-shard', quantity: 6 },
        { resourceId: 'sanguine-ampoule', quantity: 1 },
      ]),
      tier(2, 'Rift Edge II', { strikeDamagePct: -3, reserveGainFlat: 5, critChancePct: 8 }, 'Improved crit and Reserve bonuses.', [
        { resourceId: 'echo-glass-shard', quantity: 10 },
        { resourceId: 'ossified-ley-knot', quantity: 1 },
      ]),
      tier(3, 'Rift Edge III', { strikeDamagePct: -3, reserveGainFlat: 5, critChancePct: 10 }, 'Melee crits generate +5 additional Reserve.', EMPTY_COST, 'MELEE_CRIT_RESERVE_BONUS', 5),
    ],
  },
  'hex-silver-core-sidearm': {
    id: 'hex-silver-core-sidearm',
    classId: 'HEX_SHOT',
    name: 'Silver-Core Sidearm',
    shortName: 'Sidearm',
    description: 'Reliable warded pistol — consistent ballistic damage and manageable ammo.',
    flavorText: 'Terran Grid warded sidearm. The Riftshot operative\'s default field piece.',
    role: 'Balanced starter firearm',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'BALANCED', 'AMMO'],
    startingUnlocked: true,
    unlockRequirement: EMPTY_COST,
    uiSummary: 'Baseline sidearm — normal magazine and reload tempo.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Silver-Core Sidearm I', {}, 'Baseline sidearm stats.', [
        { resourceId: 'ley-slag', quantity: 5 },
        { resourceId: 'echo-glass-shard', quantity: 3 },
      ]),
      tier(2, 'Silver-Core Sidearm II', { ballisticDamagePct: 10, strikeStaminaCostPct: -5 }, '+10% ballistic damage; smoother reload stamina.', [
        { resourceId: 'ley-slag', quantity: 8 },
        { resourceId: 'encrypted-grid-drive', quantity: 1 },
      ]),
      tier(3, 'Silver-Core Sidearm III', { ballisticDamagePct: 15, strikeStaminaCostPct: -8 }, 'First reload each combat restores 10 Stamina.', EMPTY_COST, 'FIRST_RELOAD_STAMINA', 10),
    ],
  },
  'hex-pulse-rifle': {
    id: 'hex-pulse-rifle',
    classId: 'HEX_SHOT',
    name: 'Pulse Rifle',
    shortName: 'Pulse Rifle',
    description: 'Terran Grid pulse rifle — larger magazine, sustained fire identity.',
    flavorText: 'Recovered encrypted tech lattice. Rewards reload and ammo economy.',
    role: 'Sustained fire',
    tags: ['BALLISTIC', 'RANGED', 'AMMO', 'RELOAD', 'SUSTAINED'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'encrypted-grid-drive', quantity: 3 },
      { resourceId: 'ley-slag', quantity: 10 },
    ],
    uiSummary: 'Extended magazine — sustained ballistic tempo.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Pulse Rifle I', { magazineSizeBonus: 2, ballisticDamagePct: -5 }, '+2 magazine; slight per-shot damage trade.', [
        { resourceId: 'ley-slag', quantity: 5 },
        { resourceId: 'encrypted-grid-drive', quantity: 1 },
      ]),
      tier(2, 'Pulse Rifle II', { magazineSizeBonus: 3, ballisticDamagePct: -3 }, 'Improved magazine and reload efficiency.', [
        { resourceId: 'ley-slag', quantity: 10 },
        { resourceId: 'encrypted-grid-drive', quantity: 2 },
      ]),
      tier(3, 'Pulse Rifle III', { magazineSizeBonus: 3, ballisticDamagePct: 0 }, 'After reloading, next Ballistic attack deals +10% damage.', EMPTY_COST, 'POST_RELOAD_BALLISTIC_DAMAGE', 10),
    ],
  },
  'hex-void-cannon': {
    id: 'hex-void-cannon',
    classId: 'HEX_SHOT',
    name: 'Nullbreach Carbine',
    shortName: 'Void Cannon',
    description: 'Compressed Veil matter carbine — high burst, low magazine, armor interaction.',
    flavorText: 'Dangerous single-shot lattice. Pierces armored hostiles at risky tempo.',
    role: 'Heavy armor-piercing',
    tags: ['BALLISTIC', 'RANGED', 'VOID_AMMO', 'HEAVY', 'ARMOR_PIERCE'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'encrypted-grid-drive', quantity: 1 },
      { resourceId: 'combustion-cylinder', quantity: 2 },
      { resourceId: 'ley-slag', quantity: 5 },
    ],
    uiSummary: 'Burst carbine — armor pierce, tight magazine.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Nullbreach Carbine I', { magazineSizeBonus: -2, ballisticDamagePct: 20, armorPierceLayers: 1, strikeStaminaCostPct: 10 }, 'Lower magazine; higher damage; pierces 1 armor layer.', [
        { resourceId: 'ley-slag', quantity: 5 },
        { resourceId: 'combustion-cylinder', quantity: 1 },
      ]),
      tier(2, 'Nullbreach Carbine II', { magazineSizeBonus: -2, ballisticDamagePct: 28, armorPierceLayers: 1, strikeStaminaCostPct: 8 }, 'Improved damage and armor interaction.', [
        { resourceId: 'ley-slag', quantity: 8 },
        { resourceId: 'combustion-cylinder', quantity: 2 },
        { resourceId: 'encrypted-grid-drive', quantity: 1 },
      ]),
      tier(3, 'Nullbreach Carbine III', { magazineSizeBonus: -2, ballisticDamagePct: 32, armorPierceLayers: 1, strikeStaminaCostPct: 8 }, 'First hit vs armored enemy removes 1 additional armor.', EMPTY_COST, 'FIRST_ARMORED_HIT_EXTRA_ARMOR_STRIP', 1),
    ],
  },
  'envoy-null-conduit': {
    id: 'envoy-null-conduit',
    classId: 'ENVOY',
    name: 'Null Conduit',
    shortName: 'Null Conduit',
    description: 'Controlled Veil focusing device — stable occult output and resource flow.',
    flavorText: 'Agency-issue conduit. Reliable occult throughput for field casters.',
    role: 'Balanced starter conduit',
    tags: ['OCCULT', 'RANGED', 'BALANCED', 'RESOURCE'],
    startingUnlocked: true,
    unlockRequirement: EMPTY_COST,
    uiSummary: 'Baseline occult weapon — stable Veil-Flux generation.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Null Conduit I', {}, 'Baseline occult damage and Veil-Flux generation.', [
        { resourceId: 'ley-slag', quantity: 5 },
        { resourceId: 'echo-glass-shard', quantity: 3 },
      ]),
      tier(2, 'Null Conduit II', { occultDamagePct: 10, veilFluxGainPct: 8 }, '+10% occult damage; +8% Veil-Flux generation.', [
        { resourceId: 'ley-slag', quantity: 8 },
        { resourceId: 'sanguine-ampoule', quantity: 1 },
      ]),
      tier(3, 'Null Conduit III', { occultDamagePct: 18, veilFluxGainPct: 12 }, 'First Occult ability each combat generates +5 Veil-Flux.', EMPTY_COST, 'FIRST_OCCULT_RESOURCE_BONUS', 5),
    ],
  },
  'envoy-sanguine-prism': {
    id: 'envoy-sanguine-prism',
    classId: 'ENVOY',
    name: 'Sanguine Prism',
    shortName: 'Sanguine Prism',
    description: 'Solaris ritual prism — converts blood into Veil power at elevated risk.',
    flavorText: 'Blood-for-power exchange. Rewards sacrifice without runaway healing loops.',
    role: 'Sacrifice / high risk',
    tags: ['OCCULT', 'SACRIFICE', 'RESOURCE', 'HIGH_RISK'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'sanguine-ampoule', quantity: 3 },
      { resourceId: 'ossified-ley-knot', quantity: 2 },
    ],
    uiSummary: 'Sacrifice caster — extra resource from HP costs.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Sanguine Prism I', { occultDamagePct: 10, sacrificeResourceBonus: 5, healReceivedPct: -10 }, '+10% occult; sacrifice generates extra Veil-Flux; −10% healing received.', [
        { resourceId: 'sanguine-ampoule', quantity: 2 },
        { resourceId: 'echo-glass-shard', quantity: 4 },
      ]),
      tier(2, 'Sanguine Prism II', { occultDamagePct: 15, sacrificeResourceBonus: 8, healReceivedPct: -10 }, 'Improved resource return from sacrifice.', [
        { resourceId: 'sanguine-ampoule', quantity: 3 },
        { resourceId: 'ossified-ley-knot', quantity: 1 },
      ]),
      tier(3, 'Sanguine Prism III', { occultDamagePct: 20, sacrificeResourceBonus: 10, healReceivedPct: -10 }, 'Once per combat, paying HP for an ability grants +10 Veil-Flux.', EMPTY_COST, 'SACRIFICE_HP_RESOURCE_BONUS', 10),
    ],
  },
  'envoy-echo-lantern': {
    id: 'envoy-echo-lantern',
    classId: 'ENVOY',
    name: 'Echo Lantern',
    shortName: 'Echo Lantern',
    description: 'Crystallized runner echoes — control and debuff synergy over raw damage.',
    flavorText: 'Lantern filled with crystallized runner echoes. Support and control doctrine.',
    role: 'Control / Echo',
    tags: ['OCCULT', 'ECHO', 'CONTROL', 'DEBUFF'],
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'echo-glass-shard', quantity: 12 },
      { resourceId: 'encrypted-grid-drive', quantity: 1 },
      { resourceId: 'sanguine-ampoule', quantity: 1 },
    ],
    uiSummary: 'Control caster — stronger debuffs, lighter raw output.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Future masterwork — requires Anomalous Core.',
    tiers: [
      tier(1, 'Echo Lantern I', { occultDamagePct: -5, debuffDurationPct: 15 }, 'Debuffs last 15% longer; slightly reduced raw damage.', [
        { resourceId: 'echo-glass-shard', quantity: 6 },
        { resourceId: 'sanguine-ampoule', quantity: 1 },
      ]),
      tier(2, 'Echo Lantern II', { occultDamagePct: -3, debuffDurationPct: 22 }, 'Improved control and debuff bonus.', [
        { resourceId: 'echo-glass-shard', quantity: 12 },
        { resourceId: 'encrypted-grid-drive', quantity: 1 },
        { resourceId: 'sanguine-ampoule', quantity: 1 },
      ]),
      tier(3, 'Echo Lantern III', { occultDamagePct: 0, debuffDurationPct: 25 }, 'First debuff applied each combat grants +1 temporary ward.', EMPTY_COST, 'FIRST_DEBUFF_WARD', 1),
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
