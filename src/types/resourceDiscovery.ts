import type { ResourceItemId } from './resourceItem';
import type { SectorId } from './worldState';

/**
 * Economy Spine Phase 2I — light resource discovery / codex state.
 * Not a full codex: earned identity for materials the runner has extracted.
 */

export interface ResourceDiscoveryEntry {
  discovered: boolean;
  /** Sector where this resource was first banked / extracted (hub). */
  firstExtractedAtSector: SectorId | null;
  /** Best known farm blurb once discovered (or sector-known partial). */
  bestKnownSource: string | null;
  /** Short intended-use lines the player has earned. */
  knownUses: readonly string[];
  /** Run count when first discovered (optional telemetry). */
  discoveredAtRunCount?: number;
}

export type ResourceDiscoveryState = Partial<Record<ResourceItemId, ResourceDiscoveryEntry>>;

export type ResourceDiscoveryCardTier = 'DISCOVERED' | 'SIGNAL' | 'UNKNOWN';

export interface ResourceDiscoveryCard {
  resourceId: ResourceItemId;
  tier: ResourceDiscoveryCardTier;
  /** Player-facing title (true name or fogged label). */
  title: string;
  lines: readonly string[];
  compact: string;
  discovered: boolean;
}
