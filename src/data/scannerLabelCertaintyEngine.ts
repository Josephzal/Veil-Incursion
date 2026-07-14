import type { ProceduralNodeType, ProceduralRunNode, ProceduralRunTree } from '../types/proceduralRunTree';
import type { DepthIdentityScanBias } from '../types/depthIdentity';
import type { NodeContextModifiers } from '../types/worldState';
import type { RunNodeType } from '../types/game';
import {
  DEGRADED_TYPE_SWAPS,
  SCANNER_LABEL_BASE_DEGRADE_CHANCE,
  SCANNER_LABEL_DEGRADE_CHANCE_CAP,
  SCANNER_LABEL_IMMUNE_TYPES,
  SCANNER_LABEL_STRANGE_SHARE,
  STRANGE_SCANNER_LABELS,
  type ScannerLabelCertainty,
  type ScannerLabelOverlay,
  getScannerLabelCertaintyDisplay,
} from './scannerLabelCertaintyCatalog';

export type { ScannerLabelCertainty, ScannerLabelOverlay };
export { getScannerLabelCertaintyDisplay };

function proceduralTypeToRunType(type: ProceduralNodeType): RunNodeType {
  switch (type) {
    case 'COMBAT':
      return 'STANDARD_COMBAT';
    case 'ELITE':
      return 'ELITE_COMBAT';
    case 'ANOMALY':
      return 'ANOMALY';
    case 'MARKET':
      return 'BLACK_MARKET';
    case 'EXTRACTION':
      return 'SAFE_ANCHOR_EXTRACTION';
    case 'SANCTUARY':
      return 'SANCTUARY';
    case 'RESOURCE':
      return 'RESOURCE_HARVEST';
    case 'GATEKEEPER':
      return 'BOSS_COMBAT';
    default:
      return 'STANDARD_COMBAT';
  }
}

export function resolveScannerLabelDegradeChance(
  depthIndex: 1 | 2 | 3,
  bias?: DepthIdentityScanBias | null,
): number {
  const base = SCANNER_LABEL_BASE_DEGRADE_CHANCE[depthIndex];
  const identity = bias?.scannerLabelDegradeChance ?? 0;
  return Math.min(SCANNER_LABEL_DEGRADE_CHANCE_CAP, base + identity);
}

