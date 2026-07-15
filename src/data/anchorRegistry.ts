import type { AnchorScannerBias } from '../types/anchorProcedural';
import type {
  AnchorRealityRules,
  OperationObjectiveKind,
  ScannerSignalBias,
  VeilAnchorType,
} from '../types/worldState';

export interface AnchorDefinition {
  type: VeilAnchorType;
  theme: string;
  realityRules: AnchorRealityRules;
  /** Multipliers applied on top of base scanner bias at run start. */
  scannerSignalBias: Pick<
    ScannerSignalBias,
    'anchorSignalMultiplier' | 'echoSignalMultiplier' | 'operationSignalMultiplier' | 'highRiskMultiplier'
  >;
  resourceBias: readonly string[];
  threatModifier: number;
  rewardModifier: number;
  /** Shifts effective echo pressure: -1 calmer, +1 hotter. */
  echoActivityShift: -1 | 0 | 1;
  compatibleOperationTypes: readonly OperationObjectiveKind[];
  operationWeights: Partial<Record<OperationObjectiveKind, number>>;
  pressureLines: readonly string[];
  /** Per-node overlay roll multipliers applied during scanner generation. */
  signalRollModifiers: {
    anchorSignalChance: number;
    operationTargetChance: number;
    highValueResourceChance: number;
    echoSignalChance: number;
  };
}

export const ANCHOR_REGISTRY: Record<VeilAnchorType, AnchorDefinition> = {
  CHOIR_SPIRE: {
    type: 'CHOIR_SPIRE',
    theme: 'Resonance, Echo activity, harmonic corruption',
    realityRules: {
      combatBias: 0.05,
      eliteBias: 0.1,
      anomalyBias: 0.15,
      echoBias: 0.2,
      lootBias: 0.05,
      extractionRiskBias: 0.1,
    },
    scannerSignalBias: {
      anchorSignalMultiplier: 1.25,
      echoSignalMultiplier: 1.35,
      operationSignalMultiplier: 1.05,
      highRiskMultiplier: 1.05,
    },
    resourceBias: ['Echo Cores', 'Echo Glass Shard'],
    threatModifier: 0,
    rewardModifier: 0,
    echoActivityShift: 1,
    compatibleOperationTypes: ['ANCHOR_ASSAULT', 'ECHO_RECOVERY', 'RESOURCE_SURVEY'],
    operationWeights: { ANCHOR_ASSAULT: 4, ECHO_RECOVERY: 2, RESOURCE_SURVEY: 1 },
    pressureLines: [
      'Increased Anchor Signal chance',
      'Elevated Echo activity',
      'Higher Echo-related resource potential',
    ],
    signalRollModifiers: {
      anchorSignalChance: 1.3,
      operationTargetChance: 1,
      highValueResourceChance: 1,
      echoSignalChance: 1.25,
    },
  },
  LEY_NEXUS: {
    type: 'LEY_NEXUS',
    theme: 'Resource density, unstable geometry, valuable cargo',
    realityRules: {
      combatBias: 0,
      eliteBias: 0,
      anomalyBias: 0.1,
      echoBias: 0,
      lootBias: 0.25,
      extractionRiskBias: 0.05,
    },
    scannerSignalBias: {
      anchorSignalMultiplier: 0.9,
      echoSignalMultiplier: 0.85,
      operationSignalMultiplier: 1.15,
      highRiskMultiplier: 1,
    },
    resourceBias: ['Ley Slag', 'Anomalous Core'],
    threatModifier: -1,
    rewardModifier: 1,
    echoActivityShift: 0,
    compatibleOperationTypes: ['EXTRACTION_SURGE', 'RESOURCE_SURVEY', 'ANCHOR_ASSAULT'],
    operationWeights: { EXTRACTION_SURGE: 4, RESOURCE_SURVEY: 3, ANCHOR_ASSAULT: 1 },
    pressureLines: [
      'Increased resource anomaly chance',
      'Higher rare resource signals',
      'High-value resource overlays more likely',
    ],
    signalRollModifiers: {
      anchorSignalChance: 0.95,
      operationTargetChance: 1.1,
      highValueResourceChance: 1.55,
      echoSignalChance: 0.85,
    },
  },
  NULL_MONOLITH: {
    type: 'NULL_MONOLITH',
    theme: 'Scanner distortion, strange intel, reality suppression',
    realityRules: {
      combatBias: 0.1,
      eliteBias: 0.15,
      anomalyBias: 0.2,
      echoBias: 0.25,
      lootBias: 0,
      extractionRiskBias: 0.15,
    },
    scannerSignalBias: {
      anchorSignalMultiplier: 1.1,
      echoSignalMultiplier: 1.1,
      operationSignalMultiplier: 1.2,
      highRiskMultiplier: 1.1,
    },
    resourceBias: ['Null Filament', 'Encrypted Grid Drive'],
    threatModifier: 0,
    rewardModifier: 0,
    echoActivityShift: 0,
    compatibleOperationTypes: ['RESOURCE_SURVEY', 'ANCHOR_ASSAULT', 'EXTRACTION_SURGE'],
    operationWeights: { RESOURCE_SURVEY: 4, EXTRACTION_SURGE: 3, ANCHOR_ASSAULT: 1 },
    pressureLines: [
      'Increased anomaly node chance',
      'Elevated intel drop potential',
      'Scanner distortion near null bleed',
    ],
    signalRollModifiers: {
      anchorSignalChance: 1.1,
      operationTargetChance: 1.25,
      highValueResourceChance: 1,
      echoSignalChance: 1.05,
    },
  },
  RIFT_ENGINE: {
    type: 'RIFT_ENGINE',
    theme: 'Industrial breach, combat pressure, machinery distortion',
    realityRules: {
      combatBias: 0.15,
      eliteBias: 0.1,
      anomalyBias: 0.25,
      echoBias: 0.1,
      lootBias: 0.1,
      extractionRiskBias: 0.2,
    },
    scannerSignalBias: {
      anchorSignalMultiplier: 1.2,
      echoSignalMultiplier: 0.95,
      operationSignalMultiplier: 1.1,
      highRiskMultiplier: 1.15,
    },
    resourceBias: ['Transit Scrap', 'Ley Slag'],
    threatModifier: 1,
    rewardModifier: 0,
    echoActivityShift: 0,
    compatibleOperationTypes: ['ANCHOR_ASSAULT', 'BOSS_SUPPRESSION', 'EXTRACTION_SURGE'],
    operationWeights: { ANCHOR_ASSAULT: 3, BOSS_SUPPRESSION: 3, EXTRACTION_SURGE: 1 },
    pressureLines: [
      'Increased combat node chance',
      'Increased Anchor Signal chance',
      'Higher crafting material drop bias',
    ],
    signalRollModifiers: {
      anchorSignalChance: 1.25,
      operationTargetChance: 1.2,
      highValueResourceChance: 1.1,
      echoSignalChance: 0.95,
    },
  },
  ASHEN_HEART: {
    type: 'ASHEN_HEART',
    theme: 'Elite nests, boss pressure, calcified Veil growth',
    realityRules: {
      combatBias: 0.05,
      eliteBias: 0.25,
      anomalyBias: 0.15,
      echoBias: 0.3,
      lootBias: 0.15,
      extractionRiskBias: 0.25,
    },
    scannerSignalBias: {
      anchorSignalMultiplier: 1.05,
      echoSignalMultiplier: 1.2,
      operationSignalMultiplier: 1.15,
      highRiskMultiplier: 1.25,
    },
    resourceBias: ['Anomalous Core', 'Echo Cores'],
    threatModifier: 1,
    rewardModifier: 1,
    echoActivityShift: 1,
    compatibleOperationTypes: ['BOSS_SUPPRESSION', 'ANCHOR_ASSAULT', 'ECHO_RECOVERY'],
    operationWeights: { BOSS_SUPPRESSION: 4, ECHO_RECOVERY: 2, ANCHOR_ASSAULT: 1 },
    pressureLines: [
      'Increased elite encounter pressure',
      'Boss-linked threat elevated',
      'Higher threat and reward near calcified growth',
    ],
    signalRollModifiers: {
      anchorSignalChance: 1.05,
      operationTargetChance: 1.35,
      highValueResourceChance: 1.05,
      echoSignalChance: 1.15,
    },
  },
};

