import type { FactionType } from '../types/game';
import type { RunGenerationContext } from '../types/worldState';
import {
  PROCEDURAL_RUN_MAX_DEPTH,
  type ProceduralNodeType,
  type ProceduralRunNode,
  type ProceduralRunTree,
} from '../types/proceduralRunTree';
import {
  applyGatekeeperAnchorCore,
  createNodeModifierRollState,
  resolveTypeWeightsForDepth,
  rollNodeContextModifiers,
} from './nodeGenerationContextEngine';
import { rollProceduralResourcePool } from './proceduralResourceEngine';

export interface RunTreeGenerationParams {
  runGenerationContext?: RunGenerationContext | null;
  depthIndex?: 1 | 2 | 3;
}

const FACTION_POOL: FactionType[] = ['SOLARIS', 'LEGION', 'TERRAN_GRID'];

const UTILITY_TYPES: readonly ProceduralNodeType[] = [
  'MARKET',
  'SANCTUARY',
  'EXTRACTION',
  'RESOURCE',
];

const MAX_UTILITY_PER_PATH = 3;
const MIN_ELITE_PER_PATH = 3;
const MAX_ELITE_PER_PATH = 6;
const EARLY_DEPTH_MAX = 4;

const TYPE_WEIGHTS: { type: ProceduralNodeType; weight: number }[] = [
  { type: 'COMBAT', weight: 45 },
  { type: 'ANOMALY', weight: 25 },
  { type: 'ELITE', weight: 15 },
  { type: 'MARKET', weight: 5 },
  { type: 'EXTRACTION', weight: 5 },
  { type: 'SANCTUARY', weight: 5 },
  { type: 'RESOURCE', weight: 4 },
];

