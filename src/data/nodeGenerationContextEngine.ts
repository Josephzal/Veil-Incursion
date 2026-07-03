import type {
  NodeContextModifiers,
  NodePressureBand,
  OperationObjectiveKind,
  RunGenerationContext,
} from '../types/worldState';
import type { ProceduralNodeType } from '../types/proceduralRunTree';
import {
  ANCHOR_ASSAULT_CORE_CHANCE,
  ECHO_SIGNAL_CHANCE,
  MAX_ECHO_ENCOUNTERS_PER_RUN,
  MAX_LEGENDARY_ECHO_ENCOUNTERS_PER_RUN,
  buildDepthGenerationContext,
  getAnchorStage,
  getDepthStage,
  getNodePressureBand,
} from './worldStateHelpers';
import { stampEchoTemplateOnModifiers } from './echoRecoveryEngine';

export interface RunTreeGenerationOptions {
  runGenerationContext?: RunGenerationContext | null;
  depthIndex?: 1 | 2 | 3;
}

const BASE_TYPE_WEIGHTS: { type: ProceduralNodeType; weight: number }[] = [
  { type: 'COMBAT', weight: 45 },
  { type: 'ANOMALY', weight: 25 },
  { type: 'ELITE', weight: 15 },
  { type: 'MARKET', weight: 5 },
  { type: 'EXTRACTION', weight: 5 },
  { type: 'SANCTUARY', weight: 5 },
  { type: 'RESOURCE', weight: 4 },
];

function clampWeight(value: number): number {
  return Math.max(1, Math.round(value));
}

function pressureMultiplier(band: NodePressureBand): number {
  if (band === 'LOW') return 0.65;
  if (band === 'MEDIUM') return 1;
  return 1.35;
}

export function resolveTypeWeightsForDepth(
  proceduralDepth: number,
  depthIndex: 1 | 2 | 3,
  runContext?: RunGenerationContext | null,
): { type: ProceduralNodeType; weight: number }[] {
  const depthStage = getDepthStage(depthIndex);
  const stageMods = buildDepthGenerationContext(depthIndex, proceduralDepth).depthStageModifiers;
  const pressureBand = getNodePressureBand(proceduralDepth);
  const pressureScale = pressureMultiplier(pressureBand);

  const weights = BASE_TYPE_WEIGHTS.map((entry) => {
    let weight = entry.weight;

    switch (entry.type) {
      case 'COMBAT':
        weight *= 1 + stageMods.combatBias;
        break;
      case 'ELITE':
        weight *= 1 + stageMods.eliteBias * pressureScale;
        break;
      case 'ANOMALY':
        weight *= 1 + stageMods.anomalyBias * pressureScale;
        break;
      case 'RESOURCE':
      case 'MARKET':
      case 'SANCTUARY':
        if (depthStage === 'THRESHOLD') weight *= 1.15;
        if (depthStage === 'DEEP_VEIL') weight *= 0.85;
        if (pressureBand === 'LOW') weight *= 1.1;
        break;
      case 'EXTRACTION':
        if (depthStage === 'THRESHOLD' && proceduralDepth >= 5) weight *= 1.2;
        break;
      default:
        break;
    }

    if (runContext) {
      const bias = runContext.encounterBias;
      if (entry.type === 'COMBAT') weight *= 1 + bias.combatWeightDelta;
      if (entry.type === 'ELITE') weight *= 1 + bias.eliteWeightDelta;
      if (entry.type === 'ANOMALY') weight *= 1 + bias.anomalyWeightDelta;
    }

    return { type: entry.type, weight: clampWeight(weight) };
  });

  if (depthStage === 'DEEP_VEIL' && proceduralDepth >= 11) {
    return weights.map((entry) =>
      entry.type === 'ELITE'
        ? { ...entry, weight: clampWeight(entry.weight * 1.25) }
        : entry,
    );
  }

  return weights;
}

export interface NodeModifierRollState {
  echoSignalsUsed: number;
  legendaryEchoUsed: number;
}

export function createNodeModifierRollState(): NodeModifierRollState {
  return { echoSignalsUsed: 0, legendaryEchoUsed: 0 };
}

