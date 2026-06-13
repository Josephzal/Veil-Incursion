import type { SectorZoneId } from '../types/sectorPacing';
import {
  BOSS_GRAPH_DEPTH,
  EMERGENCY_RECALL_MAX_CLEARED,
  EMERGENCY_RECALL_MIN_CLEARED,
  LEVELS_PER_DISTRICT,
  SAFE_ANCHOR_GRAPH_DEPTHS,
  ZONE_RESONANCE_BASE,
} from '../types/sectorPacing';
import type { SafeAnchorIndex } from '../types/sectorPacing';

export function getSectorZone(nodesCleared: number, collapseActive = false): SectorZoneId {
  if (collapseActive || nodesCleared >= BOSS_GRAPH_DEPTH) return 'COLLAPSE';
  if (nodesCleared >= LEVELS_PER_DISTRICT * 2) return 'INNER_SANCTUM';
  if (nodesCleared >= LEVELS_PER_DISTRICT) return 'BREACH_PERIMETER';
  if (nodesCleared >= 7) return 'DEEP_TRANSIT';
  return 'OUTSKIRTS';
}

export function getZoneResonanceBase(nodesCleared: number, collapseActive = false): number {
  return ZONE_RESONANCE_BASE[getSectorZone(nodesCleared, collapseActive)];
}

export function isFullBlindZone(nodesCleared: number): boolean {
  return nodesCleared >= LEVELS_PER_DISTRICT;
}

export function isEmergencyRecallAvailable(nodesCleared: number): boolean {
  return nodesCleared >= EMERGENCY_RECALL_MIN_CLEARED
    && nodesCleared <= EMERGENCY_RECALL_MAX_CLEARED;
}

/** Clean safe-anchor / master-link extractions unavailable deep in Act III. */
export function isCleanExtractionAvailable(nodesCleared: number): boolean {
  return nodesCleared < LEVELS_PER_DISTRICT * 2 - 8;
}

export function safeAnchorIndexForCrossingDepth(nextGraphDepth: number): SafeAnchorIndex | null {
  const idx = SAFE_ANCHOR_GRAPH_DEPTHS.indexOf(nextGraphDepth as 8 | 15 | 22);
  if (idx < 0) return null;
  return (idx + 1) as SafeAnchorIndex;
}

export function isBossApproachDepth(graphDepth: number): boolean {
  return graphDepth >= BOSS_GRAPH_DEPTH - 1;
}

export function isBossGraphDepth(graphDepth: number): boolean {
  return graphDepth >= BOSS_GRAPH_DEPTH;
}
