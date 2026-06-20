import type { IncursionNode } from '../types/game';
import type { SectorGraph, SectorGraphNode } from '../types/sector';

export type SectorNodeVisibility = 'REVEALED' | 'SCAN_RANGE' | 'STRUCTURE' | 'HIDDEN';

export const FOG_OPACITY: Record<SectorNodeVisibility, number> = {
  REVEALED: 0,
  SCAN_RANGE: 0.35,
  STRUCTURE: 0.72,
  HIDDEN: 0.88,
};

export const NODE_MARKER_OPACITY: Record<SectorNodeVisibility, number> = {
  REVEALED: 1,
  SCAN_RANGE: 0.92,
  STRUCTURE: 0.38,
  HIDDEN: 0.18,
};

export function buildScanRangeSet(cluster: IncursionNode[]): Set<string> {
  return new Set(cluster.map((node) => node.id));
}

export function buildRevealedSet(
  graph: SectorGraph,
  encounterPath: IncursionNode[],
  focusedNodeIds: readonly string[],
): Set<string> {
  const revealed = new Set<string>(focusedNodeIds);
  revealed.add(graph.entryId);
  encounterPath.forEach((node) => {
    if (node.isCompleted || node.id) revealed.add(node.id);
  });
  Object.values(graph.nodes).forEach((node) => {
    if (node.isCompleted) revealed.add(node.id);
  });
  return revealed;
}

export function resolveNodeVisibility(
  nodeId: string,
  graph: SectorGraph,
  revealed: Set<string>,
  scanRange: Set<string>,
): SectorNodeVisibility {
  if (revealed.has(nodeId)) return 'REVEALED';
  if (scanRange.has(nodeId)) return 'SCAN_RANGE';
  const node = graph.nodes[nodeId];
  if (!node) {
    return scanRange.has(nodeId) ? 'SCAN_RANGE' : 'STRUCTURE';
  }
  const parentRevealed = node.parentId != null && revealed.has(node.parentId);
  if (parentRevealed || node.graphDepth <= 2) return 'STRUCTURE';
  return 'STRUCTURE';
}

export function isEdgeDimmed(
  edge: { fromId: string; toId: string },
  revealed: Set<string>,
): boolean {
  return !revealed.has(edge.fromId) && !revealed.has(edge.toId);
}

export function nodeGlyphForType(type: SectorGraphNode['type'] | IncursionNode['type']): string {
  const glyphs: Record<string, string> = {
    ANOMALY: '?',
    NARRATIVE_EVENT: '◆',
    STANDARD_COMBAT: '⚔',
    ELITE_COMBAT: '☠',
    BOSS_COMBAT: '⬡',
    SANCTUARY: '+',
    BLACK_MARKET: '◈',
    EMERGENCY_EXTRACTION: '↗',
    SAFE_ANCHOR_EXTRACTION: '◎',
    MASTER_EXTRACTION_LINK: '★',
    RESOURCE_HARVEST: '◇',
  };
  return glyphs[type] ?? '●';
}
