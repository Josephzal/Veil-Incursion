import type { IncursionEncounterType, IncursionNode, RunNodeType } from '../types/game';
import type {
  NodeSectorMeta,
  SectorGraph,
  SectorGraphNode,
  SpectralTelemetry,
  SpectralThreatBand,
} from '../types/sector';
import {
  BOSS_NEST_HARD_RESONANCE,
  BOSS_NEST_SOFT_RESONANCE,
  BOSS_SIGNATURE_RESONANCE,
  EXTRACTION_AVAILABLE_AFTER_CLEARED,
  GREED_ZONE_YIELD_MULTIPLIER,
  MAX_SECTOR_NODES,
  RESONANCE_DELTA_HIGH,
  RESONANCE_DELTA_STANDARD,
} from '../types/sector';
import {
  isBossApproachDepth,
  isCleanExtractionAvailable,
  isFullBlindZone,
  safeAnchorIndexForCrossingDepth,
} from './sectorZoneEngine';
import { createCollapseEntryNode } from './pocketDimensionEngine';
import {
  applyMacroBiomeToCluster,
} from './macroBiomeEngine';
import {
  dedupeScannerClusterNodes,
  materializeLevelCluster,
  maxVectorsForLocalLevel,
} from './descentLevelMatrix';
import {
  depthFromNodesCleared,
  getDistrictFromDepth,
  isDistrictGateDepth,
  localLevelFromDepth,
} from './districtPacing';
import {
  district1ExtractionAnchorForLocalLevel,
  isDistrict1ExtractionLevel,
  isSanctuaryScheduledLevel,
  type SanctuarySchedule,
} from './sanctuaryScheduleEngine';
import { districtGateLabel } from './districtPacing';
import type { SafeAnchorIndex } from '../types/sectorPacing';
import { BOSS_GRAPH_DEPTH, DISTRICT_GATE_DEPTHS, SCANNER_MAX_VECTORS } from '../types/sectorPacing';

const VECTOR_DESIGNATIONS = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA'] as const;

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function rollEncounter(graphDepth: number): IncursionEncounterType {
  const roll = Math.random();
  if (graphDepth <= 2) {
    return roll < 0.55 ? 'COMBAT' : 'ANOMALY';
  }
  if (roll < 0.32) return 'COMBAT';
  if (roll < 0.48) return 'ANOMALY';
  if (roll < 0.62) return 'RESOURCE_HARVEST';
  return 'BLACK_MARKET';
}

function encounterToType(encounterType: IncursionEncounterType, isAnomalyNest: boolean): RunNodeType {
  if (isAnomalyNest) return 'BOSS_COMBAT';
  switch (encounterType) {
    case 'SANCTUARY':
      return 'SANCTUARY';
    case 'ANOMALY':
      return 'ANOMALY';
    case 'NARRATIVE_EVENT':
      return 'NARRATIVE_EVENT';
    case 'BLACK_MARKET':
      return 'BLACK_MARKET';
    case 'RESOURCE_HARVEST':
      return 'RESOURCE_HARVEST';
    default:
      return Math.random() < 0.22 ? 'ELITE_COMBAT' : 'STANDARD_COMBAT';
  }
}

function threatBandForEncounter(
  encounterType: IncursionEncounterType,
  type: RunNodeType,
): SpectralThreatBand {
  if (type === 'BOSS_COMBAT') return 'CRITICAL';
  if (type === 'ELITE_COMBAT') return 'ELEVATED';
  if (encounterType === 'SANCTUARY') return 'LOW';
  if (encounterType === 'BLACK_MARKET') return 'MODERATE';
  if (encounterType === 'RESOURCE_HARVEST') return 'MODERATE';
  if (encounterType === 'ANOMALY') return 'MODERATE';
  if (encounterType === 'NARRATIVE_EVENT') return 'MODERATE';
  return 'MODERATE';
}

