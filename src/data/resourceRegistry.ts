import type {
  ResourceCategory,
  ResourceItemDefinition,
  ResourceItemId,
  ResourcePrimaryRole,
  ResourceUsageTag,
} from '../types/resourceItem';
import type { SectorId } from '../types/worldState';

const ALL_SECTORS: readonly SectorId[] = [
  'THE_SLAG_WORKS',
  'THE_ABYSSAL_SINK',
  'THE_NULL_ZONE',
  'THE_BLACKLINE_TERMINUS',
  'THE_ASHEN_WASTES',
] as const;

function def(
  entry: Omit<ResourceItemDefinition, 'canStack'> & { maxStack: number },
): ResourceItemDefinition {
  return {
    ...entry,
    canStack: entry.maxStack > 1,
  };
}

const STABLE_TAGS = ['STABLE', 'CRAFTING_MATERIAL', 'CONTRACT_TARGET'] as const satisfies readonly ResourceUsageTag[];
const UNSTABLE_BASE = ['UNSTABLE', 'CONTRACT_TARGET'] as const satisfies readonly ResourceUsageTag[];

export const RESOURCE_REGISTRY: Record<ResourceItemId, ResourceItemDefinition> = {
  'ley-slag': def({
    id: 'ley-slag',
    name: 'Ley-Slag',
    shortName: 'Ley-Slag',
    description: 'Refined ley-channel slag — common stable crafting material.',
    category: 'STABLE',
    primaryRole: 'CRAFTING_MATERIAL',
    usageTags: [...STABLE_TAGS, 'COMMON_MATERIAL'],
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 5,
    baseCapitalValue: 28,
    sellValue: 5,
    ipValue: 1,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: true,
    canBeSoldToFence: true,
    canBeContractTarget: true,
    canBeOperationTarget: false,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ['THE_SLAG_WORKS', 'THE_BLACKLINE_TERMINUS', 'THE_NULL_ZONE'],
  }),
  'sanguine-ampoule': def({
    id: 'sanguine-ampoule',
    name: 'Sanguine Ampoule',
    shortName: 'Sanguine Ampoule',
    description: 'Occult blood ampoule used in consumables and mutation recipes.',
    category: 'STABLE',
    primaryRole: 'CRAFTING_MATERIAL',
    usageTags: [...STABLE_TAGS, 'OCCULT_MATERIAL', 'CONSUMABLE_MATERIAL'],
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 3,
    baseCapitalValue: 42,
    sellValue: 20,
    ipValue: 5,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: true,
    canBeSoldToFence: false,
    canBeContractTarget: true,
    canBeOperationTarget: false,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ['THE_ASHEN_WASTES', 'THE_ABYSSAL_SINK', 'THE_SLAG_WORKS'],
  }),
  'encrypted-grid-drive': def({
    id: 'encrypted-grid-drive',
    name: 'Encrypted Grid-Drive',
    shortName: 'Grid-Drive',
    description: 'Terran scanner intelligence — crafting input and blueprint unlock material.',
    category: 'INTEL',
    primaryRole: 'SCANNER_INTEL',
    usageTags: [
      'INTEL',
      'SCANNER_INTEL',
      'CRAFTING_MATERIAL',
      'CONTRACT_TARGET',
      'WEAPON_BLUEPRINT_MATERIAL',
      'STARTING_REQUISITION_MATERIAL',
      'SPONSOR_TURN_IN',
    ],
    gridWidth: 1,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 125,
    sellValue: 30,
    ipValue: 25,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: true,
    canBeSoldToFence: true,
    canBeContractTarget: true,
    canBeOperationTarget: false,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ['THE_NULL_ZONE', 'THE_BLACKLINE_TERMINUS'],
  }),
  'legion-blood-iron': def({
    id: 'legion-blood-iron',
    name: 'Legion Blood-Iron',
    shortName: 'Blood-Iron',
    description: 'Legion-forged blood-iron ingot — weapon blueprint and combat crafting material.',
    category: 'STABLE',
    primaryRole: 'CRAFTING_MATERIAL',
    usageTags: [...STABLE_TAGS, 'WEAPON_BLUEPRINT_MATERIAL', 'LEGION_MATERIAL'],
    gridWidth: 2,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 118,
    sellValue: 30,
    ipValue: 25,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: true,
    canBeSoldToFence: false,
    canBeContractTarget: true,
    canBeOperationTarget: false,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ['THE_SLAG_WORKS', 'THE_BLACKLINE_TERMINUS', 'THE_ASHEN_WASTES'],
  }),
  'anomalous-core': def({
    id: 'anomalous-core',
    name: 'Anomalous Core',
    shortName: 'Anomalous Core',
    description: 'Apex unstable cargo — masterwork material with latent carried-effect potential.',
    category: 'UNSTABLE',
    primaryRole: 'APEX_CARGO',
    usageTags: [...UNSTABLE_BASE, 'APEX_CARGO', 'MASTERWORK_MATERIAL', 'OPERATION_TARGET'],
    gridWidth: 2,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 280,
    sellValue: 500,
    ipValue: 500,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: true,
    canBeSoldToFence: false,
    canBeContractTarget: true,
    canBeOperationTarget: true,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ALL_SECTORS,
  }),
  'echo-glass-shard': def({
    id: 'echo-glass-shard',
    name: 'Echo-Glass Shard',
    shortName: 'Echo-Glass',
    description: 'Resonant echo-glass fragment — scanner and sonar crafting material.',
    category: 'STABLE',
    primaryRole: 'CRAFTING_MATERIAL',
    usageTags: [...STABLE_TAGS, 'SCANNER_MATERIAL', 'ECHO_MATERIAL'],
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 10,
    baseCapitalValue: 18,
    sellValue: 2,
    ipValue: 2,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: true,
    canBeSoldToFence: false,
    canBeContractTarget: true,
    canBeOperationTarget: false,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ['THE_NULL_ZONE', 'THE_SLAG_WORKS', 'THE_ABYSSAL_SINK'],
  }),
  'veil-ash-canister': def({
    id: 'veil-ash-canister',
    name: 'Veil-Ash Canister',
    shortName: 'Veil-Ash',
    description: 'Pressurized veil-ash canister — volatile cargo and explosive crafting input.',
    category: 'UNSTABLE',
    primaryRole: 'VOLATILE_CARGO',
    usageTags: [
      ...UNSTABLE_BASE,
      'VOLATILE_CARGO',
      'EXPLOSIVE_MATERIAL',
      'CONSUMABLE_MATERIAL',
      'CRAFTING_MATERIAL',
      'OPERATION_TARGET',
    ],
    gridWidth: 1,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 58,
    sellValue: 20,
    ipValue: 20,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: true,
    canBeSoldToFence: false,
    canBeContractTarget: true,
    canBeOperationTarget: true,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ['THE_ASHEN_WASTES', 'THE_ABYSSAL_SINK', 'THE_BLACKLINE_TERMINUS'],
  }),
  'smugglers-ledger': def({
    id: 'smugglers-ledger',
    name: "The Smuggler's Ledger",
    shortName: 'Smuggler Ledger',
    description:
      'A blood-stained, leather-bound notebook filled with coordinates, blackmail, and uncashed Void-Chit promissory notes. Useless as crafting material, priceless to the right buyer.',
    category: 'INTEL',
    primaryRole: 'ECONOMY_INTEL',
    usageTags: [
      'INTEL',
      'ECONOMY_INTEL',
      'FENCE_VALUE',
      'CONTRACT_TARGET',
      'SPONSOR_TURN_IN',
    ],
    gridWidth: 2,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 98,
    sellValue: 250,
    ipValue: 100,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: false,
    canBeSoldToFence: true,
    canBeContractTarget: true,
    canBeOperationTarget: false,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ['THE_NULL_ZONE', 'THE_SLAG_WORKS', 'THE_BLACKLINE_TERMINUS'],
  }),
  'ossified-ley-knot': def({
    id: 'ossified-ley-knot',
    name: 'Ossified Ley-Knot',
    shortName: 'Ley-Knot',
    description: 'Calcified ley-knot — occult unstable cargo with mutation crafting uses.',
    category: 'UNSTABLE',
    primaryRole: 'OCCULT_CARGO',
    usageTags: [
      ...UNSTABLE_BASE,
      'OCCULT_CARGO',
      'MUTATION_MATERIAL',
      'CRAFTING_MATERIAL',
      'OPERATION_TARGET',
    ],
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 88,
    sellValue: 45,
    ipValue: 0,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: true,
    canBeSoldToFence: false,
    canBeContractTarget: true,
    canBeOperationTarget: true,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ['THE_ASHEN_WASTES', 'THE_ABYSSAL_SINK', 'THE_BLACKLINE_TERMINUS'],
  }),
  'sealed-containment-casket': def({
    id: 'sealed-containment-casket',
    name: 'Sealed Containment Casket',
    shortName: 'Casket',
    description: 'Sealed contraband container — open at hub during post-run routing for salvage, credits, or contraband windfalls.',
    category: 'CONTRABAND',
    primaryRole: 'UNIDENTIFIED_CONTAINER',
    usageTags: [
      'CONTRABAND',
      'UNIDENTIFIED_CONTAINER',
      'APEX_CARGO',
      'FENCE_VALUE',
      'CONTRACT_TARGET',
      'APPRAISABLE',
    ],
    gridWidth: 3,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 340,
    sellValue: 150,
    ipValue: 0,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: false,
    canBeSoldToFence: true,
    canBeContractTarget: true,
    canBeOperationTarget: false,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: true,
    canOpenInRun: false,
    validSectorIds: ['THE_NULL_ZONE', 'THE_BLACKLINE_TERMINUS', 'THE_ASHEN_WASTES'],
  }),
  'tarnished-dog-tags': def({
    id: 'tarnished-dog-tags',
    name: 'Tarnished Dog Tags',
    shortName: 'Dog Tags',
    description: 'Identification tags from lost runners — stackable fence-value intel.',
    category: 'INTEL',
    primaryRole: 'FENCE_VALUE',
    usageTags: ['INTEL', 'ECONOMY_INTEL', 'FENCE_VALUE', 'CONTRACT_TARGET'],
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 10,
    baseCapitalValue: 22,
    sellValue: 15,
    ipValue: 0,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: false,
    canBeSoldToFence: true,
    canBeContractTarget: true,
    canBeOperationTarget: false,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ['THE_NULL_ZONE', 'THE_SLAG_WORKS', 'THE_ABYSSAL_SINK'],
  }),
  'combustion-cylinder': def({
    id: 'combustion-cylinder',
    name: 'Combustion Cylinder',
    shortName: 'Combustion Cylinder',
    description:
      'Pressurized volatile fuel cylinder used in improvised explosives, ignition tools, and hazardous crafting recipes.',
    category: 'STABLE',
    primaryRole: 'EXPLOSIVE_MATERIAL',
    usageTags: [...STABLE_TAGS, 'EXPLOSIVE_MATERIAL', 'CONSUMABLE_MATERIAL'],
    gridWidth: 1,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 95,
    sellValue: 25,
    ipValue: 25,
    itemType: 'RESOURCE',
    canBeCraftingIngredient: true,
    canBeSoldToFence: false,
    canBeContractTarget: true,
    canBeOperationTarget: false,
    canBeBankedAtSafehouse: true,
    requiresExtractionForValue: true,
    lostOnDeathIfUnbanked: true,
    canOpenAtHub: false,
    canOpenInRun: false,
    validSectorIds: ['THE_SLAG_WORKS', 'THE_BLACKLINE_TERMINUS', 'THE_ASHEN_WASTES'],
  }),
};