function resolveLayerTypeWeights(
  depth: number,
  params?: RunTreeGenerationParams,
): { type: ProceduralNodeType; weight: number }[] {
  const depthIndex = params?.depthIndex ?? 1;
  return resolveTypeWeightsForDepth(depth, depthIndex, params?.runGenerationContext);
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeightedType(
  candidates: { type: ProceduralNodeType; weight: number }[],
  rng: () => number,
): ProceduralNodeType {
  const total = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return 'COMBAT';
  let roll = rng() * total;
  for (const entry of candidates) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return candidates[0]?.type ?? 'COMBAT';
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pickTwoFactions(rng: () => number): [FactionType, FactionType] {
  const shuffled = shuffle(FACTION_POOL, rng);
  return [shuffled[0], shuffled[1]];
}

function connectDepthLayers(
  parents: ProceduralRunNode[],
  children: ProceduralRunNode[],
  rng: () => number,
): void {
  if (parents.length === 0 || children.length === 0) return;

  const childIds = children.map((child) => child.id);
  const shuffledChildren = shuffle(childIds, rng);

  shuffledChildren.forEach((childId, index) => {
    const parent = parents[index % parents.length];
    if (!parent.children.includes(childId)) {
      parent.children.push(childId);
    }
  });

  parents.forEach((parent, index) => {
    if (parent.children.length === 0) {
      parent.children.push(shuffledChildren[index % shuffledChildren.length]);
    }
  });

  parents.forEach((parent) => {
    if (rng() < 0.35 && children.length > 1) {
      const extra = shuffledChildren[Math.floor(rng() * shuffledChildren.length)];
      if (!parent.children.includes(extra)) {
        parent.children.push(extra);
      }
    }
  });
}

function getParentTypes(
  node: ProceduralRunNode,
  nodes: Record<string, ProceduralRunNode>,
): ProceduralNodeType[] {
  const parents: ProceduralNodeType[] = [];
  Object.values(nodes).forEach((candidate) => {
    if (candidate.children.includes(node.id)) {
      parents.push(candidate.type);
    }
  });
  return parents;
}

function isUtilityType(type: ProceduralNodeType): boolean {
  return (UTILITY_TYPES as readonly string[]).includes(type);
}

function candidateTypesForNode(
  depth: number,
  parentTypes: ProceduralNodeType[],
  params?: RunTreeGenerationParams,
): { type: ProceduralNodeType; weight: number }[] {
  const forbidden = new Set<ProceduralNodeType>();
  parentTypes.forEach((parentType) => {
    if (parentType !== 'COMBAT') forbidden.add(parentType);
  });

  const layerWeights = resolveLayerTypeWeights(depth, params);

  return layerWeights.filter((entry) => {
    if (forbidden.has(entry.type)) return false;
    if (depth <= EARLY_DEPTH_MAX && (entry.type === 'MARKET' || entry.type === 'SANCTUARY' || entry.type === 'EXTRACTION')) {
      return false;
    }
    return true;
  });
}

function assignNodeType(
  node: ProceduralRunNode,
  parentTypes: ProceduralNodeType[],
  rng: () => number,
  params?: RunTreeGenerationParams,
  forceType?: ProceduralNodeType,
): void {
  if (forceType) {
    node.type = forceType;
    return;
  }
  const candidates = candidateTypesForNode(node.depth, parentTypes, params);
  node.type = pickWeightedType(candidates.length > 0 ? candidates : [{ type: 'COMBAT', weight: 1 }], rng);
}

function enumeratePaths(
  nodes: Record<string, ProceduralRunNode>,
  depthIndex: Record<number, string[]>,
  bossNodeId: string,
): ProceduralRunNode[][] {
  const paths: ProceduralRunNode[][] = [];
  const entryIds = depthIndex[1] ?? [];

  const dfs = (nodeId: string, path: ProceduralRunNode[]) => {
    const node = nodes[nodeId];
    if (!node) return;
    const nextPath = [...path, node];
    if (node.id === bossNodeId || node.children.length === 0) {
      paths.push(nextPath);
      return;
    }
    node.children.forEach((childId) => dfs(childId, nextPath));
  };

  entryIds.forEach((id) => dfs(id, []));
  return paths;
}

function pathHasConsecutiveDuplicate(path: ProceduralRunNode[]): boolean {
  for (let i = 1; i < path.length; i += 1) {
    const prev = path[i - 1];
    const curr = path[i];
    if (curr.type === 'GATEKEEPER') continue;
    if (prev.type === curr.type && prev.type !== 'COMBAT') return true;
  }
  return false;
}

function countPathType(path: ProceduralRunNode[], matcher: (type: ProceduralNodeType) => boolean): number {
  return path.filter((node) => node.type !== 'GATEKEEPER' && matcher(node.type)).length;
}

function repairPathConstraints(
  nodes: Record<string, ProceduralRunNode>,
  depthIndex: Record<number, string[]>,
  bossNodeId: string,
  rng: () => number,
): void {
  const maxPasses = 48;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const paths = enumeratePaths(nodes, depthIndex, bossNodeId);
    let repaired = false;

    for (const path of paths) {
      for (let i = 1; i < path.length; i += 1) {
        const prev = path[i - 1];
        const curr = path[i];
        if (curr.type === 'GATEKEEPER') continue;
        if (prev.type === curr.type && curr.type !== 'COMBAT') {
          curr.type = 'COMBAT';
          repaired = true;
        }
      }

      let utilityCount = countPathType(path, isUtilityType);
      if (utilityCount > MAX_UTILITY_PER_PATH) {
        for (let i = path.length - 2; i >= 1 && utilityCount > MAX_UTILITY_PER_PATH; i -= 1) {
          const node = path[i];
          if (node.type === 'GATEKEEPER') continue;
          if (isUtilityType(node.type)) {
            node.type = 'COMBAT';
            utilityCount -= 1;
            repaired = true;
          }
        }
      }

      let eliteCount = countPathType(path, (type) => type === 'ELITE');
      if (eliteCount > MAX_ELITE_PER_PATH) {
        for (let i = 1; i < path.length - 1 && eliteCount > MAX_ELITE_PER_PATH; i += 1) {
          const node = path[i];
          if (node.type === 'ELITE') {
            node.type = 'COMBAT';
            eliteCount -= 1;
            repaired = true;
          }
        }
      }

      eliteCount = countPathType(path, (type) => type === 'ELITE');
      if (eliteCount < MIN_ELITE_PER_PATH) {
        for (let i = 1; i < path.length - 1 && eliteCount < MIN_ELITE_PER_PATH; i += 1) {
          const node = path[i];
          const parentTypes = getParentTypes(node, nodes);
          if (node.type === 'COMBAT' && !parentTypes.includes('ELITE')) {
            node.type = 'ELITE';
            eliteCount += 1;
            repaired = true;
          }
        }
      }
    }

    if (!repaired) break;
  }

  Object.values(nodes).forEach((node) => {
    if (node.depth <= EARLY_DEPTH_MAX && (node.type === 'MARKET' || node.type === 'SANCTUARY' || node.type === 'EXTRACTION')) {
      node.type = 'COMBAT';
    }
    const parentTypes = getParentTypes(node, nodes);
    parentTypes.forEach((parentType) => {
      if (parentType !== 'COMBAT' && node.type === parentType) {
        node.type = 'COMBAT';
      }
    });
  });
}

function attachResourcePools(
  nodes: Record<string, ProceduralRunNode>,
  seed: number,
): void {
  Object.values(nodes).forEach((node) => {
    if (node.type !== 'RESOURCE') {
      delete node.resourcePool;
      return;
    }
    const tierSuffix = node.contextModifiers?.highValueResource ? ':high' : '';
    node.resourcePool = rollProceduralResourcePool(node.depth, `${seed}:resource:${node.id}${tierSuffix}`);
  });
}

function createNode(
  id: string,
  depth: number,
  type: ProceduralNodeType,
  faction?: FactionType,
): ProceduralRunNode {
  return {
    id,
    depth,
    type,
    children: [],
    ...(faction != null ? { faction } : {}),
  };
}

function stampNodeContextModifiers(
  nodes: Record<string, ProceduralRunNode>,
  bossNodeId: string,
  params: RunTreeGenerationParams | undefined,
  rng: () => number,
): void {
  const depthIndex = params?.depthIndex ?? 1;
  const runContext = params?.runGenerationContext ?? null;
  const rollState = createNodeModifierRollState();

  Object.values(nodes).forEach((node) => {
    if (node.type === 'GATEKEEPER') return;
    node.contextModifiers = rollNodeContextModifiers(
      node.depth,
      node.type,
      depthIndex,
      runContext,
      rng,
      rollState,
    );
  });

  const boss = nodes[bossNodeId];
  if (boss) {
    let bossModifiers = rollNodeContextModifiers(
      boss.depth,
      boss.type,
      depthIndex,
      runContext,
      rng,
      rollState,
    );
    bossModifiers = applyGatekeeperAnchorCore(bossModifiers, depthIndex, runContext, rng);
    boss.contextModifiers = bossModifiers;
  }
}

/** Generate a full 15-depth branching run tree for one macro depth chapter. */
export function generateRunTree(
  seed: string | number = Date.now(),
  params?: RunTreeGenerationParams,
): ProceduralRunTree {
  const numericSeed = typeof seed === 'string'
    ? seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    : seed;
  const rng = mulberry32(numericSeed);
  const nodes: Record<string, ProceduralRunNode> = {};
  const depthLayerIndex: Record<number, string[]> = {};
  let idCounter = 0;
  const nextId = (depth: number) => {
    idCounter += 1;
    return `proc-node-d${depth}-${idCounter}`;
  };

  const register = (node: ProceduralRunNode) => {
    nodes[node.id] = node;
    if (!depthLayerIndex[node.depth]) depthLayerIndex[node.depth] = [];
    depthLayerIndex[node.depth].push(node.id);
  };

  let sanctuarySpawned = false;
  const [factionA, factionB] = pickTwoFactions(rng);
  const depth1: ProceduralRunNode[] = [
    createNode(nextId(1), 1, 'COMBAT', factionA),
    createNode(nextId(1), 1, 'COMBAT', factionB),
  ];
  depth1.forEach(register);

  let previousLayer = depth1;

  for (let depth = 2; depth <= 13; depth += 1) {
    const count = Math.floor(rng() * 4) + 1;
    const layer: ProceduralRunNode[] = [];
    for (let i = 0; i < count; i += 1) {
      const node = createNode(nextId(depth), depth, 'COMBAT');
      layer.push(node);
      register(node);
    }
    connectDepthLayers(previousLayer, layer, rng);
    layer.forEach((node, index) => {
      const parentTypes = getParentTypes(node, nodes);
      const forceSanctuary = depth === 7 && !sanctuarySpawned && index === count - 1;
      assignNodeType(node, parentTypes, rng, params, forceSanctuary ? 'SANCTUARY' : undefined);
      if (node.type === 'SANCTUARY') sanctuarySpawned = true;
    });
    previousLayer = layer;
  }

  const depth14Count = Math.floor(rng() * 3) + 1;
  const depth14: ProceduralRunNode[] = [];
  let depth14Sanctuary = false;
  for (let i = 0; i < depth14Count; i += 1) {
    const node = createNode(nextId(14), 14, 'COMBAT');
    depth14.push(node);
    register(node);
  }
  connectDepthLayers(previousLayer, depth14, rng);
  depth14.forEach((node, index) => {
    const parentTypes = getParentTypes(node, nodes);
    if (index === 0) {
      assignNodeType(node, parentTypes, rng, params, 'SANCTUARY');
    } else {
      assignNodeType(node, parentTypes, rng, params);
    }
    if (node.type === 'SANCTUARY') depth14Sanctuary = true;
  });
  if (!depth14Sanctuary) {
    depth14[0].type = 'SANCTUARY';
  }

  const boss = createNode(nextId(15), 15, 'GATEKEEPER');
  register(boss);
  depth14.forEach((node) => {
    if (!node.children.includes(boss.id)) {
      node.children.push(boss.id);
    }
  });

  repairPathConstraints(nodes, depthLayerIndex, boss.id, rng);
  stampNodeContextModifiers(nodes, boss.id, params, rng);
  attachResourcePools(nodes, numericSeed);

  const macroDepthIndex = params?.depthIndex ?? 1;

  return {
    nodes,
    depthIndex: depthLayerIndex,
    bossNodeId: boss.id,
    maxDepth: PROCEDURAL_RUN_MAX_DEPTH,
    macroDepthIndex,
  };
}

export {
  enumeratePaths,
  pathHasConsecutiveDuplicate,
  MAX_UTILITY_PER_PATH,
  MIN_ELITE_PER_PATH,
  MAX_ELITE_PER_PATH,
  EARLY_DEPTH_MAX,
};