/** Ambiguous spectral readouts — multiple encounter types can share profiles. */
export function buildAmbiguousSpectral(
  nodeId: string,
  band: SpectralThreatBand,
): SpectralTelemetry {
  const seed = hashSeed(nodeId);
  const profiles: Record<SpectralThreatBand, SpectralTelemetry> = {
    LOW: {
      radialFrequency: 'Stable Void Bleed // Low Occult Noise',
      visualSpectrum: 'Ash Fall Static // Soft Geometry',
      occultIndex: 'Dormant Crystal Lattice',
      threatProfile: 'LOW // RECOVERY BAND POSSIBLE',
      threatBand: 'LOW',
    },
    MODERATE: {
      radialFrequency: 'Unstable Void Bleed Detected',
      visualSpectrum: 'Shattered Reality Geometry // Flicker',
      occultIndex: 'Mixed Null Crystal Scatter',
      threatProfile: 'MODERATE // DATA OR COMMERCE BAND',
      threatBand: 'MODERATE',
    },
    ELEVATED: {
      radialFrequency: 'Volatile Heat Bloom Detected',
      visualSpectrum: 'Fractured Corridor // Red Shift',
      occultIndex: 'High-Density Anomaly Core',
      threatProfile: 'ELEVATED // HOSTILE OR FRAGMENT RISK',
      threatBand: 'ELEVATED',
    },
    CRITICAL: {
      radialFrequency: 'Prime Anomaly Frequency Lock',
      visualSpectrum: 'Void Chasm Collapse // Black Sun Static',
      occultIndex: 'CRITICAL Null Crystal Concentration',
      threatProfile: 'CRITICAL // UNKNOWN ANOMALY COLD SPOT',
      threatBand: 'CRITICAL',
    },
    UNKNOWN: {
      radialFrequency: 'Unclassified Band // Phase Noise',
      visualSpectrum: 'Indeterminate Geometry',
      occultIndex: 'Unreadable Occult Index',
      threatProfile: 'UNKNOWN // BREACH BLIND ADVISORY',
      threatBand: 'UNKNOWN',
    },
  };

  const base = profiles[band];
  const variant = seed % 3;
  if (variant === 1) {
    return {
      ...base,
      occultIndex: 'Unstable Frequency // Faction Broadcast Detected',
    };
  }
  if (variant === 2) {
    return {
      ...base,
      radialFrequency: 'Kinetic Drift // High Data Output',
    };
  }
  return base;
}

function buildSectorMeta(
  nodeId: string,
  encounterType: IncursionEncounterType,
  type: RunNodeType,
  graphDepth: number,
  sectorTier: number,
): NodeSectorMeta {
  const band = threatBandForEncounter(encounterType, type);
  const isElite = type === 'ELITE_COMBAT' || type === 'BOSS_COMBAT';
  const resonanceDelta = isElite ? RESONANCE_DELTA_HIGH : RESONANCE_DELTA_STANDARD;
  const tierYield = 1 + (sectorTier - 1) * 0.15;
  const depthYield = graphDepth >= 5 ? GREED_ZONE_YIELD_MULTIPLIER : 1;

  const combatTier = isElite ? 'ELITE' : 'STANDARD';
  const isCombatNode = encounterType === 'COMBAT' || type === 'ELITE_COMBAT' || type === 'BOSS_COMBAT';

  return {
    spectral: buildAmbiguousSpectral(nodeId, band),
    resonanceDelta: Math.round(resonanceDelta * tierYield),
    isFocused: false,
    yieldMultiplier: tierYield * depthYield,
    creditBonus: (encounterType === 'ANOMALY' || encounterType === 'NARRATIVE_EVENT') && hashSeed(nodeId) % 5 === 0 ? 35 : 0,
    combatTier,
  };
}

