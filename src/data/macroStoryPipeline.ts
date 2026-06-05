import {
  ActiveIncursionState,
  FactionType,
  IncursionBiome,
  IncursionProgressState,
  createDefaultIncursionProgressState,
} from '../types/game';
import {
  MacroStoryRunConfiguration,
  MacroStoryRunMode,
  OutcomeModifierMetric,
  OUTCOME_MODIFIER_MAX,
  OUTCOME_MODIFIER_MIN,
  createDefaultMacroStoryConfiguration,
} from '../types/macroStory';
import { INCURSION_DEPTH_COUNT } from '../types/run';
import {
  SECTOR_BLOCK_LAYOUT,
  SECTOR_CORE_DEPTH_INDICES,
  biomeForDepthIndex,
} from './biomeCombat';
import { createPlaceholderTierPath, generateTierVectorMatrix } from './descentEngine';

export { SECTOR_BLOCK_LAYOUT, SECTOR_CORE_DEPTH_INDICES } from './biomeCombat';

const RUN_MODE_WEIGHTS: { mode: MacroStoryRunMode; weight: number }[] = [
  { mode: 'STANDALONE', weight: 50 },
  { mode: 'CONTINUOUS_THREAD', weight: 30 },
  { mode: 'FACTION_OVERLAY', weight: 20 },
];

const THREAD_STORY_IDS = ['veil-thread-alpha', 'veil-thread-beta', 'operative-echo-chain'] as const;
const FACTION_STORY_IDS: Record<FactionType, string> = {
  TERRAN_GRID: 'overlay-terran-grid',
  LEGION: 'overlay-legion-pact',
  SOLARIS: 'overlay-solaris-covenant',
};

export function clampOutcomeModifier(value: number): number {
  if (value < OUTCOME_MODIFIER_MIN) return OUTCOME_MODIFIER_MIN;
  if (value > OUTCOME_MODIFIER_MAX) return OUTCOME_MODIFIER_MAX;
  return Math.round(value * 1000) / 1000;
}

/** Convert narrative percent delta (e.g. 5) to bounded unit fraction (0.05). */
export function percentToOutcomeModifier(pct: number): number {
  return clampOutcomeModifier(pct / 100);
}

export function appendOutcomeModifier(
  progress: IncursionProgressState,
  key: string,
  pctDelta: number,
  depthIndex?: number,
): IncursionProgressState {
  const entry: OutcomeModifierMetric = {
    key,
    value: percentToOutcomeModifier(pctDelta),
    appliedAtDepth: depthIndex,
  };
  return {
    ...progress,
    outcomeModifiers: [...progress.outcomeModifiers, entry],
  };
}

export function hasCollectedFlag(flags: readonly string[], flag: string): boolean {
  return flags.includes(flag);
}

export type ConditionalBranchKey =
  | 'city-06'
  | 'hospital-06'
  | 'lab-06'
  | 'sector-06';

export interface ConditionalBranchPreview {
  matrixId: ConditionalBranchKey;
  autoResolve: boolean;
  terminalLogHint: string;
  scenarioOverride?: string;
}

/** Switch lookup for downstream story dependencies (read-only, no side effects). */
export function resolveConditionalBranchPreview(
  matrixId: string,
  collectedFlags: readonly string[],
): ConditionalBranchPreview | null {
  switch (matrixId) {
    case 'city-06':
      if (hasCollectedFlag(collectedFlags, 'saved_operative')) {
        return {
          matrixId: 'city-06',
          autoResolve: true,
          terminalLogHint: '>> saved_operative — TOLL GRID AUTO-BYPASS AUTHORIZED.',
          scenarioOverride:
            'Transit pylons flash green. Your prior extraction codes clear the toll grid automatically — passage granted with stamina reserves reinforced.',
        };
      }
      if (hasCollectedFlag(collectedFlags, 'looted_operative')) {
        return {
          matrixId: 'city-06',
          autoResolve: true,
          terminalLogHint: '>> looted_operative — TOLL GRID TRIP ARMED.',
          scenarioOverride:
            'Toll pylons spike crimson. Operative drive signatures trip the grid — shield capacitors will be drained on forced passage.',
        };
      }
      return null;

    case 'hospital-06':
      if (hasCollectedFlag(collectedFlags, 'relic_extracted')) {
        return {
          matrixId: 'hospital-06',
          autoResolve: true,
          terminalLogHint: '>> relic_extracted — HARMONIC RESONANCE LOCK.',
          scenarioOverride:
            'The relic matrix stabilizes against your anchor field. Harmonic resonance reinforces structural shielding — no atmospheric decompression detected.',
        };
      }
      if (hasCollectedFlag(collectedFlags, 'shattered_tank')) {
        return {
          matrixId: 'hospital-06',
          autoResolve: true,
          terminalLogHint: '>> shattered_tank — DECOMPRESSION CASCADE.',
          scenarioOverride:
            'Cryo particulate erupts in a violent decompression wave. Anchor integrity will fracture unless emergency venting compensates.',
        };
      }
      return null;

    case 'lab-06':
      if (hasCollectedFlag(collectedFlags, 'telemetry_downloaded')) {
        return {
          matrixId: 'lab-06',
          autoResolve: true,
          terminalLogHint: '>> telemetry_downloaded — CORE MAPPING UPLINK ACTIVE.',
          scenarioOverride:
            'Telemetry cache synchronizes with sector-core navigation. Depth 9 calibration uplink grants +15% victory metric offset on Core-layer choices.',
        };
      }
      return null;

    default:
      return null;
  }
}

