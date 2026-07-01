/** @deprecated Prefer CARGO_GRID_ROWS / CARGO_GRID_COLS — kept for legacy square checks. */
export const CARGO_GRID_DIMENSION = 4;
export const CARGO_GRID_ROWS = 4;
export const CARGO_GRID_COLS = 3;
export const CARGO_GRID_CELL_COUNT = CARGO_GRID_ROWS * CARGO_GRID_COLS;
export const CARGO_OCCUPANCY_RESONANCE_THRESHOLD = 0.7;
export const CARGO_RESONANCE_MULTIPLIER = 2;
export const DATA_BLEED_VALUE_DRAIN_PCT = 5;

export type CargoCombatEffect =
  | 'heal'
  | 'stun'
  | 'max_fracture'
  | 'stamina_ap_surge'
  | 'shatter_armor'
  | 'strip_wards'
  | 'clear_debuffs'
  | 'max_abyssal'
  | 'absorb_hit'
  | 'spectral_imbue'
  | 'sanguine_coagulant'
  | 'veil_ash_grenade'
  | 'god_mode'
  | 'unimplemented';

import type { ResourceItemId } from './resourceItem';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from '../data/resourceRegistry';

export type LegacyCargoItemId =
  | 'null-crystal-shard'
  | 'null-crystal-matrix'
  | 'veil-residue-bulk'
  | 'gravity-grapple'
  | 'focusing-ampoule'
  | 'rift-iron-cache'
  | 'soul-core'
  | 'veil-shard'
  | 'target-fragment'
  | 'spectral-salt'
  | 'grave-dust-ampoule'
  | 'grid-cracker-mag'
  | 'eclipse-flare'
  | 'coagulation-stitch'
  | 'dead-drop-token'
  | 'resonance-bribe'
  | 'spall-weave-vest'
  | 'void-surge-catalyst'
  | 'sanguine-coagulant'
  | 'veil-ash-grenade'
  | 'kinetic-hollow-points'
  | 'sonar-ping'
  | 'smoke-ampoule'
  | 'null-key'
  | 'hazmat-shielding'
  | 'god-mode';

export type CargoItemId = LegacyCargoItemId | ResourceItemId;

export type HarvestYieldTier = 'QUICK' | 'FULL' | 'DEEP_GORE';

export type HarvestReturnRoute = 'POST_COMBAT' | 'COMPLETE_NODE' | 'RESOURCE_CACHE';

export interface CargoItemDefinition {
  id: CargoItemId;
  name: string;
  width: number;
  height: number;
  baseValue: number;
  resonanceWeight: number;
  tags: string[];
  usableOnScanner?: boolean;
  usableInCombat?: boolean;
  combatEffect?: CargoCombatEffect;
  /** Percent of max Soul Anchor restored — heal combat items only. */
  healPercent?: number;
  /** AP deducted when deployed during combat (defaults to 2). */
  apCost?: number;
}

export interface PlacedCargoItem {
  instanceId: string;
  itemId: CargoItemId;
  originRow: number;
  originCol: number;
  currentValue: number;
  /** Black market visit — staged on grid, not charged until bind. */
  blackMarketStaged?: boolean;
}

export interface ContainmentItem {
  instanceId: string;
  itemId: CargoItemId;
  /** Eroded by DATA_BLEED; defaults to catalog baseValue when unset. */
  currentValue?: number;
}

export interface CargoGridState {
  placed: PlacedCargoItem[];
}

export interface CargoRunState {
  grid: CargoGridState;
  containment: ContainmentItem[];
  dataBleedActive: boolean;
}

/** Persistent cabal vault — survives district transitions and hub returns. */
export interface GlobalBankedCargo {
  totalValue: number;
  lastTransferValue: number;
}

export function createDefaultBankedCargo(): GlobalBankedCargo {
  return { totalValue: 0, lastTransferValue: 0 };
}

export interface HarvestYieldOption {
  tier: HarvestYieldTier;
  label: string;
  yieldPct: number;
  resonanceSpike: number;
  ambushRiskPct: number;
  description: string;
}