export function makeGraphNode(
  id: string,
  graphDepth: number,
  parentId: string | null,
  sectorTier: number,
  options?: { isAnomalyNest?: boolean; encounterType?: IncursionEncounterType },
): SectorGraphNode {
  const isAnomalyNest = options?.isAnomalyNest === true;
  const encounterType = options?.encounterType ?? rollEncounter(graphDepth);
  const type = encounterToType(encounterType, isAnomalyNest);
  const designation = VECTOR_DESIGNATIONS[hashSeed(id) % VECTOR_DESIGNATIONS.length];

  return {
    id,
    graphDepth,
    encounterType,
    type,
    childIds: [],
    parentId,
    label: `VECTOR ${designation}`,
    sectorMeta: buildSectorMeta(id, encounterType, type, graphDepth, sectorTier),
    isAnomalyNest,
    isCompleted: false,
  };
}

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
    nodes[childId] = child;
    parent = { ...parent, childIds: [...parent.childIds, childId] };
  }
  nodes[resolvedId] = parent;

  return { ...graph, nodes, maxGraphDepth: Math.max(graph.maxGraphDepth, parent.graphDepth + 1) };
}

export function generateSectorGraph(sectorTier = 1): SectorGraph {
  const nodes: Record<string, SectorGraphNode> = {};
  const entryId = 'sector-entry';
  nodes[entryId] = {
    id: entryId,
    graphDepth: 0,
    encounterType: 'NARRATIVE_EVENT',
    type: 'NARRATIVE_EVENT',
    childIds: [],
    parentId: null,
    label: 'SECTOR ENTRY // VEIL THRESHOLD',
    sectorMeta: buildSectorMeta(entryId, 'NARRATIVE_EVENT', 'NARRATIVE_EVENT', 0, sectorTier),
    isCompleted: true,
  };

  let spineParentId = entryId;
  for (let depth = 1; depth <= BOSS_GRAPH_DEPTH; depth += 1) {
    const isBoss = (DISTRICT_GATE_DEPTHS as readonly number[]).includes(depth);
    const spineId = depth === 45 ? 'sector-boss-nest' : isBoss ? `sector-gate-${depth}` : `sector-spine-${depth}`;
    const spine = makeGraphNode(spineId, depth, spineParentId, sectorTier, { isAnomalyNest: isBoss });
    if (isBoss) {
      spine.type = 'BOSS_COMBAT';
      spine.encounterType = 'COMBAT';
      spine.label = districtGateLabel(depth);
      spine.isAnomalyNest = true;
      spine.sectorMeta = buildSectorMeta(
        spineId,
        'COMBAT',
        'BOSS_COMBAT',
        depth,
        sectorTier,
      );
    }
    nodes[spineId] = spine;
    const parent = nodes[spineParentId];
    nodes[spineParentId] = { ...parent, childIds: [...parent.childIds, spineId] };

    if (!isBoss) {
      const branchCount = depth <= 5 ? 2 : 1;
      for (let branch = 0; branch < branchCount; branch += 1) {
        const branchId = `sector-${depth}-alt-${branch}`;
        const alt = makeGraphNode(branchId, depth, spineParentId, sectorTier);
        nodes[branchId] = alt;
        const branchParent = nodes[spineParentId];
        nodes[spineParentId] = {
          ...branchParent,
          childIds: [...branchParent.childIds, branchId],
        };
      }
    }

    spineParentId = spineId;
  }

  return {
    entryId,
    nodes,
    sectorTier,
    maxGraphDepth: BOSS_GRAPH_DEPTH,
  };
}

export function graphNodeToIncursionNode(
  graphNode: SectorGraphNode,
  stepIndex: number,
): IncursionNode {
  return {
    id: graphNode.id,
    encounterIndex: stepIndex,
    index: stepIndex,
    encounterType: graphNode.encounterType,
    type: graphNode.type,
    label: graphNode.label,
    isCompleted: graphNode.isCompleted ?? false,
    isPreDiscovered: graphNode.isAnomalyNest === true,
    sectorMeta: { ...graphNode.sectorMeta },
    isExtractionNode: graphNode.isExtraction === true,
    isAnomalyNest: graphNode.isAnomalyNest === true,
  };
}

const SAFE_ANCHOR_LABELS: Record<SafeAnchorIndex, string> = {
  1: 'SAFE ANCHOR I // EXTRACTION CONDUIT',
  2: 'SAFE ANCHOR II // MIDWAY EVAC CONDUIT',
  3: 'SAFE ANCHOR III // FINAL CLEAN EXIT',
};

