import type { FactionType } from './game';
import type { NodeContextModifiers, NodeModifierRollState } from './worldState';

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
  /** False until lazy type roll assigns a real vector type (Phase 3). */
  typeAssigned?: boolean;
  /** Veil Front context — anchor/echo/operation signals for scanner and combat. */
  contextModifiers?: NodeContextModifiers;
  /** Echo overlay stamped at scanner layer unlock — merged at engagement. */
  echoOverlay?: import('./echoEncounter').ProceduralEchoOverlay;
  /** Scanner label certainty overlay — rolled at layer unlock (Phase F). */
  scannerLabelOverlay?: {
    certainty: 'RELIABLE' | 'DEGRADED' | 'STRANGE';
    displayedType: ProceduralNodeType;
    strangeLabel?: string;
  };
}

export interface ProceduralRunTree {
  nodes: Record<string, ProceduralRunNode>;
  /** Node ids grouped by depth for fast lookup. */
  depthIndex: Record<number, string[]>;
  bossNodeId: string;
  maxDepth: number;
  /** Macro depth chapter (Threshold / Breach / Deep Veil). */
  macroDepthIndex?: 1 | 2 | 3;
  /** Per-run echo caps — mutated as nodes are engaged and rolled. */
  modifierRollState?: NodeModifierRollState;
  /** Stable seed for deterministic per-node context rolls at engagement. */
  rollSeed?: number;
  /** Whether a sanctuary node has been placed in this district tree. */
  sanctuarySpawned?: boolean;
}

import { getNodesPerDistrict } from '../data/runIntegration/runPacingConfig';

/** Procedural StS-style map max depth per district — mirrors run pacing config. */
export function getProceduralRunMaxDepth(): number {
  return getNodesPerDistrict();
}

/** @deprecated Use getProceduralRunMaxDepth() for config-driven depth. */
export const PROCEDURAL_RUN_MAX_DEPTH = 15;