export const HARVEST_YIELD_OPTIONS: HarvestYieldOption[] = [
  {
    tier: 'QUICK',
    label: 'QUICK SIPHON',
    yieldPct: 50,
    resonanceSpike: 3,
    ambushRiskPct: 0,
    description: 'Low noise extraction — 50% yield.',
  },
  {
    tier: 'FULL',
    label: 'FULL EXTRACTION',
    yieldPct: 75,
    resonanceSpike: 8,
    ambushRiskPct: 0,
    description: 'Standard ritual pull — 75% yield.',
  },
  {
    tier: 'DEEP_GORE',
    label: 'DEEP GORE',
    yieldPct: 100,
    resonanceSpike: 8,
    ambushRiskPct: 0,
    description: 'Violent tear — 100% yield.',
  },
];

function buildResourceCargoCatalogEntries(): Record<ResourceItemId, CargoItemDefinition> {
  const entries = {} as Record<ResourceItemId, CargoItemDefinition>;
  ALL_RESOURCE_ITEM_IDS.forEach((id) => {
    const resource = RESOURCE_REGISTRY[id];
    entries[id] = {
      id,
      name: resource.name,
      width: resource.gridWidth,
      height: resource.gridHeight,
      baseValue: resource.baseCapitalValue,
      resonanceWeight: 1,
      tags: ['RESOURCE', resource.itemType],
    };
  });
  return entries;
}