export const ALL_RESOURCE_ITEM_IDS = Object.keys(RESOURCE_REGISTRY) as ResourceItemId[];

export const RESOURCES_BY_CATEGORY: Record<ResourceCategory, ResourceItemId[]> = {
  STABLE: ALL_RESOURCE_ITEM_IDS.filter((id) => RESOURCE_REGISTRY[id].category === 'STABLE'),
  UNSTABLE: ALL_RESOURCE_ITEM_IDS.filter((id) => RESOURCE_REGISTRY[id].category === 'UNSTABLE'),
  INTEL: ALL_RESOURCE_ITEM_IDS.filter((id) => RESOURCE_REGISTRY[id].category === 'INTEL'),
  CONTRABAND: ALL_RESOURCE_ITEM_IDS.filter((id) => RESOURCE_REGISTRY[id].category === 'CONTRABAND'),
};

export const CONTRACT_TARGET_RESOURCE_IDS = ALL_RESOURCE_ITEM_IDS.filter(
  (id) => RESOURCE_REGISTRY[id].canBeContractTarget,
);

export function getResourceDefinition(id: ResourceItemId): ResourceItemDefinition {
  return RESOURCE_REGISTRY[id];
}

export function isResourceItemId(id: string): id is ResourceItemId {
  return id in RESOURCE_REGISTRY;
}