export function createSanctuaryNode(stepIndex: number, localLevel: number): IncursionNode {
  const id = `sanctuary-l${localLevel}-${stepIndex}`;
  return {
    id,
    encounterIndex: stepIndex,
    index: stepIndex,
    encounterType: 'SANCTUARY',
    type: 'SANCTUARY',
    label: 'SANCTUARY ANCHOR // RE-TUNE CONDUIT',
    isCompleted: false,
    sectorMeta: {
      spectral: {
        radialFrequency: 'Stabilized Ley Band // Recovery Channel',
        visualSpectrum: 'Verdant Anchor // Soft Green Static',
        occultIndex: 'Sanctuary Relay Authenticated',
        threatProfile: 'LOW // RECOVERY OR STRIKE TUNING',
        threatBand: 'LOW',
      },
      resonanceDelta: 0,
      isFocused: true,
      yieldMultiplier: 1,
      creditBonus: 0,
      combatTier: 'STANDARD',
    },
  };
}

export function createSafeAnchorExtractionNode(
  anchorIndex: SafeAnchorIndex,
  stepIndex: number,
): IncursionNode {
  const id = `safe-anchor-${anchorIndex}-${stepIndex}`;
  return {
    id,
    encounterIndex: stepIndex,
    index: stepIndex,
    encounterType: 'SANCTUARY',
    type: 'SAFE_ANCHOR_EXTRACTION',
    label: SAFE_ANCHOR_LABELS[anchorIndex],
    isCompleted: false,
    isExtractionNode: true,
    safeAnchorIndex: anchorIndex,
    sectorMeta: {
      spectral: {
        radialFrequency: 'Authenticated Evac Band // Anchor Stable',
        visualSpectrum: 'Amber Corridor // Clean Extraction Lane',
        occultIndex: `Safe Anchor ${anchorIndex} // No Attunement Required`,
        threatProfile: 'LOW // CLEAN EXTRACTION AVAILABLE',
        threatBand: 'LOW',
      },
      resonanceDelta: 0,
      isFocused: true,
      yieldMultiplier: 1,
      creditBonus: 0,
      combatTier: 'STANDARD',
    },
  };
}

export function createMasterExtractionNode(stepIndex: number): IncursionNode {
  const id = `master-extraction-${stepIndex}`;
  return {
    id,
    encounterIndex: stepIndex,
    index: stepIndex,
    encounterType: 'SANCTUARY',
    type: 'MASTER_EXTRACTION_LINK',
    label: 'MASTER EXTRACTION LINK // PRIME CONDUIT',
    isCompleted: false,
    isExtractionNode: true,
    sectorMeta: {
      spectral: {
        radialFrequency: 'Prime Conduit // Authenticated Master Band',
        visualSpectrum: 'Gold Corridor // Maximum Evac Throughput',
        occultIndex: 'Boss Nest Cleared // Master Link Armed',
        threatProfile: 'NONE // GUARANTEED CLEAN EXIT',
        threatBand: 'LOW',
      },
      resonanceDelta: 0,
      isFocused: true,
      yieldMultiplier: 1,
      creditBonus: 0,
      combatTier: 'STANDARD',
    },
  };
}

export function createEmergencyExtractionNode(stepIndex: number): IncursionNode {
  const id = `extraction-emergency-${stepIndex}`;
  return {
    id,
    encounterIndex: stepIndex,
    index: stepIndex,
    encounterType: 'SANCTUARY',
    type: 'EMERGENCY_EXTRACTION',
    label: 'SIGNAL: EMERGENCY EXTRACTION LINK',
    isCompleted: false,
    isExtractionNode: true,
    sectorMeta: {
      spectral: {
        radialFrequency: 'Extraction Conduit Stabilizing',
        visualSpectrum: 'Safe Corridor // Dim Amber Flare',
        occultIndex: 'Evac Band Authenticated',
        threatProfile: 'LOW // IMMEDIATE EVAC AVAILABLE',
        threatBand: 'LOW',
      },
      resonanceDelta: 0,
      isFocused: true,
      yieldMultiplier: 1,
      creditBonus: 0,
      combatTier: 'STANDARD',
    },
  };
}

