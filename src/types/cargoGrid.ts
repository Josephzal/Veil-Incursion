export const CARGO_GRID_DIMENSION = 4;
export const CARGO_OCCUPANCY_RESONANCE_THRESHOLD = 0.7;
export const CARGO_RESONANCE_MULTIPLIER = 2;
export const DATA_BLEED_VALUE_DRAIN_PCT = 5;

export type CargoCombatEffect = 'heal' | 'stun' | 'unimplemented';

export type CargoItemId =
  | 'null-crystal-shard'
  | 'null-crystal-matrix'
  | 'veil-residue-bulk'
  | 'gravity-grapple'
  | 'focusing-ampoule'
  | 'rift-iron-cache'
  | 'soul-core'
  | 'veil-shard'
  | 'target-fragment';

export type HarvestYieldTier = 'QUICK' | 'FULL' | 'DEEP_GORE';

export type HarvestReturnRoute = 'POST_COMBAT' | 'COMPLETE_NODE';

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
}

export interface PlacedCargoItem {
  instanceId: string;
  itemId: CargoItemId;
  originRow: number;
  originCol: number;
  currentValue: number;
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
    description: 'Low noise extraction — 50% yield, +3% resonance spike.',
  },
  {
    tier: 'FULL',
    label: 'FULL EXTRACTION',
    yieldPct: 75,
    resonanceSpike: 8,
    ambushRiskPct: 8,
    description: 'Standard ritual pull — 75% yield, +8% resonance spike.',
  },
  {
    tier: 'DEEP_GORE',
    label: 'DEEP GORE',
    yieldPct: 100,
    resonanceSpike: 8,
    ambushRiskPct: 25,
    description: 'Violent tear — 100% yield, +8% resonance spike, ambush risk.',
  },
];

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
    name: 'Veil Residue Bulk',
    width: 2,
    height: 2,
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
    healPercent: 25,
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
};

export function createDefaultCargoRunState(): CargoRunState {
  return {
    grid: { placed: [] },
    containment: [],
    dataBleedActive: false,
  };
}
