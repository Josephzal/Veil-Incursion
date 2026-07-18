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
  | 'standard-coagulant'
  | 'trauma-patch'
  | 'dead-drop-token'
  | 'resonance-bribe'
  | 'spall-weave-vest'
  | 'void-surge-catalyst'
  | 'sanguine-coagulant'
  | 'veil-ash-grenade'
  | 'kinetic-hollow-points'
  | 'sonar-ping'
  | 'rigged-combustion-cylinder'
  | 'mirror-salt-vial'
  | 'bloodwire-tourniquet'
  | 'null-space-injector'
  | 'black-iron-wedge'
  | 'razorwire-spool'
  | 'voidglass-decoy'
  | 'broker-flashcard'
  | 'relay-spike'
  | 'null-lens-filter'
  | 'ash-seal-canister'
  | 'containment-foam'
  | 'ley-slag-splitter'
  | 'echo-tuning-fork'
  | 'anchor-needle'
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
  /** Per-unit market value (DATA_BLEED erodes this). Total = currentValue × quantity. */
  currentValue: number;
  /** Stack size — defaults to 1 when unset (legacy saves / consumables). */
  quantity?: number;
  /** Black market visit — staged on grid, not charged until bind. */
  blackMarketStaged?: boolean;
}

export interface ContainmentItem {
  instanceId: string;
  itemId: CargoItemId;
  /** Eroded by DATA_BLEED; defaults to catalog baseValue when unset. Per-unit. */
  currentValue?: number;
  /** Stack size — defaults to 1 when unset (legacy saves / consumables). */
  quantity?: number;
}

export interface CargoGridState {
  placed: PlacedCargoItem[];
}

export interface OutsideCargoHook {
  instanceId: string;
  itemId: CargoItemId;
  currentValue: number;
  scent: number;
}

