import { BossPhaseConfiguration, BossRuntimeProfile, IncursionNode, RunNodeType } from '../types/game';
import { EncounterType, RadarDot, SectorDefinition } from '../types/run';
import { INITIAL_SECTOR_POOL } from './regions';

const TIER_LABELS: Record<number, string> = {
  1: 'THRESHOLD',
  2: 'DEEP BLEED',
  3: 'ABYSSAL CORE',
};

export const NODE_TYPE_DISPLAY: Record<RunNodeType, string> = {
  STANDARD_COMBAT: 'UNMANIFESTED DISTORTION',
  NARRATIVE_EVENT: 'CURSED SHRINE',
  SANCTUARY: 'PURIFIED SPRING',
  BOSS_COMBAT: 'THE MANIFESTED CORE',
  ELITE_COMBAT: 'REGION-PRIME ELITE',
};

const NODE_VECTOR_TAG: Record<RunNodeType, string> = {
  NARRATIVE_EVENT: 'NARRATIVE',
  STANDARD_COMBAT: 'COMBAT',
  ELITE_COMBAT: 'ELITE',
  BOSS_COMBAT: 'BOSS',
  SANCTUARY: 'SANCTUARY',
};

function randomClusterCount(): number {
  return 2 + Math.floor(Math.random() * 4);
}

function rollCombatOrNarrative(): RunNodeType {
  return Math.random() < 0.5 ? 'STANDARD_COMBAT' : 'NARRATIVE_EVENT';
}

function makeVectorNode(
  tier: number,
  scanIndex: number,
  optionIndex: number,
  type: RunNodeType,
): IncursionNode {
  const prefix = TIER_LABELS[tier] ?? `TIER ${tier}`;
  const display = NODE_TYPE_DISPLAY[type] ?? type;
  return {
    id: `t${tier}-s${scanIndex}-o${optionIndex}`,
    index: scanIndex,
    type,
    label: `${prefix} // ${display}`,
    isCompleted: false,
  };
}

/** Pre-generate 7 scan-depth vector clusters for a tier run. */
export function generateTierVectorMatrix(tier: number): {
  activeTierVectors: IncursionNode[][];
  earlySanctuarySpawned: boolean;
} {
  const matrix: IncursionNode[][] = [];
  let earlySanctuarySpawned = false;

  const scan0Count = randomClusterCount();
  matrix[0] = Array.from({ length: scan0Count }, (_, i) =>
    makeVectorNode(tier, 0, i, rollCombatOrNarrative()),
  );

  const sanctuaryScanIndex =
    Math.random() < 0.55 ? 1 + Math.floor(Math.random() * 4) : null;

  for (let scanIdx = 1; scanIdx <= 4; scanIdx += 1) {
    const count = randomClusterCount();
    const cluster: IncursionNode[] = [];
    const sanctuarySlot =
      sanctuaryScanIndex === scanIdx ? Math.floor(Math.random() * count) : -1;

    for (let i = 0; i < count; i += 1) {
      if (i === sanctuarySlot) {
        cluster.push(makeVectorNode(tier, scanIdx, i, 'SANCTUARY'));
        earlySanctuarySpawned = true;
      } else {
        cluster.push(makeVectorNode(tier, scanIdx, i, rollCombatOrNarrative()));
      }
    }
    matrix[scanIdx] = cluster;
  }

  matrix[5] = [makeVectorNode(tier, 5, 0, 'SANCTUARY')];
  matrix[6] = [makeVectorNode(tier, 6, 0, 'BOSS_COMBAT')];

  return { activeTierVectors: matrix, earlySanctuarySpawned };
}

export function createPlaceholderTierPath(): IncursionNode[] {
  return Array.from({ length: 7 }, (_, i) => ({
    id: `pending-${i}`,
    index: i,
    type: 'STANDARD_COMBAT' as RunNodeType,
    label: `SCAN ${i + 1} // AWAITING VECTOR`,
    isCompleted: false,
  }));
}