/** Hostile decoy masquerading as an extraction link after VECTOR_SEVERED. */
export function createSeveredExtractionDecoy(stepIndex: number): IncursionNode {
  const id = `extraction-decoy-${stepIndex}`;
  return {
    id,
    encounterIndex: stepIndex,
    index: stepIndex,
    encounterType: 'COMBAT',
    type: 'ELITE_COMBAT',
    label: 'SIGNAL: EMERGENCY EXTRACTION LINK',
    isCompleted: false,
    isExtractionNode: true,
    sectorMeta: {
      spectral: {
        radialFrequency: 'Extraction Conduit Stabilizing',
        visualSpectrum: 'Safe Corridor // Dim Amber Flare',
        occultIndex: 'Evac Band Authenticated',
        threatProfile: 'LOW // IMMEDIATE EVAC AVAILABLE',
        threatBand: 'LOW',
      },
      resonanceDelta: RESONANCE_DELTA_HIGH,
      isFocused: false,
      yieldMultiplier: 1,
      creditBonus: 0,
      combatTier: 'ELITE',
    },
  };
}

export function createAnomalyNestVector(graphNode: SectorGraphNode, stepIndex: number): IncursionNode {
  return graphNodeToIncursionNode(
    {
      ...graphNode,
      label: 'SIGNAL: ANOMALY NEST // PRIME TARGET',
    },
    stepIndex,
  );
}

export interface BuildScannerClusterOptions {
  graph: SectorGraph;
  currentNodeId: string;
  nodesCleared: number;
  resonancePercent: number;
  bossDefeated: boolean;
  greedZoneActive: boolean;
  clearedSafeAnchors?: readonly number[];
  extractionDecoyPending?: boolean;
  relayExtractionNodeId?: string | null;
  collapseActive?: boolean;
  masterLinkUsed?: boolean;
  lastLevelOfferedCombat?: boolean;
  /** Apply current macro biome flavor to forward vectors. */
  macroBiomeFamily?: import('../types/narrativeProcedural').MacroBiomeFamily | null;
  sanctuarySchedule?: SanctuarySchedule;
  runSegment?: import('./encounterGenerator').RunSegmentState | null;
}

/** Synthetic extraction ids are not stored in the sector graph. */
export function resolveScannerGraphNodeId(graph: SectorGraph, currentNodeId: string): string {
  if (graph.nodes[currentNodeId]) return currentNodeId;
  return graph.entryId;
}

/**
 * Lazily extends a leaf node so the scanner never dead-ends on empty child lists.
 * Returns a new graph reference when children are added.
 */
export function ensureForwardVectorsOnGraph(
  graph: SectorGraph,
  currentNodeId: string,
  minForward = 2,
): SectorGraph {
  const resolvedId = resolveScannerGraphNodeId(graph, currentNodeId);
  const current = graph.nodes[resolvedId];
  if (!current) return graph;
  if (current.graphDepth >= MAX_SECTOR_NODES) return graph;

  const openChildren = current.childIds.filter((id) => !graph.nodes[id]?.isCompleted);
  if (openChildren.length > 0) return graph;

  const nodes = { ...graph.nodes };
  let parent = { ...current };
  const toSpawn = Math.max(minForward, 2);
  let spawnIndex = Object.keys(nodes).length;

  for (let i = 0; i < toSpawn; i += 1) {
    spawnIndex += 1;
    const childId = `sector-forward-${resolvedId}-${spawnIndex}`;
    const child = makeGraphNode(childId, parent.graphDepth + 1, resolvedId, graph.sectorTier);
    nodes[childId] = child;
    parent = { ...parent, childIds: [...parent.childIds, childId] };
  }
  nodes[resolvedId] = parent;

  return { ...graph, nodes };
}