export interface CargoRunState {
  grid: CargoGridState;
  containment: ContainmentItem[];
  dataBleedActive: boolean;
  /** Bent Nail — 1×1 outside-cargo hook (lost first on dirty extraction). */
  outsideHook?: OutsideCargoHook | null;
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

function buildResourceCargoTags(resource: (typeof RESOURCE_REGISTRY)[ResourceItemId]): string[] {
  const tags: string[] = ['RESOURCE', resource.itemType];
  if (resource.category === 'UNSTABLE') {
    tags.push('UNSTABLE');
  }
  switch (resource.primaryRole) {
    case 'VOLATILE_CARGO':
      tags.push('VOLATILE');
      break;
    case 'APEX_CARGO':
      tags.push('APEX');
      break;
    case 'OCCULT_CARGO':
      tags.push('OCCULT');
      break;
    default:
      break;
  }
  return tags;
}

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
      tags: buildResourceCargoTags(resource),
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
    tags: ['CONSUMABLE', 'COMBAT', 'HEAL', 'LEGACY'],
    usableInCombat: true,
    combatEffect: 'clear_debuffs',
    healPercent: 10,
  },
  'standard-coagulant': {
    id: 'standard-coagulant',
    name: 'Standard Coagulant',
    width: 1,
    height: 1,
    baseValue: 45,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'CONSUMABLE', 'COMBAT', 'HEAL'],
    usableInCombat: true,
    combatEffect: 'heal',
    healPercent: 25,
    apCost: 0,
  },
  'trauma-patch': {
    id: 'trauma-patch',
    name: 'Trauma Patch',
    width: 1,
    height: 1,
    baseValue: 90,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'CONSUMABLE', 'COMBAT', 'HEAL'],
    usableInCombat: true,
    combatEffect: 'sanguine_coagulant',
    healPercent: 15,
    apCost: 0,
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
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'TOOL', 'SCANNER', 'EXTRACTION'],
    usableOnScanner: true,
    usableInCombat: false,
    combatEffect: 'unimplemented',
  },
  'rigged-combustion-cylinder': {
    id: 'rigged-combustion-cylinder',
    name: 'Rigged Combustion Cylinder',
    width: 1,
    height: 1,
    baseValue: 65,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'CONSUMABLE', 'COMBAT', 'AOE'],
    usableInCombat: true,
    combatEffect: 'unimplemented',
    apCost: 0,
  },
  'mirror-salt-vial': {
    id: 'mirror-salt-vial',
    name: 'Mirror-Salt Vial',
    width: 1,
    height: 1,
    baseValue: 130,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'CONSUMABLE', 'COMBAT', 'TEMPO'],
    usableInCombat: true,
    combatEffect: 'unimplemented',
    apCost: 0,
  },
  'bloodwire-tourniquet': {
    id: 'bloodwire-tourniquet',
    name: 'Bloodwire Tourniquet',
    width: 1,
    height: 1,
    baseValue: 125,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'CONSUMABLE', 'COMBAT', 'SURVIVAL'],
    usableInCombat: true,
    combatEffect: 'unimplemented',
    apCost: 0,
  },
  'null-space-injector': {
    id: 'null-space-injector',
    name: 'Null-Space Injector',
    width: 1,
    height: 1,
    baseValue: 125,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'CONSUMABLE', 'COMBAT', 'SURVIVAL'],
    usableInCombat: true,
    combatEffect: 'unimplemented',
    apCost: 0,
  },
  'black-iron-wedge': {
    id: 'black-iron-wedge',
    name: 'Black-Iron Wedge',
    width: 1,
    height: 1,
    baseValue: 100,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'CONSUMABLE', 'COMBAT', 'INTERRUPT'],
    usableInCombat: true,
    combatEffect: 'unimplemented',
    apCost: 0,
  },
  'razorwire-spool': {
    id: 'razorwire-spool',
    name: 'Razorwire Spool',
    width: 1,
    height: 1,
    baseValue: 95,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'CONSUMABLE', 'COMBAT', 'GRID_CONTROL'],
    usableInCombat: true,
    combatEffect: 'unimplemented',
    apCost: 0,
  },
  'voidglass-decoy': {
    id: 'voidglass-decoy',
    name: 'Voidglass Decoy',
    width: 1,
    height: 1,
    baseValue: 100,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'CONSUMABLE', 'COMBAT', 'SHIELD'],
    usableInCombat: true,
    combatEffect: 'unimplemented',
    apCost: 0,
  },
  'broker-flashcard': {
    id: 'broker-flashcard',
    name: 'Broker Flashcard',
    width: 1,
    height: 1,
    baseValue: 90,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'TOOL', 'MARKET'],
    usableOnScanner: false,
    usableInCombat: false,
  },
  'relay-spike': {
    id: 'relay-spike',
    name: 'Relay Spike',
    width: 1,
    height: 1,
    baseValue: 120,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'TOOL', 'SCANNER', 'ROUTE'],
    usableOnScanner: true,
    usableInCombat: false,
  },
  'null-lens-filter': {
    id: 'null-lens-filter',
    name: 'Null-Lens Filter',
    width: 1,
    height: 1,
    baseValue: 115,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'TOOL', 'SCANNER'],
    usableOnScanner: true,
    usableInCombat: false,
  },
  'ash-seal-canister': {
    id: 'ash-seal-canister',
    name: 'Ash-Seal Canister',
    width: 1,
    height: 1,
    baseValue: 100,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'TOOL', 'CARGO', 'UNSTABLE'],
  },
  'containment-foam': {
    id: 'containment-foam',
    name: 'Containment Foam',
    width: 1,
    height: 1,
    baseValue: 120,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'TOOL', 'CARGO', 'SURVIVAL'],
  },
  'ley-slag-splitter': {
    id: 'ley-slag-splitter',
    name: 'Ley-Slag Splitter',
    width: 1,
    height: 1,
    baseValue: 110,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'TOOL', 'RESOURCE'],
  },
  'echo-tuning-fork': {
    id: 'echo-tuning-fork',
    name: 'Echo Tuning Fork',
    width: 1,
    height: 1,
    baseValue: 105,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'TOOL', 'ECHO'],
  },
  'anchor-needle': {
    id: 'anchor-needle',
    name: 'Anchor Needle',
    width: 1,
    height: 1,
    baseValue: 115,
    resonanceWeight: 0,
    tags: ['RUN_ITEM', 'TOOL', 'ANCHOR', 'OPERATION'],
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
    outsideHook: null,
  };
}