export function rollNodeContextModifiers(
  proceduralDepth: number,
  nodeType: ProceduralNodeType,
  depthIndex: 1 | 2 | 3,
  runContext: RunGenerationContext | null | undefined,
  rng: () => number,
  rollState: NodeModifierRollState,
): NodeContextModifiers {
  const depthStage = getDepthStage(depthIndex);
  const pressureBand = getNodePressureBand(proceduralDepth);
  const pressureScale = pressureMultiplier(pressureBand);
  const stageMods = buildDepthGenerationContext(depthIndex, proceduralDepth).depthStageModifiers;
  const anchorStage = getAnchorStage(depthStage);

  let modifiers: NodeContextModifiers = {
    depthStage,
    nodePressureBand: pressureBand,
  };

  if (!runContext) return modifiers;

  const echoActivity = runContext.sectorState.echoActivity;
  const scannerBias = runContext.scannerSignalBias;

  let anchorRoll = stageMods.anchorSignalChance * pressureScale * scannerBias.anchorSignalMultiplier;
  if (runContext.activeAnchor?.isActive) {
    anchorRoll += runContext.activeAnchor.realityRules.anomalyBias * 0.05;
  }
  if (nodeType === 'GATEKEEPER' || nodeType === 'ELITE') {
    anchorRoll *= 1.35;
  }

  const echoBase = ECHO_SIGNAL_CHANCE[echoActivity][depthStage] * pressureScale * scannerBias.echoSignalMultiplier;
  const echoRoll = nodeType === 'ELITE' || nodeType === 'COMBAT' ? echoBase * 1.2 : echoBase;

  if (runContext.activeAnchor?.isActive && rng() < Math.min(0.95, anchorRoll)) {
    modifiers.anchorSignal = true;
    modifiers.anchorStage = anchorStage;
  }

  if (
    rollState.echoSignalsUsed < MAX_ECHO_ENCOUNTERS_PER_RUN
    && (nodeType === 'ELITE' || nodeType === 'COMBAT' || nodeType === 'ANOMALY')
    && rng() < Math.min(0.85, echoRoll)
  ) {
    const allowLegendary =
      rollState.legendaryEchoUsed < MAX_LEGENDARY_ECHO_ENCOUNTERS_PER_RUN;
    modifiers = stampEchoTemplateOnModifiers(
      modifiers,
      depthIndex,
      `${depthStage}:${proceduralDepth}:${nodeType}:${rollState.echoSignalsUsed}`,
      allowLegendary,
    );
    if (modifiers.echoSignal) {
      rollState.echoSignalsUsed += 1;
      if (modifiers.echoTier === 'LEGENDARY') {
        rollState.legendaryEchoUsed += 1;
      }
    }
  }

  modifiers.operationTag = runContext.activeOperation.objectiveKind;

  const hazard = runContext.sectorState.hazardLevel;
  modifiers.highRisk = pressureBand === 'HIGH' && (depthStage === 'DEEP_VEIL' || hazard >= 4);

  if (nodeType === 'RESOURCE' && (pressureBand === 'HIGH' || stageMods.rareLootBias > 0.15)) {
    modifiers.highValueResource = rng() < 0.35 + stageMods.rareLootBias;
  }

  return modifiers;
}

export function applyGatekeeperAnchorCore(
  modifiers: NodeContextModifiers,
  depthIndex: 1 | 2 | 3,
  runContext: RunGenerationContext | null | undefined,
  rng: () => number,
): NodeContextModifiers {
  if (!runContext?.activeAnchor?.isActive) return modifiers;
  if (runContext.activeOperation.objectiveKind !== 'ANCHOR_ASSAULT') return modifiers;

  const depthStage = getDepthStage(depthIndex);
  const coreChance = ANCHOR_ASSAULT_CORE_CHANCE[depthStage];
  if (coreChance <= 0 || rng() > coreChance) return modifiers;

  return {
    ...modifiers,
    anchorSignal: true,
    anchorStage: 'CORE',
    highRisk: true,
    operationTag: 'ANCHOR_ASSAULT' as OperationObjectiveKind,
  };
}

export { BASE_TYPE_WEIGHTS };