export function buildScannerCluster(options: BuildScannerClusterOptions): IncursionNode[] {
  const {
    graph: inputGraph,
    currentNodeId,
    nodesCleared,
    resonancePercent,
    bossDefeated,
    clearedSafeAnchors = [],
    extractionDecoyPending = false,
    relayExtractionNodeId = null,
    collapseActive = false,
    masterLinkUsed = false,
    lastLevelOfferedCombat = true,
    macroBiomeFamily = null,
    sanctuarySchedule,
    runSegment = null,
  } = options;

  let graph = inputGraph;
  if (collapseActive) {
    graph = appendCollapseForwardNodes(graph, currentNodeId, 2);
  }
  const resolvedNodeId = resolveScannerGraphNodeId(graph, currentNodeId);
  const current = graph.nodes[resolvedNodeId];
  if (!current) return [];

  const stepIndex = nodesCleared;
  const upcomingDepth = depthFromNodesCleared(nodesCleared);
  const localLevel = localLevelFromDepth(upcomingDepth);
  const district = getDistrictFromDepth(upcomingDepth);

  let cluster: IncursionNode[];

  if (isDistrictGateDepth(upcomingDepth) && !bossDefeated) {
    const gateId = upcomingDepth === 45
      ? 'sector-boss-nest'
      : `sector-gate-${upcomingDepth}`;
    const gateNode = graph.nodes[gateId];
    if (gateNode && !gateNode.isCompleted) {
      cluster = [graphNodeToIncursionNode(gateNode, stepIndex)];
    } else {
      cluster = materializeLevelCluster({
        graphDepth: upcomingDepth,
        district,
        nodesCleared,
        sectorTier: graph.sectorTier,
        lastLevelOfferedCombat,
        seed: `gate:${upcomingDepth}:${nodesCleared}`,
        runSegment,
      });
    }
  } else if (collapseActive) {
    cluster = current.childIds
      .filter((childId) => !graph.nodes[childId]?.isCompleted)
      .map((childId) => graphNodeToIncursionNode(graph.nodes[childId], stepIndex));
  } else {
    cluster = materializeLevelCluster({
      graphDepth: upcomingDepth,
      district,
      nodesCleared,
      sectorTier: graph.sectorTier,
      lastLevelOfferedCombat,
      seed: `level:${upcomingDepth}:${nodesCleared}`,
      runSegment,
    });
  }

  const schedule = sanctuarySchedule ?? { 1: [14], 2: [14], 3: [14] };

  if (
    !isDistrictGateDepth(upcomingDepth)
    && isSanctuaryScheduledLevel(schedule, district, localLevel)
    && !cluster.some((node) => node.type === 'SANCTUARY' && !node.isExtractionNode)
  ) {
    cluster.push(createSanctuaryNode(stepIndex, localLevel));
  }

  if (isFullBlindZone(nodesCleared)) {
    cluster = cluster.filter((node) => node.type !== 'BLACK_MARKET');
  }

  if (relayExtractionNodeId) {
    const relay = graph.nodes[relayExtractionNodeId];
    if (relay && !relay.isCompleted && current.childIds.includes(relayExtractionNodeId)) {
      const relayNode = graphNodeToIncursionNode(
        {
          ...relay,
          label: 'SIGNAL: RELAY EXTRACTION CONDUIT',
          isExtraction: true,
        },
        stepIndex,
      );
      relayNode.isExtractionNode = true;
      relayNode.sectorMeta = {
        ...relayNode.sectorMeta!,
        isFocused: true,
        spectral: {
          radialFrequency: 'Relay Conduit // Deep Evac Band',
          visualSpectrum: 'Amber Corridor // Authenticated',
          occultIndex: 'Relocated Extraction Tag',
          threatProfile: 'LOW // SEVERED RELAY ACTIVE',
          threatBand: 'LOW',
        },
      };
      cluster.push(relayNode);
    }
  }

  if (extractionDecoyPending && nodesCleared > 21) {
    cluster.push(createSeveredExtractionDecoy(stepIndex));
  }

  if (bossDefeated && !masterLinkUsed) {
    cluster.unshift(createMasterExtractionNode(stepIndex));
    if (!collapseActive) {
      cluster.push(createCollapseEntryNode(stepIndex));
      return cluster.slice(0, SCANNER_MAX_VECTORS);
    }
  }

  if (district === 1 && isDistrict1ExtractionLevel(district, localLevel)) {
    const d1Anchor = district1ExtractionAnchorForLocalLevel(localLevel);
    if (
      d1Anchor != null
      && !clearedSafeAnchors.includes(d1Anchor)
      && !cluster.some(
        (node) => node.type === 'SAFE_ANCHOR_EXTRACTION' && node.safeAnchorIndex === d1Anchor,
      )
    ) {
      cluster.unshift(createSafeAnchorExtractionNode(d1Anchor, stepIndex));
    }
  } else {
    const anchorIndex = safeAnchorIndexForCrossingDepth(current.graphDepth + 1);
    if (
      anchorIndex != null
      && isCleanExtractionAvailable(nodesCleared)
      && !clearedSafeAnchors.includes(anchorIndex)
    ) {
      cluster.unshift(createSafeAnchorExtractionNode(anchorIndex, stepIndex));
    }
  }

  if (!bossDefeated && resonancePercent >= BOSS_NEST_SOFT_RESONANCE) {
    const nest = Object.values(graph.nodes).find(
      (node) => node.isAnomalyNest && !node.isCompleted,
    );
    if (nest) {
      const alreadyInCluster = cluster.some((node) => node.id === nest.id);
      if (!alreadyInCluster) {
        const nestRoll = (hashSeed(`${nest.id}:${stepIndex}:${nodesCleared}`) % 1000) / 1000;
        if (resonancePercent >= BOSS_NEST_HARD_RESONANCE || nestRoll < 0.45) {
          cluster.push(createAnomalyNestVector(nest, stepIndex));
        }
      }
    }
  }

  if (resonancePercent >= BOSS_SIGNATURE_RESONANCE && !bossDefeated) {
    cluster.forEach((node) => {
      if (!node.sectorMeta || node.sectorMeta.isFocused) return;
      node.sectorMeta.spectral = {
        ...node.sectorMeta.spectral,
        radialFrequency: `${node.sectorMeta.spectral.radialFrequency} // BOSS SIGNATURE BLEED`,
      };
    });
  }

  const baseCap = collapseActive
    ? SCANNER_MAX_VECTORS
    : maxVectorsForLocalLevel(localLevel);
  cluster = dedupeScannerClusterNodes(cluster);
  const vectorCap = Math.max(baseCap, Math.min(cluster.length, SCANNER_MAX_VECTORS + 2));
  const trimmed = cluster.slice(0, vectorCap);
  if (macroBiomeFamily) {
    return applyMacroBiomeToCluster(trimmed, macroBiomeFamily);
  }
  return trimmed;
}

