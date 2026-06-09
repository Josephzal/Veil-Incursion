import type { IncursionNode } from '../types/game';
import type { SectorGraph } from '../types/sector';
import { makeGraphNode } from './sectorGraphEngine';

const COLLAPSE_VECTOR_TYPES = ['STANDARD_COMBAT', 'ELITE_COMBAT', 'RESOURCE_HARVEST'] as const;

/**
 * Spawns procedural collapse vectors when the operative pushes past the boss nest.
 * Each engagement increments graph depth beyond MAX_SECTOR_NODES.
 */
export function appendCollapseForwardNodes(
  graph: SectorGraph,
  currentNodeId: string,
  count = 2,
): SectorGraph {
  const resolvedId = graph.nodes[currentNodeId] ? currentNodeId : graph.entryId;
  const current = graph.nodes[resolvedId];
  if (!current) return graph;

  const nodes = { ...graph.nodes };
  let parent = { ...current };
  let spawnIndex = Object.keys(nodes).length;

  for (let i = 0; i < count; i += 1) {
    spawnIndex += 1;
    const childId = `collapse-rift-${resolvedId}-${spawnIndex}`;
    const typeRoll = COLLAPSE_VECTOR_TYPES[spawnIndex % COLLAPSE_VECTOR_TYPES.length];
    const child = makeGraphNode(childId, parent.graphDepth + 1, resolvedId, graph.sectorTier);
    child.type = typeRoll;
    child.encounterType = typeRoll === 'RESOURCE_HARVEST' ? 'RESOURCE_HARVEST' : 'COMBAT';
    child.label = `COLLAPSE RIFT // ${typeRoll.replace(/_/g, ' ')}`;
    child.environmentType = 'BLEEDING_HIGH_RISE';
    nodes[childId] = child;
    parent = { ...parent, childIds: [...parent.childIds, childId] };
  }
  nodes[resolvedId] = parent;

  return { ...graph, nodes, maxGraphDepth: Math.max(graph.maxGraphDepth, parent.graphDepth + 1) };
}

export function createCollapseEntryNode(stepIndex: number): IncursionNode {
  const id = `collapse-entry-${stepIndex}`;
  return {
    id,
    encounterIndex: stepIndex,
    index: stepIndex,
    encounterType: 'COMBAT',
    biome: 'CITY_STREETS',
    type: 'ELITE_COMBAT',
    environmentType: 'BLEEDING_HIGH_RISE',
    label: 'COLLAPSE RIFT // POCKET DIMENSION BREACH',
    isCompleted: false,
    sectorMeta: {
      spectral: {
        radialFrequency: 'Dimensional Shear // Uncapped Resonance Band',
        visualSpectrum: 'Violet Fracture // Collapse Threshold',
        occultIndex: 'Boss Cleared // Continuation Optional',
        threatProfile: 'EXTREME // RESONANCE UNBOUND BEYOND',
        threatBand: 'CRITICAL',
      },
      resonanceDelta: 0,
      isFocused: true,
      yieldMultiplier: 1,
      creditBonus: 0,
      combatTier: 'ELITE',
    },
  };
}

export function isCollapseForwardNode(node: IncursionNode): boolean {
  return node.id.startsWith('collapse-rift-') || node.id.startsWith('collapse-entry-');
}
