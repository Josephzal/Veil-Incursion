import type { GeneratedContract } from './contract';
import type {
  CrisisTheme,
  ProceduralWorldMemory,
  RunWorldBrief,
} from './runWorldBrief';
import type { RunGenerationContext, SectorId, SectorState, WorldStatePersistedState } from './worldState';

export type ProceduralDirectorSeverity = 'OK' | 'WARNING' | 'ERROR';

export type ProceduralDirectorIssueCategory =
  | 'INVALID_CONTEXT'
  | 'IMPOSSIBLE_OBJECTIVE'
  | 'OVERLOADED_PRESSURE'
  | 'UNDER_MANIFESTED_CRISIS'
  | 'REPETITION'
  | 'UNSUPPORTED_SYSTEM'
  | 'REWARD_MISMATCH'
  | 'FAIRNESS';

export type ProceduralDirectorIssueLevel = 'INFO' | 'WARNING' | 'ERROR';

export interface ProceduralDirectorIssue {
  id: string;
  severity: ProceduralDirectorIssueLevel;
  category: ProceduralDirectorIssueCategory;
  message: string;
  suggestedFix?: string;
}

export interface ProceduralDirectorAdjustment {
  id: string;
  reason: string;
  before?: unknown;
  after?: unknown;
  applied: boolean;
}

export type RunPressureLabel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface RunPressureScore {
  total: number;
  combatPressure: number;
  elitePressure: number;
  scannerUncertainty: number;
  extractionPressure: number;
  cargoPressure: number;
  unstablePressure: number;
  echoPressure: number;
  anchorPressure: number;
  rivalPressure: number;
  rewardPressure: number;
  label: RunPressureLabel;
}

export type ProceduralManifestationType =
  | 'SCANNER_OVERLAY'
  | 'CONTRACT'
  | 'OPERATION_TARGET'
  | 'ENCOUNTER_MODIFIER'
  | 'REWARD_BIAS'
  | 'DEPTH_DISTORTION'
  | 'DEPTH_LAW'
  | 'DEBRIEF_CALLOUT'
  | 'ANCHOR_PRESSURE'
  | 'RESOURCE_STRESS';

export interface ProceduralManifestation {
  type: ProceduralManifestationType;
  id: string;
  description: string;
}

export interface CrisisManifestationResult {
  crisisTheme: CrisisTheme;
  requiredManifestations: number;
  actualManifestations: ProceduralManifestation[];
  passed: boolean;
  missingManifestations: string[];
  appliedFixes: ProceduralDirectorAdjustment[];
}

export interface ProceduralRepeatReport {
  sectorId: SectorId;
  recentCrisisThemes: CrisisTheme[];
  recentOperationKinds: string[];
  recentContractResources: string[];
  warnings: string[];
}

export interface ProceduralExplainabilitySummary {
  title: string;
  cause: string;
  pressureChips: string[];
  expectedSignals: string[];
  expectedRewards: string[];
  warning?: string;
  pressureLabel?: RunPressureLabel;
  activeAftermath?: string[];
}

export type {
  SectorAftermathType,
  SectorAftermathTag,
  SectorAftermathSource,
  SectorAftermathModifier,
  RunAftermathInput,
  AftermathGenerationResult,
  AftermathDebriefLine,
} from './proceduralAftermath';

import type { SectorAftermathModifier } from './proceduralAftermath';

export { MAX_SECTOR_AFTERMATH_MODIFIERS } from './proceduralAftermath';

export interface ProceduralDirectorContext {
  persisted: WorldStatePersistedState;
  sectorState: SectorState;
  contractBoard: GeneratedContract[];
  selectedContractId: string | null;
  memory?: ProceduralWorldMemory;
  aftermathModifiers?: SectorAftermathModifier[];
}

export interface ProceduralDirectorResult {
  ok: boolean;
  severity: ProceduralDirectorSeverity;
  pressureScore: RunPressureScore;
  validationIssues: ProceduralDirectorIssue[];
  appliedAdjustments: ProceduralDirectorAdjustment[];
  manifestation: CrisisManifestationResult;
  repeatReport: ProceduralRepeatReport;
  explainability: ProceduralExplainabilitySummary;
}

export interface DirectedRunWorldBriefResult {
  brief: RunWorldBrief;
  director: ProceduralDirectorResult;
  fallbackUsed: boolean;
}

export interface SafetyCapResult {
  issues: ProceduralDirectorIssue[];
  adjustments: ProceduralDirectorAdjustment[];
  brief: RunWorldBrief;
}

export const MAX_DIRECTOR_PASSES = 3;

export const EMPTY_PRESSURE_SCORE: RunPressureScore = {
  total: 0,
  combatPressure: 0,
  elitePressure: 0,
  scannerUncertainty: 0,
  extractionPressure: 0,
  cargoPressure: 0,
  unstablePressure: 0,
  echoPressure: 0,
  anchorPressure: 0,
  rivalPressure: 0,
  rewardPressure: 0,
  label: 'LOW',
};

/** @deprecated Use RunAftermathInput from proceduralAftermath */
export type PostRunAftermathInput = import('./proceduralAftermath').RunAftermathInput;