export function applyResonanceDelta(
  current: number,
  delta: number,
  multiplier = 1,
  uncapped = false,
  cap = 100,
): number {
  const scaled = Math.round(delta * multiplier * 10) / 10;
  const next = current + scaled;
  if (uncapped) return Math.min(cap, Math.max(0, next));
  return Math.min(100, Math.max(0, next));
}

const TERMINAL_BLIND_CORRUPT_FRAGMENTS = [
  '█▓░NULL░▓█',
  'CORRUPT//',
  '▒▒▒',
  '??',
  'PHASE_NOISE',
] as const;

function corruptTelemetryField(value: string, seed: number): string {
  const parts = value.split(' // ');
  return parts
    .map((part, index) => {
      const corrupt = TERMINAL_BLIND_CORRUPT_FRAGMENTS[(seed + index) % TERMINAL_BLIND_CORRUPT_FRAGMENTS.length];
      if (part.length <= 4) return corrupt;
      const keep = Math.max(2, Math.floor(part.length * 0.25));
      return `${part.slice(0, keep)}${corrupt}${part.slice(-2)}`;
    })
    .join(' // ');
}

export function formatSpectralBlock(
  meta: NodeSectorMeta,
  focused: boolean,
  terminalBlind = false,
): string[] {
  const spectral = terminalBlind
    ? {
        ...meta.spectral,
        radialFrequency: corruptTelemetryField(meta.spectral.radialFrequency, 1),
        visualSpectrum: corruptTelemetryField(meta.spectral.visualSpectrum, 2),
        occultIndex: corruptTelemetryField(meta.spectral.occultIndex, 3),
        threatProfile: 'UNKNOWN // TERMINAL_BLIND INTERFERENCE',
      }
    : meta.spectral;

  if (!focused) {
    return [
      `> RADIAL FREQUENCY: ${spectral.radialFrequency}`,
      `> VISUAL SPECTRUM:  ${spectral.visualSpectrum}`,
      `> OCCULT INDEX:     ${spectral.occultIndex}`,
      `> THREAT PROFILE:   ${spectral.threatProfile}`,
      ...(terminalBlind ? ['> SCANNER STATUS:   TERMINAL_BLIND // FOCUS DISABLED'] : []),
    ];
  }
  return [
    `> RADIAL FREQUENCY: ${spectral.radialFrequency}`,
    `> VISUAL SPECTRUM:  ${spectral.visualSpectrum}`,
    `> OCCULT INDEX:     ${spectral.occultIndex}`,
    `> THREAT PROFILE:   ${spectral.threatProfile}`,
    `> YIELD MULTIPLIER: x${meta.yieldMultiplier.toFixed(2)}`,
  ];
}