export function getResourceSellValue(id: ResourceItemId): number {
  return RESOURCE_REGISTRY[id].sellValue;
}

export function getResourceIpValue(id: ResourceItemId): number {
  return RESOURCE_REGISTRY[id].ipValue;
}

/** Full name for detail views; short name when compact UI is requested. */
export function getResourceDisplayName(id: ResourceItemId, compact = false): string {
  const def = RESOURCE_REGISTRY[id];
  return compact ? def.shortName : def.name;
}

export function getResourceShortName(id: ResourceItemId): string {
  return RESOURCE_REGISTRY[id].shortName;
}

export function getResourceCategory(id: ResourceItemId): ResourceCategory {
  return RESOURCE_REGISTRY[id].category;
}

export function getResourcePrimaryRole(id: ResourceItemId): ResourcePrimaryRole {
  return RESOURCE_REGISTRY[id].primaryRole;
}

export function hasResourceUsageTag(id: ResourceItemId, tag: ResourceUsageTag): boolean {
  return RESOURCE_REGISTRY[id].usageTags.includes(tag);
}

export function canResourceBeCraftingIngredient(id: ResourceItemId): boolean {
  return RESOURCE_REGISTRY[id].canBeCraftingIngredient;
}

export function canResourceBeSoldToFence(id: ResourceItemId): boolean {
  return RESOURCE_REGISTRY[id].canBeSoldToFence;
}

export function getFenceableResourceIds(): ResourceItemId[] {
  return ALL_RESOURCE_ITEM_IDS.filter((id) => RESOURCE_REGISTRY[id].canBeSoldToFence);
}

export function isFenceableResourceId(id: ResourceItemId): boolean {
  return RESOURCE_REGISTRY[id].canBeSoldToFence;
}

export function getValidSectorsForResource(id: ResourceItemId): readonly SectorId[] {
  return RESOURCE_REGISTRY[id].validSectorIds;
}

export function canResourceSpawnInSector(id: ResourceItemId, sectorId: SectorId): boolean {
  return RESOURCE_REGISTRY[id].validSectorIds.includes(sectorId);
}

export function calculateDonationIpYield(
  items: ReadonlyArray<{ id: ResourceItemId; quantity: number }>,
): number {
  return items.reduce(
    (total, entry) => total + getResourceIpValue(entry.id) * entry.quantity,
    0,
  );
}
