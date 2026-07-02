import type { FactionType } from './game';

/** Procedural StS-style map node types (depth 1–15). */
export type ProceduralNodeType =
  | 'COMBAT'
  | 'ANOMALY'
  | 'ELITE'
  | 'MARKET'
  | 'EXTRACTION'
  | 'SANCTUARY'
  | 'RESOURCE'
  | 'GATEKEEPER';

export interface ProceduralRunNode {
  id: string;
  /** Player-facing depth layer (1–15). */
  depth: number;
  type: ProceduralNodeType;
  /** Depth-1 combat vectors — locks district biome on engage. */
  faction?: FactionType;
  /** Pre-rolled harvest loot for RESOURCE nodes (≤ standard combat drop budget). */
  resourcePool?: string[];
  /** IDs of nodes at depth + 1 this node connects to. */
  children: string[];
}

export interface ProceduralRunTree {
  nodes: Record<string, ProceduralRunNode>;
  /** Node ids grouped by depth for fast lookup. */
  depthIndex: Record<number, string[]>;
  bossNodeId: string;
  maxDepth: number;
}

export const PROCEDURAL_RUN_MAX_DEPTH = 15;