export function applyVectorSeveredToGraph(
  graph: SectorGraph,
  relayNodeId: string,
): SectorGraph {
  const nodes = { ...graph.nodes };
  const relay = nodes[relayNodeId];
  if (!relay) return graph;
  nodes[relayNodeId] = {
    ...relay,
    isExtraction: true,
    sectorMeta: {
      ...relay.sectorMeta,
      isFocused: true,
      spectral: {
        radialFrequency: 'Relay Conduit // Deep Evac Band',
        visualSpectrum: 'Amber Corridor // Authenticated',
        occultIndex: 'Relocated Extraction Tag',
        threatProfile: 'LOW // SEVERED RELAY ACTIVE',
        threatBand: 'LOW',
      },
    },
  };
  return { ...graph, nodes };
}

export function formatFocusedIntel(node: IncursionNode): string[] {
  const lines = [
    `TYPE: ${node.type.replace(/_/g, ' ')}`,
  ];
  if ((node.sectorMeta?.creditBonus ?? 0) > 0) {
    lines.push(`CREDIT BONUS: +${node.sectorMeta?.creditBonus}`);
  }
  if (node.sectorMeta?.combatTier === 'ELITE') {
    lines.push('COMBAT TIER: ELITE');
  }
  if (node.isAnomalyNest) {
    lines.push('PRIME ANOMALY NEST DETECTED');
  }
  if (node.type === 'SAFE_ANCHOR_EXTRACTION') {
    lines.push(`SAFE ANCHOR ${node.safeAnchorIndex ?? ''} — CLEAN EVAC CONDUIT`);
    lines.push('ZERO PENALTY EXTRACTION — ENGAGE FOR REVIEW');
  } else if (node.type === 'MASTER_EXTRACTION_LINK') {
    lines.push('MASTER EXTRACTION LINK — GUARANTEED CLEAN EXIT');
    lines.push('MAXIMUM PAYOUT // PRIME CONDUIT AUTHENTICATED');
  } else if (node.isExtractionNode) {
    lines.push('EMERGENCY EXTRACTION CONDUIT');
  }
  if (node.type === 'RESOURCE_HARVEST') {
    lines.push('VOLATILE RESOURCE NODE — YIELD CHOICE ON ENGAGE');
  }
  return lines;
}

export function getGreedZoneActive(nodesCleared: number): boolean {
  return nodesCleared >= EXTRACTION_AVAILABLE_AFTER_CLEARED;
}
