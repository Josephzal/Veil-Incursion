import type { VeilBiome } from './encounterSpawn';
import type { EchoActivityLevel, OperationObjectiveKind, VeilAnchorType } from './worldState';

/** Depth 2 — one active Veil Distortion for the Breach district. */
export type VeilDistortionId =
  | 'BLEEDING_ARCHITECTURE'
  | 'MEMORY_CONTAMINATION'
  | 'PREDATORY_GEOMETRY'
  | 'UNSTABLE_MATTER'
  | 'RITUAL_PRESSURE';

/** Depth 3 — one active Deep Veil Law for the Deep Veil district. */
export type DeepVeilLawId =
  | 'THE_VEIL_REMEMBERS'
  | 'THE_WALLS_ARE_HUNGRY'
  | 'THE_ROADS_ARE_LOOPING'
  | 'THE_MACHINE_IS_PRAYING'
  | 'THE_SKY_IS_UNDERGROUND';

export interface DepthIdentityScanBias {
  echoSignalMultiplier: number;
  anchorSignalMultiplier: number;
  operationSignalMultiplier: number;
  highRiskMultiplier: number;
  highValueMultiplier: number;
  sanctuaryWeightMultiplier: number;
  extractionUncertainty: number;
  scannerLabelDegradeChance: number;
}

export interface VeilDistortionDefinition {
  id: VeilDistortionId;
  displayName: string;
  fantasy: string;
  effectSummary: string;
  favoredBiomes: readonly VeilBiome[];
  favoredAnchors: readonly VeilAnchorType[];
  favoredOperations: readonly OperationObjectiveKind[];
  favoredEchoActivity: readonly EchoActivityLevel[];
  resourceFocusKeywords: readonly string[];
  scanBias: DepthIdentityScanBias;
  intensifiesToLaw: DeepVeilLawId | null;
}

export interface DeepVeilLawDefinition {
  id: DeepVeilLawId;
  displayName: string;
  fantasy: string;
  effectSummary: string;
  favoredBiomes: readonly VeilBiome[];
  favoredAnchors: readonly VeilAnchorType[];
  favoredOperations: readonly OperationObjectiveKind[];
  scanBias: DepthIdentityScanBias;
}

export interface DepthIdentityRevealPayload {
  kind: 'DISTORTION' | 'LAW';
  id: VeilDistortionId | DeepVeilLawId;
  title: string;
  summary: string;
  intensified: boolean;
}

/** Combat / anomaly encounter rule modifiers — one per node max. */
export type EncounterModifierId =
  | 'MIRRORED'
  | 'BLEEDING'
  | 'UNSTABLE'
  | 'FOLDED'
  | 'STARVED'
  | 'RESONANT'
  | 'CORE_SICK';

/** Depth 2+ twisted encounter templates — overlays on existing node types. */
export type TwistedTemplateId =
  | 'CORRUPTED_SANCTUARY'
  | 'FALSE_EXTRACTION_SIGNAL'
  | 'RESOURCE_BLOOM'
  | 'MIRROR_COMBAT'
  | 'ANCHOR_VEIN'
  | 'ANCHOR_CORE_BREACH'
  | 'VEIL_PROPER_CACHE'
  | 'NO_EXIT_SANCTUARY'
  | 'FINAL_ROUTE_FRACTURE'
  | 'REALITY_TAX'
  | 'APEX_SHADOW';

export interface TwistedChoiceOption {
  value: string;
  label: string;
  detail: string;
}

export interface TwistedPendingChoice {
  templateId: TwistedTemplateId;
  nodeId: string;
  title: string;
  prompt: string;
  warnings: readonly string[];
  options: readonly TwistedChoiceOption[];
}

export interface TwistedOutcomeRecord {
  templateId: TwistedTemplateId;
  choiceValue: string;
  summary: string;
}

/** Run-scoped Depth 2/3 identity — frozen when each depth begins. */
export interface DepthIdentityState {
  activeVeilDistortion: VeilDistortionId | null;
  activeDeepVeilLaw: DeepVeilLawId | null;
  /** True when Depth 3 law came from intensifying the Depth 2 distortion. */
  intensifiedFromDistortion: boolean;
  /** Banner/toast payload shown once when the identity activates. */
  pendingReveal: DepthIdentityRevealPayload | null;
  /** Encounter modifiers rolled this run (for debrief). */
  encounterModifiersSeen: EncounterModifierId[];
  /** Encounter modifiers cleared via victory. */
  encounterModifiersCleared: EncounterModifierId[];
  /** UNSTABLE: next engagement gets elevated High-Risk chance. */
  pendingUnstablePressure: boolean;
  /** Depth 2 twisted templates rolled this run. */
  twistedTemplatesSeen: TwistedTemplateId[];
  /** Twisted templates resolved/cleared this run. */
  twistedTemplatesCleared: TwistedTemplateId[];
  /** Choice outcomes for debrief Depth Effects. */
  twistedOutcomes: TwistedOutcomeRecord[];
  /** Depth 2 variant designations defeated this run. */
  depth2VariantsDefeated: string[];
  /** Depth 3 exclusive / elite-tag designations defeated this run. */
  depth3ExclusivesDefeated: string[];
  /** Operation progress granted by depth-identity events this run. */
  depthIdentityOpProgressGained: number;
  /** In-run modal fork for a twisted template. */
  pendingTwistedChoice: TwistedPendingChoice | null;
  /** Bonus credits awarded after surviving a False Extraction intercept. */
  falseExtractBonusCreditsPending: number;
}

export function createDefaultDepthIdentityState(): DepthIdentityState {
  return {
    activeVeilDistortion: null,
    activeDeepVeilLaw: null,
    intensifiedFromDistortion: false,
    pendingReveal: null,
    encounterModifiersSeen: [],
    encounterModifiersCleared: [],
    pendingUnstablePressure: false,
    twistedTemplatesSeen: [],
    twistedTemplatesCleared: [],
    twistedOutcomes: [],
    depth2VariantsDefeated: [],
    depth3ExclusivesDefeated: [],
    depthIdentityOpProgressGained: 0,
    pendingTwistedChoice: null,
    falseExtractBonusCreditsPending: 0,
  };
}

export interface DepthIdentityRollContext {
  veilBiome: VeilBiome | null;
  anchorType: VeilAnchorType | null;
  operationKind: OperationObjectiveKind | null;
  echoActivity: EchoActivityLevel | null;
  resourceFocus: readonly string[];
  seed: string;
  anchorDistortionBias?: Partial<Record<VeilDistortionId, number>>;
  anchorLawBias?: Partial<Record<DeepVeilLawId, number>>;
  briefDistortionBias?: Partial<Record<VeilDistortionId, number>>;
  briefLawBias?: Partial<Record<DeepVeilLawId, number>>;
}
