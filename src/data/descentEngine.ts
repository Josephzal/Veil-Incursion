import { BossPhaseConfiguration, BossRuntimeProfile, IncursionNode, RunNodeType } from '../types/game';
import { EncounterType, RadarDot, SectorDefinition } from '../types/run';
import { INITIAL_SECTOR_POOL } from './regions';

const NODE_VECTOR_TAG: Record<RunNodeType, string> = {
  NARRATIVE_EVENT: 'NARRATIVE',
  STANDARD_COMBAT: 'COMBAT',
  ELITE_COMBAT: 'ELITE',
  BOSS_COMBAT: 'BOSS',
  SANCTUARY: 'SANCTUARY',
};

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

/** Build a single radar blip for the active tier-node vector on the scanning hub. */
export function generateTierNodeScanVector(
  node: IncursionNode,
  coreDiameterPx: number,
  sector: SectorDefinition = INITIAL_SECTOR_POOL[0],
): RadarDot {
  const center = coreDiameterPx / 2;
  const radius = center * 0.55;
  const angleDeg = 38;
  const rad = (angleDeg * Math.PI) / 180;
  const x = center + Math.cos(rad) * radius;
  const y = center + Math.sin(rad) * radius;

  return {
    id: node.id,
    sector,
    encounterType: runNodeTypeToEncounterType(node.type),
    label: node.label,
    pingIndex: node.index + 1,
    pingLabel: `Vector ${node.index + 1}: [${NODE_VECTOR_TAG[node.type]}] ${node.label.split('//').pop()?.trim() ?? node.label}`,
    x,
    y,
    angleDeg,
  };
}

const TIER_LABELS: Record<number, string> = {
  1: 'THRESHOLD',
  2: 'DEEP BLEED',
  3: 'ABYSSAL CORE',
};

/** Node 1 entry: strict 50/50 combat vs narrative — never sanctuary. */
function rollNodeOneEntry(prefix: string): { type: RunNodeType; label: string } {
  const isCombat = Math.random() < 0.5;
  if (isCombat) {
    return { type: 'STANDARD_COMBAT', label: `${prefix} // UNMANIFESTED DISTORTION` };
  }
  return { type: 'NARRATIVE_EVENT', label: `${prefix} // CURSED SHRINE` };
}

/** Fixed 7-node chain per tier with optional tier-scaled labels. */
export function generateTierNodeChain(tier: number): IncursionNode[] {
  const prefix = TIER_LABELS[tier] ?? `TIER ${tier}`;
  const bossType: RunNodeType = tier >= 3 ? 'BOSS_COMBAT' : 'ELITE_COMBAT';
  const nodeOne = rollNodeOneEntry(prefix);

  const specs: Array<{ type: RunNodeType; label: string }> = [
    nodeOne,
    { type: 'STANDARD_COMBAT', label: `${prefix} // HOSTILE VECTOR ALPHA` },
    { type: 'STANDARD_COMBAT', label: `${prefix} // HOSTILE VECTOR BETA` },
    { type: 'SANCTUARY', label: `${prefix} // SANCTUARY ANCHOR` },
    { type: 'NARRATIVE_EVENT', label: `${prefix} // STRUCTURAL VENT EVENT` },
    { type: 'STANDARD_COMBAT', label: `${prefix} // HOSTILE VECTOR GAMMA` },
    { type: bossType, label: `${prefix} // REGION-PRIME CHECKPOINT` },
  ];

  return specs.map((spec, index) => ({
    id: `t${tier}-n${index + 1}`,
    index,
    type: spec.type,
    label: spec.label,
    isCompleted: false,
  }));
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
