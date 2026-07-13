import type { SectorZoneId } from '../types/sectorPacing';
import {
  getLevelsPerDistrict,
  getMaxRunGraphDepth,
  getSafeAnchorGraphDepths,
  EMERGENCY_RECALL_MAX_CLEARED,
  EMERGENCY_RECALL_MIN_CLEARED,
  ZONE_RESONANCE_BASE,
} from '../types/sectorPacing';
import type { SafeAnchorIndex } from '../types/sectorPacing';

export function getSectorZone(nodesCleared: number, collapseActive = false): SectorZoneId {
  const levels = getLevelsPerDistrict();
  const bossDepth = getMaxRunGraphDepth();
  if (collapseActive || nodesCleared >= bossDepth) return 'COLLAPSE';
  if (nodesCleared >= levels * 2) return 'INNER_SANCTUM';
  if (nodesCleared >= levels) return 'BREACH_PERIMETER';
  if (nodesCleared >= 7) return 'DEEP_TRANSIT';
  return 'OUTSKIRTS';
}

export function getZoneResonanceBase(nodesCleared: number, collapseActive = false): number {
  return ZONE_RESONANCE_BASE[getSectorZone(nodesCleared, collapseActive)];
}

export function isFullBlindZone(nodesCleared: number): boolean {
  return nodesCleared >= getLevelsPerDistrict();
}

export function isEmergencyRecallAvailable(nodesCleared: number): boolean {
  return nodesCleared >= EMERGENCY_RECALL_MIN_CLEARED
    && nodesCleared <= EMERGENCY_RECALL_MAX_CLEARED;
}

/** Clean safe-anchor / master-link extractions unavailable deep in Act III. */
export function isCleanExtractionAvailable(nodesCleared: number): boolean {
  const levels = getLevelsPerDistrict();
  return nodesCleared < levels * 2 - 8;
}

export function safeAnchorIndexForCrossingDepth(nextGraphDepth: number): SafeAnchorIndex | null {
  const idx = getSafeAnchorGraphDepths().indexOf(nextGraphDepth as never);
  if (idx < 0) return null;
  return (idx + 1) as SafeAnchorIndex;
}

export function isBossApproachDepth(graphDepth: number): boolean {
  return graphDepth >= getMaxRunGraphDepth() - 1;
}

export function isBossGraphDepth(graphDepth: number): boolean {
  return graphDepth >= getMaxRunGraphDepth();
}
