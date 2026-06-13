import {
  ActiveIncursionState,
  FactionType,
  IncursionProgressState,
  createDefaultIncursionProgressState,
} from '../types/game';
import {
  MacroStoryRunConfiguration,
  MacroStoryRunMode,
  OutcomeModifierMetric,
  OUTCOME_MODIFIER_MAX,
  OUTCOME_MODIFIER_MIN,
  SectorBlockSpec,
  createDefaultMacroStoryConfiguration,
} from '../types/macroStory';
import { INCURSION_ENCOUNTER_COUNT } from '../types/run';
import { createPlaceholderDepthPath, generateDepthEncounterMatrix } from './descentEngine';
import { generateSectorGraph } from './sectorGraphEngine';
import { MAX_ATTUNEMENT, STARTING_ATTUNEMENT } from '../types/sector';

export const SECTOR_BLOCK_LAYOUT: readonly SectorBlockSpec[] = [
  { encounterStart: 0, encounterEnd: 9, label: 'Streets' },
] as const;

export const SECTOR_CORE_ENCOUNTER_INDICES = [8, 9] as const;

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
  encounterIndex?: number,
): IncursionProgressState {
  const entry: OutcomeModifierMetric = {
    key,
    value: percentToOutcomeModifier(pctDelta),
    appliedAtEncounter: encounterIndex,
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
            'Telemetry cache synchronizes with sector-core navigation. Encounter 9 calibration uplink grants +15% victory metric offset on Core-layer choices.',
        };
      }
      return null;

    default:
      return null;
  }
}

export function isSectorCoreEncounter(encounterIndex: number): boolean {
  return (SECTOR_CORE_ENCOUNTER_INDICES as readonly number[]).includes(encounterIndex);
}

/** +15% victory offset applies only to narrative choices at Core encounters (8–9). */
export function coreLayerCalibrationBonus(
  encounterIndex: number,
  progress: IncursionProgressState,
): number {
  if (!isSectorCoreEncounter(encounterIndex)) return 0;
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
      `>> SECTOR BLOCK ${block.label.toUpperCase()} [${block.encounterStart}–${block.encounterEnd}]`,
  );
}

export interface IncursionPipelineInit {
  encounterOptionClusters: ActiveIncursionState['encounterOptionClusters'];
  earlySanctuarySpawned: boolean;
  encounterPath: ActiveIncursionState['encounterPath'];
  progress: IncursionProgressState;
  initLogLines: string[];
}

/** Roll run format up-front, then generate the 10-step sector-block vector matrix. */
export function initializeIncursionPipeline(
  depth: number,
  alignedFaction: FactionType | null = null,
): IncursionPipelineInit {
  const macroStory = rollMacroStoryRunProfile(alignedFaction);
  const { encounterOptionClusters, earlySanctuarySpawned } = generateDepthEncounterMatrix(depth);

  const progress: IncursionProgressState = {
    ...createDefaultIncursionProgressState(),
    macroStory,
  };

  const initLogLines = [
    macroStoryModeLogLine(macroStory),
    '>> SECTOR-BLOCK LAYOUT LOCKED — 10-ENCOUNTER CHRONOLOGY:',
    ...sectorBlockLogLines(),
    `>> ENCOUNTER COUNT VERIFIED: ${INCURSION_ENCOUNTER_COUNT}`,
  ];

  return {
    encounterOptionClusters,
    earlySanctuarySpawned,
    encounterPath: createPlaceholderDepthPath(),
    progress,
    initLogLines,
  };
}

export interface SectorRunInit {
  sectorGraph: ReturnType<typeof generateSectorGraph>;
  currentNodeId: string;
  nodesCleared: number;
  attunement: { current: number; max: number };
  resonance: { percent: number };
  focusedNodeIds: string[];
  bossDefeated: boolean;
  primeExtractionBonus: boolean;
  sectorTier: number;
  encounterPath: ActiveIncursionState['encounterPath'];
  progress: IncursionProgressState;
  initLogLines: string[];
}

/** Pre-generate open-sector graph and attunement state at run start. */
export function initializeSectorRun(
  sectorTier = 1,
  alignedFaction: FactionType | null = null,
): SectorRunInit {
  const macroStory = rollMacroStoryRunProfile(alignedFaction);
  const sectorGraph = generateSectorGraph(sectorTier);

  const progress: IncursionProgressState = {
    ...createDefaultIncursionProgressState(),
    macroStory,
  };

  const initLogLines = [
    macroStoryModeLogLine(macroStory),
    `>> OPEN SECTOR GRAPH GENERATED — MAX ${sectorGraph.maxGraphDepth} NODES // TIER ${sectorTier}`,
    '>> ATTUNEMENT CHARGED — 3 FOCUS USES AVAILABLE THIS RUN',
    '>> RESONANCE TELEMETRY ONLINE — SPECTRAL READOUT ACTIVE',
    '>> NODES 1–4: INFILTRATION ONLY — SAFE ANCHOR EXTRACTION LOCKED UNTIL NODE 5',
  ];

  return {
    sectorGraph,
    currentNodeId: sectorGraph.entryId,
    nodesCleared: 0,
    attunement: { current: STARTING_ATTUNEMENT, max: MAX_ATTUNEMENT },
    resonance: { percent: 0 },
    focusedNodeIds: [],
    bossDefeated: false,
    primeExtractionBonus: false,
    sectorTier,
    encounterPath: [],
    progress,
    initLogLines,
  };
}
