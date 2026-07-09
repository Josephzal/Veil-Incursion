import type { CargoRunState } from '../types/cargoGrid';
import type { RunGenerationContext } from '../types/worldState';
import type { ProceduralRunNode, ProceduralRunTree } from '../types/proceduralRunTree';
import {
  applyGatekeeperAnchorCore,
  rollNodeContextModifiers,
} from './nodeGenerationContextEngine';
import {
  buildCarriedCargoContextRollBias,
  formatLazyRollCargoPressureLog,
} from './unstableCargoEffectsEngine';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashNodeRollSeed(treeSeed: number, nodeId: string): number {
  let hash = treeSeed >>> 0;
  for (let i = 0; i < nodeId.length; i += 1) {
    hash = (hash * 31 + nodeId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function createNodeContextRng(treeSeed: number, nodeId: string): () => number {
  return mulberry32(hashNodeRollSeed(treeSeed, nodeId));
}

export function isLazyContextRollTree(tree: ProceduralRunTree): boolean {
  return tree.rollSeed != null && tree.modifierRollState != null;
}

export function nodeNeedsContextRoll(tree: ProceduralRunTree, nodeId: string): boolean {
  if (!isLazyContextRollTree(tree)) return false;
  const node = tree.nodes[nodeId];
  return node != null && node.contextModifiers == null;
}

export interface LazyNodeContextRollResult {
  tree: ProceduralRunTree;
  node: ProceduralRunNode | null;
  freshlyRolled: boolean;
  cargoPressureLog: string | null;
}

/** Roll Veil Front context modifiers at vector engagement using current cargo. */
export function ensureNodeContextModifiersAtEngagement(
  tree: ProceduralRunTree,
  nodeId: string,
  runContext: RunGenerationContext | null | undefined,
  cargo: CargoRunState,
): LazyNodeContextRollResult {
  const node = tree.nodes[nodeId] ?? null;
  if (!node) {
    return { tree, node: null, freshlyRolled: false, cargoPressureLog: null };
  }

  if (!isLazyContextRollTree(tree) || node.contextModifiers != null) {
    return { tree, node, freshlyRolled: false, cargoPressureLog: null };
  }

  const rollState = {
    echoSignalsUsed: tree.modifierRollState!.echoSignalsUsed,
    legendaryEchoUsed: tree.modifierRollState!.legendaryEchoUsed,
  };
  const rng = createNodeContextRng(tree.rollSeed!, nodeId);
  const cargoBias = buildCarriedCargoContextRollBias(cargo);
  const depthIndex = tree.macroDepthIndex ?? 1;

  let modifiers = rollNodeContextModifiers(
    node.depth,
    node.type,
    depthIndex,
    runContext,
    rng,
    rollState,
    cargoBias,
  );

  if (node.type === 'GATEKEEPER') {
    modifiers = applyGatekeeperAnchorCore(modifiers, depthIndex, runContext, rng);
  }

  const updatedNode: ProceduralRunNode = {
    ...node,
    contextModifiers: modifiers,
  };

  const nextTree: ProceduralRunTree = {
    ...tree,
    modifierRollState: rollState,
    nodes: {
      ...tree.nodes,
      [nodeId]: updatedNode,
    },
  };

  return {
    tree: nextTree,
    node: updatedNode,
    freshlyRolled: true,
    cargoPressureLog: formatLazyRollCargoPressureLog(modifiers, cargo),
  };
}