export const CARGO_ITEM_CATALOG: Record<CargoItemId, CargoItemDefinition> = {
  'null-crystal-shard': {
    id: 'null-crystal-shard',
    name: 'Null Crystal Shard',
    width: 1,
    height: 1,
    baseValue: 40,
    resonanceWeight: 1,
    tags: ['LOOT', 'CRYSTAL'],
  },
  'null-crystal-matrix': {
    id: 'null-crystal-matrix',
    name: 'Null Crystal Matrix',
    width: 2,
    height: 2,
    baseValue: 180,
    resonanceWeight: 3,
    tags: ['LOOT', 'CRYSTAL', 'MATRIX'],
  },
  'veil-residue-bulk': {
    id: 'veil-residue-bulk',
    name: 'Veil Residue',
    width: 1,
    height: 1,
    baseValue: 120,
    resonanceWeight: 4,
    tags: ['LOOT', 'BULK', 'VOLATILE'],
  },
  'gravity-grapple': {
    id: 'gravity-grapple',
    name: 'Gravity Grapple',
    width: 1,
    height: 1,
    baseValue: 65,
    resonanceWeight: 1,
    tags: ['TOOL', 'GRAVITY_GRAPPLE'],
  },
  'focusing-ampoule': {
    id: 'focusing-ampoule',
    name: 'Focusing Ampoule',
    width: 1,
    height: 1,
    baseValue: 55,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'ATTUNEMENT'],
    usableOnScanner: true,
  },
  'rift-iron-cache': {
    id: 'rift-iron-cache',
    name: 'Rift Iron Cache',
    width: 1,
    height: 1,
    baseValue: 35,
    resonanceWeight: 1,
    tags: ['LOOT', 'METAL'],
  },
  'soul-core': {
    id: 'soul-core',
    name: 'Soul Core',
    width: 1,
    height: 1,
    baseValue: 80,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'HEAL'],
    usableInCombat: true,
    combatEffect: 'heal',
    healPercent: 50,
  },
  'veil-shard': {
    id: 'veil-shard',
    name: 'Veil Shard',
    width: 1,
    height: 1,
    baseValue: 70,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'STUN'],
    usableInCombat: true,
    combatEffect: 'stun',
  },
  'target-fragment': {
    id: 'target-fragment',
    name: 'Target Fragment',
    width: 1,
    height: 1,
    baseValue: 45,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT'],
    usableInCombat: true,
    combatEffect: 'unimplemented',
  },
  'spectral-salt': {
    id: 'spectral-salt',
    name: 'Spectral Salt',
    width: 1,
    height: 1,
    baseValue: 50,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'WEAPON_IMBUE', 'SPECTRAL'],
    usableInCombat: true,
    combatEffect: 'spectral_imbue',
  },
  'grave-dust-ampoule': {
    id: 'grave-dust-ampoule',
    name: 'Grave-Dust Ampoule',
    width: 1,
    height: 1,
    baseValue: 90,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'STIM'],
    usableInCombat: true,
    combatEffect: 'stamina_ap_surge',
  },
  'grid-cracker-mag': {
    id: 'grid-cracker-mag',
    name: 'Grid-Cracker Mag',
    width: 1,
    height: 1,
    baseValue: 70,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'BREACH'],
    usableInCombat: true,
    combatEffect: 'shatter_armor',
  },
  'eclipse-flare': {
    id: 'eclipse-flare',
    name: 'Eclipse Flare',
    width: 1,
    height: 1,
    baseValue: 70,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'BREACH'],
    usableInCombat: true,
    combatEffect: 'strip_wards',
  },
  'coagulation-stitch': {
    id: 'coagulation-stitch',
    name: 'Coagulation Stitch',
    width: 1,
    height: 1,
    baseValue: 55,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'HEAL'],
    usableInCombat: true,
    combatEffect: 'clear_debuffs',
    healPercent: 10,
  },
  'dead-drop-token': {
    id: 'dead-drop-token',
    name: 'Dead-Drop Token',
    width: 1,
    height: 1,
    baseValue: 200,
    resonanceWeight: 1,
    tags: ['TOOL', 'EXTRACT'],
    usableOnScanner: true,
  },
  'resonance-bribe': {
    id: 'resonance-bribe',
    name: 'Resonance Bribe',
    width: 1,
    height: 1,
    baseValue: 180,
    resonanceWeight: 1,
    tags: ['TOOL', 'RESONANCE'],
    usableOnScanner: true,
  },
  'spall-weave-vest': {
    id: 'spall-weave-vest',
    name: 'Spall-Weave Vest',
    width: 1,
    height: 1,
    baseValue: 95,
    resonanceWeight: 2,
    tags: ['CONSUMABLE', 'COMBAT', 'SHIELD'],
    usableInCombat: true,
    combatEffect: 'absorb_hit',
  },
  'void-surge-catalyst': {
    id: 'void-surge-catalyst',
    name: 'Void-Surge Catalyst',
    width: 1,
    height: 1,
    baseValue: 160,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'ULTIMATE'],
    usableInCombat: true,
    combatEffect: 'max_abyssal',
  },
  'sanguine-coagulant': {
    id: 'sanguine-coagulant',
    name: 'Sanguine Coagulant',
    width: 1,
    height: 1,
    baseValue: 85,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'HEAL', 'DEBUFF_PURGE'],
    usableInCombat: true,
    combatEffect: 'sanguine_coagulant',
    healPercent: 50,
  },
  'veil-ash-grenade': {
    id: 'veil-ash-grenade',
    name: 'Veil-Ash Grenade',
    width: 1,
    height: 1,
    baseValue: 75,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'CROWD_CONTROL'],
    usableInCombat: true,
    combatEffect: 'veil_ash_grenade',
  },
  'kinetic-hollow-points': {
    id: 'kinetic-hollow-points',
    name: 'Veil-Vial',
    width: 1,
    height: 1,
    baseValue: 48,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'COMBAT', 'DAMAGE_BUFF'],
    usableInCombat: true,
    combatEffect: 'unimplemented',
  },
  'sonar-ping': {
    id: 'sonar-ping',
    name: 'Sonar-Ping',
    width: 1,
    height: 1,
    baseValue: 40,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'SCANNER', 'EXTRACTION'],
    usableOnScanner: true,
    usableInCombat: false,
    combatEffect: 'unimplemented',
  },
  'god-mode': {
    id: 'god-mode',
    name: 'God Mode',
    width: 1,
    height: 1,
    baseValue: 0,
    resonanceWeight: 0,
    tags: ['CONSUMABLE', 'COMBAT', 'DEBUG'],
    usableInCombat: true,
    combatEffect: 'god_mode',
    apCost: 0,
  },
  'smoke-ampoule': {
    id: 'smoke-ampoule',
    name: 'Smoke Ampoule',
    width: 1,
    height: 1,
    baseValue: 60,
    resonanceWeight: 1,
    tags: ['CONSUMABLE', 'NARRATIVE', 'OBSCURE'],
  },
  'null-key': {
    id: 'null-key',
    name: 'Null-Key',
    width: 1,
    height: 1,
    baseValue: 85,
    resonanceWeight: 1,
    tags: ['TOOL', 'NARRATIVE', 'BREACH'],
  },
  'hazmat-shielding': {
    id: 'hazmat-shielding',
    name: 'Hazmat Shielding',
    width: 1,
    height: 2,
    baseValue: 110,
    resonanceWeight: 2,
    tags: ['CONSUMABLE', 'NARRATIVE', 'SHIELD'],
  },
  ...buildResourceCargoCatalogEntries(),
};

export function createDefaultCargoRunState(): CargoRunState {
  return {
    grid: { placed: [] },
    containment: [],
    dataBleedActive: false,
  };
}