/** @deprecated Use generateTierVectorMatrix */
export function generateTierNodeChain(tier: number): IncursionNode[] {
  const { activeTierVectors } = generateTierVectorMatrix(tier);
  return activeTierVectors.map((cluster, scanIndex) => cluster[0] ?? makeVectorNode(tier, scanIndex, 0, 'STANDARD_COMBAT'));
}

function runNodeTypeToEncounterType(type: RunNodeType): EncounterType {
  switch (type) {
    case 'SANCTUARY':
      return 'REST';
    case 'NARRATIVE_EVENT':
      return 'SKILL_CHECK';
    default:
      return 'COMBAT';
  }
}

function layoutDotsOnRadar(
  nodes: IncursionNode[],
  coreDiameterPx: number,
  sector: SectorDefinition,
): RadarDot[] {
  const center = coreDiameterPx / 2;
  const minRadius = center * 0.22;
  const maxRadius = center * 0.78;
  const count = nodes.length;

  return nodes.map((node, i) => {
    const angleDeg = (360 / count) * i - 90;
    const rad = (angleDeg * Math.PI) / 180;
    const radius = minRadius + ((maxRadius - minRadius) * (0.35 + (i % 3) * 0.2));
    const x = center + Math.cos(rad) * radius;
    const y = center + Math.sin(rad) * radius;
    const display = NODE_TYPE_DISPLAY[node.type] ?? node.label;

    return {
      id: node.id,
      sector,
      encounterType: runNodeTypeToEncounterType(node.type),
      label: node.label,
      pingIndex: i + 1,
      pingLabel: `[${NODE_VECTOR_TAG[node.type]}] ${display}`,
      x,
      y,
      angleDeg: ((angleDeg % 360) + 360) % 360,
    };
  });
}

/** Build radar blips for every vector option at the current scan depth. */
export function generateTierNodeScanVectors(
  nodes: IncursionNode[],
  coreDiameterPx: number,
  sector: SectorDefinition = INITIAL_SECTOR_POOL[0],
): RadarDot[] {
  if (nodes.length === 0) return [];
  return layoutDotsOnRadar(nodes, coreDiameterPx, sector);
}

/** @deprecated Use generateTierNodeScanVectors */
export function generateTierNodeScanVector(
  node: IncursionNode,
  coreDiameterPx: number,
  sector: SectorDefinition = INITIAL_SECTOR_POOL[0],
): RadarDot {
  return layoutDotsOnRadar([node], coreDiameterPx, sector)[0];
}

export function getTierScale(tier: number): number {
  return 1 + (tier - 1) * 0.25;
}

const DEFAULT_BOSS_PHASES: BossPhaseConfiguration[] = [
  {
    phaseNumber: 1,
    phaseName: 'Standard Operations',
    triggerHpThreshold: 51,
    intentModifier: 'Low-tier conduit strikes',
  },
  {
    phaseNumber: 2,
    phaseName: 'Rift Overdrive',
    triggerHpThreshold: 50,
    intentModifier: 'Catastrophic overdrive discharge',
  },
];

export function createBossProfileForTier(tier: number): BossRuntimeProfile {
  const scale = getTierScale(tier);
  const profiles: Record<number, { name: string; maxHp: number }> = {
    1: { name: 'THE COLD-ROOM CONDUIT', maxHp: 100 },
    2: { name: 'RIVAL COMMANDER — VOID LANCER', maxHp: Math.floor(150 * scale) },
    3: { name: 'RIFT ENTITY PRIME', maxHp: 250 },
  };
  const def = profiles[tier] ?? profiles[1];
  return {
    name: def.name,
    maxHp: def.maxHp,
    currentHp: def.maxHp,
    currentPhase: 1,
    phases: DEFAULT_BOSS_PHASES,
    tier,
  };
}

export function isBossNodeType(type: RunNodeType): boolean {
  return type === 'BOSS_COMBAT' || type === 'ELITE_COMBAT';
}

export function nodeTypeRequiresScanner(type: RunNodeType): boolean {
  return type === 'STANDARD_COMBAT';
}

export function findVectorInCluster(
  cluster: IncursionNode[],
  nodeId: string,
): IncursionNode | null {
  return cluster.find((n) => n.id === nodeId) ?? null;
}
