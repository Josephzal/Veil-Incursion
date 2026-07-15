import type { WeightedAnchorPoolEntry } from '../types/anchorProcedural';
import type { SectorId } from '../types/worldState';
import { getSectorWorldTemplate } from './sectorWorldCatalog';

export const SECTOR_ANCHOR_POOLS: Record<SectorId, WeightedAnchorPoolEntry[]> = {
  THE_ABYSSAL_SINK: [
    { type: 'ASHEN_HEART', weight: 35 },
    { type: 'LEY_NEXUS', weight: 30 },
    { type: 'CHOIR_SPIRE', weight: 20 },
    { type: 'NULL_MONOLITH', weight: 15 },
    { type: 'RIFT_ENGINE', weight: 5 },
  ],
  THE_NULL_ZONE: [
    { type: 'NULL_MONOLITH', weight: 40 },
    { type: 'CHOIR_SPIRE', weight: 25 },
    { type: 'RIFT_ENGINE', weight: 20 },
    { type: 'LEY_NEXUS', weight: 15 },
    { type: 'ASHEN_HEART', weight: 5 },
  ],
  THE_ASHEN_WASTES: [
    { type: 'RIFT_ENGINE', weight: 35 },
    { type: 'NULL_MONOLITH', weight: 25 },
    { type: 'ASHEN_HEART', weight: 20 },
    { type: 'LEY_NEXUS', weight: 15 },
    { type: 'CHOIR_SPIRE', weight: 5 },
  ],
  THE_SLAG_WORKS: [
    { type: 'RIFT_ENGINE', weight: 35 },
    { type: 'LEY_NEXUS', weight: 25 },
    { type: 'CHOIR_SPIRE', weight: 25 },
    { type: 'NULL_MONOLITH', weight: 10 },
    { type: 'ASHEN_HEART', weight: 5 },
  ],
  THE_BLACKLINE_TERMINUS: [
    { type: 'NULL_MONOLITH', weight: 30 },
    { type: 'RIFT_ENGINE', weight: 25 },
    { type: 'CHOIR_SPIRE', weight: 20 },
    { type: 'ASHEN_HEART', weight: 15 },
    { type: 'LEY_NEXUS', weight: 10 },
  ],
};

export function getSectorAnchorPool(sectorId: SectorId): WeightedAnchorPoolEntry[] {
  return SECTOR_ANCHOR_POOLS[sectorId] ?? SECTOR_ANCHOR_POOLS.THE_SLAG_WORKS;
}

export function catalogFallbackInPool(sectorId: SectorId): boolean {
  const template = getSectorWorldTemplate(sectorId);
  if (!template.anchor) return true;
  return getSectorAnchorPool(sectorId).some((entry) => entry.type === template.anchor!.type);
}