export function getAnchorDefinition(anchorType: VeilAnchorType): AnchorDefinition {
  return ANCHOR_REGISTRY[anchorType];
}

export function getAnchorRealityRules(anchorType: VeilAnchorType): AnchorRealityRules {
  return { ...ANCHOR_REGISTRY[anchorType].realityRules };
}

export function getAnchorOperationWeights(
  anchorType: VeilAnchorType | null,
): Partial<Record<OperationObjectiveKind, number>> {
  if (!anchorType) return {};
  return { ...ANCHOR_REGISTRY[anchorType].operationWeights };
}

export function getAnchorPressureLines(anchorType: VeilAnchorType): readonly string[] {
  return ANCHOR_REGISTRY[anchorType].pressureLines;
}

export function buildScannerSignalBiasFromAnchor(
  anchorType: VeilAnchorType | null,
  opts: {
    hazardLevel: number;
    echoActivity: 'LOW' | 'ELEVATED' | 'CRITICAL';
    anchorActive: boolean;
    proceduralScannerBias?: AnchorScannerBias;
  },
): ScannerSignalBias {
  const def = anchorType ? ANCHOR_REGISTRY[anchorType] : null;
  const hazardScale = 1 + opts.hazardLevel * 0.05;
  const echoBase = opts.echoActivity === 'CRITICAL'
    ? 1.4
    : opts.echoActivity === 'ELEVATED'
      ? 1.15
      : 0.85;

  if (!opts.anchorActive || !def) {
    return {
      anchorSignalMultiplier: 0.5,
      echoSignalMultiplier: echoBase,
      operationSignalMultiplier: 1,
      highRiskMultiplier: 1 + opts.hazardLevel * 0.08,
    };
  }

  const proc = opts.proceduralScannerBias;
  const anchorMult = proc?.anchorSignalMultiplier ?? def.scannerSignalBias.anchorSignalMultiplier;
  const echoMult = proc?.echoSignalMultiplier ?? def.scannerSignalBias.echoSignalMultiplier;
  const opMult = proc?.operationSignalMultiplier ?? def.scannerSignalBias.operationSignalMultiplier;
  const riskMult = proc?.highRiskMultiplier ?? def.scannerSignalBias.highRiskMultiplier;

  return {
    anchorSignalMultiplier: anchorMult * hazardScale,
    echoSignalMultiplier: echoMult * echoBase,
    operationSignalMultiplier: opMult,
    highRiskMultiplier: riskMult * (1 + opts.hazardLevel * 0.08),
  };
}