function hashLabelSeed(treeSeed: number, depth: number, nodeId: string): number {
  let hash = (treeSeed + depth * 1103 + 17) >>> 0;
  for (let i = 0; i < nodeId.length; i += 1) {
    hash = (hash * 41 + nodeId.charCodeAt(i)) >>> 0;
  }
  return hash;
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

export function makeReliableScannerLabel(trueType: ProceduralNodeType): ScannerLabelOverlay {
  return { certainty: 'RELIABLE', displayedType: trueType };
}

export function rollScannerLabelOverlay(
  trueType: ProceduralNodeType,
  depthIndex: 1 | 2 | 3,
  rng: () => number,
  bias?: DepthIdentityScanBias | null,
): ScannerLabelOverlay {
  if ((SCANNER_LABEL_IMMUNE_TYPES as readonly string[]).includes(trueType)) {
    return makeReliableScannerLabel(trueType);
  }

  const chance = resolveScannerLabelDegradeChance(depthIndex, bias);
  if (rng() >= chance) {
    return makeReliableScannerLabel(trueType);
  }

  const strangeShare = SCANNER_LABEL_STRANGE_SHARE[depthIndex];
  if (rng() < strangeShare) {
    const phrases = STRANGE_SCANNER_LABELS[trueType];
    const strangeLabel = phrases[Math.floor(rng() * phrases.length)] ?? phrases[0]!;
    return {
      certainty: 'STRANGE',
      displayedType: trueType,
      strangeLabel,
    };
  }

  const swaps = DEGRADED_TYPE_SWAPS[trueType];
  const displayedType = swaps[Math.floor(rng() * swaps.length)] ?? trueType;
  return {
    certainty: 'DEGRADED',
    displayedType,
  };
}

export function isScannerLabelCorrupt(overlay: ScannerLabelOverlay | null | undefined): boolean {
  return overlay != null && overlay.certainty !== 'RELIABLE';
}

/** Twisted templates / mods that already act as scanner lies or lethal surprises. */
function isScannerLieTemplate(modifiers: NodeContextModifiers): boolean {
  return modifiers.twistedTemplate === 'FALSE_EXTRACTION_SIGNAL'
    || modifiers.twistedTemplate === 'FINAL_ROUTE_FRACTURE';
}

function isTelegraphedLethal(modifiers: NodeContextModifiers): boolean {
  return Boolean(
    modifiers.highRisk
    || modifiers.twistedTemplate === 'APEX_SHADOW'
    || modifiers.twistedTemplate === 'ANCHOR_CORE_BREACH'
    || modifiers.encounterModifier === 'CORE_SICK'
    || modifiers.encounterModifier === 'FOLDED'
    || modifiers.encounterModifier === 'UNSTABLE',
  );
}

/**
 * Never stack a false node-type label with an untelegraphed lethal.
 * Either clear the lie (when False Extraction / Final Route owns the lie)
 * or force HIGH RISK telegraph when other lethal stamps are present.
 */
export function reconcileScannerLieWithLethal(
  trueType: ProceduralNodeType,
  overlay: ScannerLabelOverlay | null | undefined,
  modifiers: NodeContextModifiers,
): { overlay: ScannerLabelOverlay; modifiers: NodeContextModifiers } {
  const reliable = makeReliableScannerLabel(trueType);
  if (!isScannerLabelCorrupt(overlay)) {
    return { overlay: overlay ?? reliable, modifiers };
  }

  if (isScannerLieTemplate(modifiers)) {
    return { overlay: reliable, modifiers };
  }

  if (isTelegraphedLethal(modifiers) && !modifiers.highRisk) {
    return {
      overlay: overlay!,
      modifiers: { ...modifiers, highRisk: true },
    };
  }

  return { overlay: overlay!, modifiers };
}

export function assignScannerLabelOverlaysForDepth(
  tree: ProceduralRunTree,
  depth: number,
  params: {
    depthIndex?: 1 | 2 | 3;
    depthIdentityBias?: DepthIdentityScanBias | null;
  },
): ProceduralRunTree {
  if (tree.rollSeed == null) return tree;
  const depthIndex = params.depthIndex ?? tree.macroDepthIndex ?? 1;
  const layerIds = tree.depthIndex[depth] ?? [];
  if (layerIds.length === 0) return tree;

  const nodes = { ...tree.nodes };
  let changed = false;

  for (const nodeId of layerIds) {
    const node = nodes[nodeId];
    if (!node || node.scannerLabelOverlay != null) continue;
    if (node.typeAssigned === false) continue;

    const rng = mulberry32(hashLabelSeed(tree.rollSeed, depth, nodeId));
    const overlay = rollScannerLabelOverlay(
      node.type,
      depthIndex,
      rng,
      params.depthIdentityBias,
    );
    nodes[nodeId] = { ...node, scannerLabelOverlay: overlay };
    changed = true;
  }

  return changed ? { ...tree, nodes } : tree;
}

export function resolveDisplayedScannerNodeType(
  node: Pick<ProceduralRunNode, 'type' | 'scannerLabelOverlay'>,
  options?: { fullyInterpreted?: boolean },
): {
  runType: RunNodeType;
  proceduralType: ProceduralNodeType;
  certainty: ScannerLabelCertainty;
  strangeLabel?: string;
  corrupt: boolean;
} {
  if (options?.fullyInterpreted) {
    return {
      runType: proceduralTypeToRunType(node.type),
      proceduralType: node.type,
      certainty: 'RELIABLE',
      corrupt: false,
    };
  }

  const overlay = node.scannerLabelOverlay ?? makeReliableScannerLabel(node.type);
  const displayed = overlay.certainty === 'DEGRADED' ? overlay.displayedType : node.type;
  return {
    runType: proceduralTypeToRunType(displayed),
    proceduralType: displayed,
    certainty: overlay.certainty,
    strangeLabel: overlay.strangeLabel,
    corrupt: isScannerLabelCorrupt(overlay),
  };
}

export function formatScannerNodeTypeReadout(
  node: Pick<ProceduralRunNode, 'type' | 'scannerLabelOverlay'>,
  options?: { fullyInterpreted?: boolean },
): { nodeTypeLine: string; certaintyLine: string | null } {
  const resolved = resolveDisplayedScannerNodeType(node, options);
  if (resolved.certainty === 'STRANGE' && resolved.strangeLabel) {
    return {
      nodeTypeLine: resolved.strangeLabel.toUpperCase(),
      certaintyLine: `> SCAN CERTAINTY: ${getScannerLabelCertaintyDisplay(resolved.certainty)}`,
    };
  }
  const label = resolved.proceduralType.replace(/_/g, ' ').toUpperCase();
  return {
    nodeTypeLine: label,
    certaintyLine: resolved.corrupt
      ? `> SCAN CERTAINTY: ${getScannerLabelCertaintyDisplay(resolved.certainty)}`
      : null,
  };
}

export function mergeScannerLabelIntoModifiers(
  modifiers: NodeContextModifiers,
  overlay: ScannerLabelOverlay | null | undefined,
  trueType: ProceduralNodeType,
): NodeContextModifiers {
  const reconciled = reconcileScannerLieWithLethal(trueType, overlay, modifiers);
  return {
    ...reconciled.modifiers,
    scannerLabelCertainty: reconciled.overlay.certainty,
    scannerDisplayedNodeType: reconciled.overlay.certainty === 'DEGRADED'
      ? reconciled.overlay.displayedType
      : trueType,
    scannerStrangeLabel: reconciled.overlay.strangeLabel,
    scannerLabelCorrupt: isScannerLabelCorrupt(reconciled.overlay),
  };
}
