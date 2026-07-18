import type { ResourceItemId } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';
import type { VeilBiome } from '../types/encounterSpawn';
import { ALL_SECTOR_IDS, sectorIdToVeilBiome, veilBiomeToSectorId } from './sectorBiomeBridge';
import { ECONOMY_V1_RESOURCE_IDS, isEconomyV1ResourceId } from './economyRosterV1';
import { getResourceDefinition } from './resourceRegistry';

/**
 * Phase 2D — sector farming identity tables.
 * Turns the map into an economy decision: “I need X → run sector Y.”
 */

export type SectorResourceBand =
  | 'PRIMARY'
  | 'SUPPORT'
  | 'RARE'
  | 'CROSSOVER'
  | 'APEX';

export interface SectorResourceEntry {
  resourceId: ResourceItemId;
  band: SectorResourceBand;
  /** Short design note (rare context, event gate, etc.). */
  note?: string;
}

export interface SectorResourceTable {
  sectorId: SectorId;
  veilBiome: VeilBiome;
  /** One-line farming fantasy. */
  role: string;
  /** Player-facing reasons to breach this sector. */
  whyRun: readonly string[];
  resources: readonly SectorResourceEntry[];
}

function entry(
  resourceId: ResourceItemId,
  band: SectorResourceBand,
  note?: string,
): SectorResourceEntry {
  return note ? { resourceId, band, note } : { resourceId, band };
}

export const SECTOR_RESOURCE_TABLES: Record<SectorId, SectorResourceTable> = {
  THE_NULL_ZONE: {
    sectorId: 'THE_NULL_ZONE',
    veilBiome: 'NULL_ZONE',
    role: 'Urban defense, scanner tech, concrete/warding materials.',
    whyRun: [
      'Defensive tools',
      'Early scanner tools',
      'Basic resource farming',
      'Urban contracts',
      'Containment seals without mandatory Blackline',
    ],
    resources: [
      entry('nullcrete-shard', 'PRIMARY'),
      entry('echo-glass-shard', 'PRIMARY'),
      entry('ley-slag', 'PRIMARY'),
      entry('encrypted-grid-drive', 'RARE', 'Blacksite / tech vault salvage'),
      entry('containment-seal', 'PRIMARY', 'Urban vault seals — Null stays relevant at higher grades'),
      entry('tarnished-dog-tags', 'SUPPORT', 'Fallen-runner / echo residue'),
      entry('smugglers-ledger', 'SUPPORT', 'Fallen-runner intel'),
      entry('resonant-filament', 'SUPPORT', 'Echo-contaminated fights'),
    ],
  },
  THE_ABYSSAL_SINK: {
    sectorId: 'THE_ABYSSAL_SINK',
    veilBiome: 'ABYSSAL_SINK',
    role: 'Survival, healing, cleanse, biological attrition.',
    whyRun: [
      'Healing items',
      'Cleanse tools',
      'Organic survival recipes',
      'Attrition-resistant loadouts',
      'Solaris / occult contracts',
    ],
    resources: [
      entry('mycelial-ichor', 'PRIMARY'),
      entry('sanguine-ampoule', 'PRIMARY'),
      entry('echo-glass-shard', 'PRIMARY'),
      entry('ossified-ley-knot', 'RARE', 'Occult Depth caches'),
      entry('blacksite-specimen-jar', 'CROSSOVER', 'Rare blacksite crossover'),
      entry('tarnished-dog-tags', 'SUPPORT'),
      entry('resonant-filament', 'SUPPORT', 'Echo lane'),
    ],
  },
  THE_ASHEN_WASTES: {
    sectorId: 'THE_ASHEN_WASTES',
    veilBiome: 'ASHEN_WASTE',
    role: 'Extraction, signal instability, flares, road salvage.',
    whyRun: [
      'Dirty extraction tools',
      'Signal stabilization',
      'Ammo / explosive tools',
      'Route intel',
      'Risk / reward resource runs',
      'Breach Thread without Blackline-only lock',
    ],
    resources: [
      entry('cinder-wire', 'PRIMARY'),
      entry('combustion-cylinder', 'PRIMARY'),
      entry('veil-ash-canister', 'PRIMARY'),
      entry('echo-glass-shard', 'PRIMARY'),
      entry('breach-thread', 'PRIMARY', 'False extraction / depth distortion — not Blackline-only'),
      entry('ossified-ley-knot', 'SUPPORT', 'Occult scorched caches'),
      entry('legion-blood-iron', 'SUPPORT', 'Industrial residue crossover'),
      entry('resonant-filament', 'SUPPORT'),
    ],
  },
  THE_SLAG_WORKS: {
    sectorId: 'THE_SLAG_WORKS',
    veilBiome: 'SLAG_WORKS',
    role: 'Industrial power, weapon tech, armor cracking, machinery.',
    whyRun: [
      'Weapon unlocks',
      'Heavy tools',
      'Armor breaking',
      'Industrial contracts',
      'Combat preparation items',
    ],
    resources: [
      entry('rail-capacitor', 'PRIMARY'),
      entry('legion-blood-iron', 'PRIMARY'),
      entry('combustion-cylinder', 'PRIMARY'),
      entry('ley-slag', 'PRIMARY'),
      entry('anchor-marrow', 'RARE', 'Anchor / engine events'),
      entry('smugglers-ledger', 'SUPPORT'),
      entry('tarnished-dog-tags', 'SUPPORT'),
      entry('resonant-filament', 'SUPPORT'),
    ],
  },
  THE_BLACKLINE_TERMINUS: {
    sectorId: 'THE_BLACKLINE_TERMINUS',
    veilBiome: 'BLACKLINE_TERMINUS',
    role: 'Containment, appraisal, sealed cargo, blacksite intel.',
    whyRun: [
      'Appraisal',
      'High-tier contracts',
      'Sealed cargo',
      'Masterwork / mandate hooks',
      'Risk-heavy late-game extraction',
    ],
    resources: [
      entry('containment-seal', 'PRIMARY'),
      entry('encrypted-grid-drive', 'PRIMARY'),
      entry('blacksite-specimen-jar', 'PRIMARY'),
      entry('sealed-containment-casket', 'PRIMARY'),
      entry('breach-thread', 'PRIMARY'),
      entry('anomalous-core', 'APEX', 'Marked high-risk / apex contexts only'),
      entry('ley-slag', 'SUPPORT', 'Industrial blacksite scrap'),
      entry('resonant-filament', 'SUPPORT'),
    ],
  },
};

