import type { FactionType } from './game';
import type { NodeContextModifiers } from './worldState';

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
  /** @deprecated Legacy faction tag — sector runVeilBiome drives biome display. */
  faction?: FactionType;
  /** Pre-rolled harvest loot for RESOURCE nodes (≤ standard combat drop budget). */
  resourcePool?: string[];
  /** IDs of nodes at depth + 1 this node connects to. */
  children: string[];
  /** Veil Front context — anchor/echo/operation signals for scanner and combat. */
  contextModifiers?: NodeContextModifiers;
}

export interface ProceduralRunTree {
  nodes: Record<string, ProceduralRunNode>;
  /** Node ids grouped by depth for fast lookup. */
  depthIndex: Record<number, string[]>;
  bossNodeId: string;
  maxDepth: number;
  /** Macro depth chapter (Threshold / Breach / Deep Veil). */
  macroDepthIndex?: 1 | 2 | 3;
}

export const PROCEDURAL_RUN_MAX_DEPTH = 15;
