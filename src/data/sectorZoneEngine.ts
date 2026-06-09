import type { EnvironmentType } from '../types/sector';
import type { SectorZoneId } from '../types/sectorPacing';
import { BOSS_GRAPH_DEPTH, SAFE_ANCHOR_GRAPH_DEPTHS, ZONE_RESONANCE_BASE } from '../types/sectorPacing';
import type { SafeAnchorIndex } from '../types/sectorPacing';

export function getSectorZone(nodesCleared: number, collapseActive = false): SectorZoneId {
  if (collapseActive || nodesCleared >= 20) return 'COLLAPSE';
  if (nodesCleared >= 15) return 'INNER_SANCTUM';
  if (nodesCleared >= 10) return 'BREACH_PERIMETER';
  if (nodesCleared >= 5) return 'DEEP_TRANSIT';
  return 'OUTSKIRTS';
}

export function getZoneResonanceBase(nodesCleared: number, collapseActive = false): number {
  return ZONE_RESONANCE_BASE[getSectorZone(nodesCleared, collapseActive)];
}

export function isFullBlindZone(nodesCleared: number): boolean {
  return nodesCleared >= 15;
}

export function isEmergencyRecallAvailable(nodesCleared: number): boolean {
  return nodesCleared >= 4 && nodesCleared <= 14;
}

/** Clean safe-anchor / master-link extractions unavailable after node 15. */
export function isCleanExtractionAvailable(nodesCleared: number): boolean {
  return nodesCleared < 15;
}

export function safeAnchorIndexForCrossingDepth(nextGraphDepth: number): SafeAnchorIndex | null {
  const idx = SAFE_ANCHOR_GRAPH_DEPTHS.indexOf(nextGraphDepth as 5 | 10 | 15);
  if (idx < 0) return null;
  return (idx + 1) as SafeAnchorIndex;
}

export function isBossApproachDepth(graphDepth: number): boolean {
  return graphDepth >= BOSS_GRAPH_DEPTH - 1;
}

export function isBossGraphDepth(graphDepth: number): boolean {
  return graphDepth >= BOSS_GRAPH_DEPTH;
}

/** Zone-appropriate environment assignment for pre-generated graph nodes. */
export function environmentForGraphDepth(graphDepth: number, seed = 0): EnvironmentType {
  const primary: EnvironmentType = graphDepth <= 6
    ? 'SUBWAY_CHASM'
    : graphDepth <= 12
      ? 'BLEEDING_HIGH_RISE'
      : 'DESECRATED_SANCTUARY';
  if (seed % 7 === 0 && graphDepth > 2) {
    const variants: EnvironmentType[] = ['SUBWAY_CHASM', 'BLEEDING_HIGH_RISE', 'DESECRATED_SANCTUARY'];
    return variants[(seed + graphDepth) % variants.length];
  }
  return primary;
}