/** Resources that may exist without being a sector farming pillar (still in tables as SUPPORT). */
export const SECTOR_TABLE_FLEX_IDS: readonly ResourceItemId[] = [
  'smugglers-ledger',
  'tarnished-dog-tags',
  'resonant-filament',
];

export function getSectorResourceTable(sectorId: SectorId): SectorResourceTable {
  return SECTOR_RESOURCE_TABLES[sectorId];
}

export function getSectorResourceTableByBiome(biome: VeilBiome | null | undefined): SectorResourceTable | null {
  if (!biome) return null;
  return SECTOR_RESOURCE_TABLES[veilBiomeToSectorId(biome)];
}

export function sectorResourcesByBand(
  sectorId: SectorId,
  band: SectorResourceBand,
): ResourceItemId[] {
  return SECTOR_RESOURCE_TABLES[sectorId].resources
    .filter((entry) => entry.band === band)
    .map((entry) => entry.resourceId);
}

/** Common farming backbone — PRIMARY + SUPPORT for drop bias. */
export function sectorFarmingPool(sectorId: SectorId): ResourceItemId[] {
  return SECTOR_RESOURCE_TABLES[sectorId].resources
    .filter((entry) => entry.band === 'PRIMARY' || entry.band === 'SUPPORT')
    .map((entry) => entry.resourceId);
}

/** Primary identity mats only (strong sector signal). */
export function sectorPrimaryResourcePool(sectorId: SectorId): ResourceItemId[] {
  return sectorResourcesByBand(sectorId, 'PRIMARY');
}

export function sectorRareResourcePool(sectorId: SectorId): ResourceItemId[] {
  return [
    ...sectorResourcesByBand(sectorId, 'RARE'),
    ...sectorResourcesByBand(sectorId, 'CROSSOVER'),
    ...sectorResourcesByBand(sectorId, 'APEX'),
  ];
}

export function sectorsListingResource(
  resourceId: ResourceItemId,
  band?: SectorResourceBand,
): SectorId[] {
  return ALL_SECTOR_IDS.filter((sectorId) => (
    SECTOR_RESOURCE_TABLES[sectorId].resources.some((entry) => (
      entry.resourceId === resourceId && (band == null || entry.band === band)
    ))
  ));
}

export function isSectorPrimaryResource(sectorId: SectorId, resourceId: ResourceItemId): boolean {
  return sectorPrimaryResourcePool(sectorId).includes(resourceId);
}

/** Biome helper used by combat drop bias (Phase 2D source of truth). */
export function sectorIdentityResourcePoolFromTables(
  veilBiome: VeilBiome | null | undefined,
): ResourceItemId[] {
  const table = getSectorResourceTableByBiome(veilBiome);
  if (!table) return ['ley-slag', 'echo-glass-shard'];
  const primary = sectorPrimaryResourcePool(table.sectorId);
  return primary.length > 0 ? primary : sectorFarmingPool(table.sectorId);
}

export function formatSectorResourceTableBrief(sectorId: SectorId): string {
  const table = SECTOR_RESOURCE_TABLES[sectorId];
  const primary = sectorPrimaryResourcePool(sectorId)
    .map((id) => getResourceDefinition(id).shortName)
    .join(', ');
  const rare = sectorRareResourcePool(sectorId)
    .map((id) => getResourceDefinition(id).shortName)
    .join(', ');
  return [
    `${table.veilBiome} — ${table.role}`,
    `Why: ${table.whyRun.join(' · ')}`,
    `Primary: ${primary}`,
    `Rare / apex: ${rare || '(none)'}`,
  ].join('\n');
}

export function listEconomyResourcesMissingFromSectorTables(): ResourceItemId[] {
  const listed = new Set<ResourceItemId>();
  ALL_SECTOR_IDS.forEach((sectorId) => {
    SECTOR_RESOURCE_TABLES[sectorId].resources.forEach((entry) => {
      listed.add(entry.resourceId);
    });
  });
  return ECONOMY_V1_RESOURCE_IDS.filter((id) => !listed.has(id));
}

export function assertResourceBelongsOnEconomyRoster(resourceId: ResourceItemId): boolean {
  return isEconomyV1ResourceId(resourceId);
}

export { sectorIdToVeilBiome };