export function isSectorCoreDepth(depthIndex: number): boolean {
  const coreBlock = SECTOR_BLOCK_LAYOUT.find((block) => block.biome === 'SECTOR_CORE');
  if (coreBlock) {
    return depthIndex >= coreBlock.depthStart && depthIndex <= coreBlock.depthEnd;
  }
  return (SECTOR_CORE_DEPTH_INDICES as readonly number[]).includes(depthIndex);
}

/** +15% victory offset applies only to narrative choices at Core depths (8–9). */
export function coreLayerCalibrationBonus(
  depthIndex: number,
  progress: IncursionProgressState,
): number {
  if (!isSectorCoreDepth(depthIndex)) return 0;
  if (!hasCollectedFlag(progress.collectedFlags, 'telemetry_downloaded')) {
    return progress.narrativeModifiers.nodeNineCalibrationBonusPct;
  }
  return Math.max(progress.narrativeModifiers.nodeNineCalibrationBonusPct, 15);
}

export function rollMacroStoryRunProfile(
  alignedFaction: FactionType | null = null,
): MacroStoryRunConfiguration {
  const total = RUN_MODE_WEIGHTS.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;
  let mode: MacroStoryRunMode = 'STANDALONE';

  for (const entry of RUN_MODE_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) {
      mode = entry.mode;
      break;
    }
  }

  if (mode === 'CONTINUOUS_THREAD') {
    const id = THREAD_STORY_IDS[Math.floor(Math.random() * THREAD_STORY_IDS.length)];
    return { runMode: mode, macroStoryId: id };
  }

  if (mode === 'FACTION_OVERLAY' && alignedFaction) {
    return { runMode: mode, macroStoryId: FACTION_STORY_IDS[alignedFaction] };
  }

  if (mode === 'FACTION_OVERLAY') {
    return { runMode: mode, macroStoryId: 'overlay-unaligned-scout' };
  }

  return createDefaultMacroStoryConfiguration();
}

export function macroStoryModeLogLine(config: MacroStoryRunConfiguration): string {
  const idSuffix = config.macroStoryId ? ` // ID: ${config.macroStoryId.toUpperCase()}` : '';
  return `>> MACRO-STORY PROFILE: ${config.runMode.replace(/_/g, ' ')}${idSuffix}`;
}

export function sectorBlockLogLines(): string[] {
  return SECTOR_BLOCK_LAYOUT.map(
    (block) =>
      `>> SECTOR BLOCK ${block.label.toUpperCase()} [${block.depthStart}–${block.depthEnd}] → ${block.biome}`,
  );
}

export interface IncursionPipelineInit {
  activeTierVectors: ActiveIncursionState['activeTierVectors'];
  earlySanctuarySpawned: boolean;
  tierNodes: ActiveIncursionState['tierNodes'];
  progress: IncursionProgressState;
  initLogLines: string[];
}

/** Roll run format up-front, then generate the 10-step sector-block vector matrix. */
export function initializeIncursionPipeline(
  tier: number,
  alignedFaction: FactionType | null = null,
): IncursionPipelineInit {
  const macroStory = rollMacroStoryRunProfile(alignedFaction);
  const { activeTierVectors, earlySanctuarySpawned } = generateTierVectorMatrix(tier);

  const progress: IncursionProgressState = {
    ...createDefaultIncursionProgressState(),
    macroStory,
  };

  const initLogLines = [
    macroStoryModeLogLine(macroStory),
    '>> SECTOR-BLOCK LAYOUT LOCKED — 10-DEPTH CHRONOLOGY:',
    ...sectorBlockLogLines(),
    `>> BIOME ANCHOR LOCKED: ${biomeForDepthIndex(0)} (ALL DEPTHS)`,
    `>> DEPTH COUNT VERIFIED: ${INCURSION_DEPTH_COUNT}`,
  ];

  return {
    activeTierVectors,
    earlySanctuarySpawned,
    tierNodes: createPlaceholderTierPath(),
    progress,
    initLogLines,
  };
}

export function validateNodeBiomeForDepth(depthIndex: number, biome: IncursionBiome): boolean {
  return biomeForDepthIndex(depthIndex) === biome;
}
