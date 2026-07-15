import type {
  NodeContextModifiers,
  NodeModifierRollState,
  NodePressureBand,
  OperationObjectiveKind,
  RunGenerationContext,
  VeilAnchorType,
} from '../types/worldState';
import type { ProceduralNodeType } from '../types/proceduralRunTree';
import {
  ANCHOR_ASSAULT_CORE_CHANCE,
  DEPTH_STAGE_MODIFIERS,
  OPERATION_TARGET_CHANCE,
  buildDepthGenerationContext,
  getAnchorStage,
  getDepthStage,
  getNodePressureBand,
} from './worldStateHelpers';
import { getAnchorDefinition } from './anchorRegistry';
import { MODIFIER_SCANNER_MULTIPLIERS } from './anchorTypeMetadata';
import { applyBriefOverlayToRoll } from './runWorldBriefBiasEngine';
import { getRunWorldBriefFromContext } from './runWorldBriefEngine';
import {
  applyEncounterModifierToContext,
  rollEncounterModifierWithDebug,
} from './encounterModifierEngine';
import {
  applyTwistedTemplateToContext,
  rollTwistedTemplateWithDebug,
} from './twistedTemplateEngine';
import type { DepthIdentityState } from '../types/depthIdentity';
import { normalizeDepthIdentityState } from './depthIdentityEngine';

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

export function createNodeModifierRollState(): NodeModifierRollState {
  return { echoSignalsUsed: 0, legendaryEchoUsed: 0, echoSignalsByDepth: {} };
}

const OPERATION_TARGET_NODE_TYPES: readonly ProceduralNodeType[] = [
  'COMBAT',
  'ELITE',
  'ANOMALY',
  'RESOURCE',
  'GATEKEEPER',
];

function isOperationTargetEligible(nodeType: ProceduralNodeType): boolean {
  return OPERATION_TARGET_NODE_TYPES.includes(nodeType);
}

function resolveNodeTypeSignalBoost(
  anchorType: VeilAnchorType | null,
  nodeType: ProceduralNodeType,
  activeOperationKind?: OperationObjectiveKind,
): { anchorSignal: number; operationTarget: number; highValueResource: number } {
  let anchorSignal = 1;
  let operationTarget = 1;
  let highValueResource = 1;
  if (!anchorType) return { anchorSignal, operationTarget, highValueResource };

  switch (anchorType) {
    case 'NULL_MONOLITH':
      if (nodeType === 'ANOMALY') operationTarget *= 1.4;
      break;
    case 'RIFT_ENGINE':
      if (nodeType === 'COMBAT' || nodeType === 'ELITE') {
        anchorSignal *= 1.2;
        operationTarget *= 1.25;
      }
      break;
    case 'ASHEN_HEART':
      if (nodeType === 'ELITE' || nodeType === 'GATEKEEPER') operationTarget *= 1.3;
      break;
    case 'LEY_NEXUS':
      if (nodeType === 'RESOURCE') highValueResource *= 1.5;
      break;
    default:
      break;
  }

  if (activeOperationKind === 'BOSS_SUPPRESSION' && (nodeType === 'ELITE' || nodeType === 'COMBAT')) {
    operationTarget *= 1.25;
  }

  return { anchorSignal, operationTarget, highValueResource };
}

export function resolveAnchorSignalRollChance(
  depthStage: ReturnType<typeof getDepthStage>,
  pressureScale: number,
  nodeType: ProceduralNodeType,
  runContext: RunGenerationContext,
): number {
  const stageMods = DEPTH_STAGE_MODIFIERS[depthStage];
  const scannerBias = runContext.scannerSignalBias;
  const anchorType = runContext.activeAnchor?.type ?? null;
  const anchorDef = anchorType ? getAnchorDefinition(anchorType) : null;
  const nodeBoost = resolveNodeTypeSignalBoost(anchorType, nodeType, runContext.activeOperation.objectiveKind);

  let chance = stageMods.anchorSignalChance * pressureScale * scannerBias.anchorSignalMultiplier;
  if (runContext.activeAnchor?.isActive) {
    chance += runContext.activeAnchor.realityRules.anomalyBias * 0.05;
  }
  if (nodeType === 'GATEKEEPER' || nodeType === 'ELITE') {
    chance *= 1.35;
  }
  if (anchorDef) {
    chance *= anchorDef.signalRollModifiers.anchorSignalChance * nodeBoost.anchorSignal;
  }

  return Math.min(0.95, chance);
}

export function resolveOperationTargetRollChance(
  depthStage: ReturnType<typeof getDepthStage>,
  pressureScale: number,
  nodeType: ProceduralNodeType,
  runContext: RunGenerationContext,
): number {
  if (!isOperationTargetEligible(nodeType)) return 0;

  const anchorType = runContext.activeAnchor?.type ?? null;
  const anchorDef = anchorType ? getAnchorDefinition(anchorType) : null;
  const nodeBoost = resolveNodeTypeSignalBoost(
    anchorType,
    nodeType,
    runContext.activeOperation.objectiveKind,
  );

  let chance = OPERATION_TARGET_CHANCE[depthStage]
    * pressureScale
    * runContext.scannerSignalBias.operationSignalMultiplier
    * nodeBoost.operationTarget;

  if (anchorDef) {
    chance *= anchorDef.signalRollModifiers.operationTargetChance;
  }

  return Math.min(0.9, chance);
}

export function rollNodeContextModifiers(
  proceduralDepth: number,
  nodeType: ProceduralNodeType,
  depthIndex: 1 | 2 | 3,
  runContext: RunGenerationContext | null | undefined,
  rng: () => number,
  rollState: NodeModifierRollState,
  cargoBias?: import('../types/unstableCargoEffects').CarriedCargoContextRollBias,
  depthIdentityBias?: import('../types/depthIdentity').DepthIdentityScanBias | null,
  depthIdentity?: DepthIdentityState | null,
): NodeContextModifiers {
  const depthStage = getDepthStage(depthIndex);
  const pressureBand = getNodePressureBand(proceduralDepth);
  const pressureScale = pressureMultiplier(pressureBand);
  const stageMods = buildDepthGenerationContext(depthIndex, proceduralDepth).depthStageModifiers;
  const anchorStage = getAnchorStage(depthStage);
  const identity = normalizeDepthIdentityState(depthIdentity);

  let modifiers: NodeContextModifiers = {
    depthStage,
    nodePressureBand: pressureBand,
  };

  if (!runContext) return modifiers;

  const anchorType = runContext.activeAnchor?.type ?? null;
  const anchorDef = anchorType ? getAnchorDefinition(anchorType) : null;
  const nodeBoost = resolveNodeTypeSignalBoost(
    anchorType,
    nodeType,
    runContext.activeOperation.objectiveKind,
  );

  let anchorRoll = resolveAnchorSignalRollChance(depthStage, pressureScale, nodeType, runContext);
  if (cargoBias) {
    anchorRoll = Math.min(0.95, anchorRoll * cargoBias.anchorSignalChanceMultiplier);
  }
  if (depthIdentityBias) {
    anchorRoll = Math.min(0.95, anchorRoll * depthIdentityBias.anchorSignalMultiplier);
  }
  const anchorModifier = runContext.activeAnchor?.modifier;
  if (anchorModifier) {
    const modMult = MODIFIER_SCANNER_MULTIPLIERS[anchorModifier];
    if (modMult.anchorSignalMultiplier) {
      anchorRoll = Math.min(0.95, anchorRoll * modMult.anchorSignalMultiplier);
    }
  }
  const brief = getRunWorldBriefFromContext(runContext);
  if (brief) {
    anchorRoll = applyBriefOverlayToRoll(anchorRoll, 'anchorSignal', brief.scannerBias);
  }

  if (runContext.activeAnchor?.isActive && rng() < anchorRoll) {
    modifiers.anchorSignal = true;
    modifiers.anchorStage = anchorStage;
  }

  let operationTargetRoll = resolveOperationTargetRollChance(
    depthStage,
    pressureScale,
    nodeType,
    runContext,
  );
  if (depthIdentityBias) {
    operationTargetRoll = Math.min(0.95, operationTargetRoll * depthIdentityBias.operationSignalMultiplier);
  }
  if (brief) {
    operationTargetRoll = applyBriefOverlayToRoll(operationTargetRoll, 'operationTarget', brief.scannerBias);
  }
  if (rng() < operationTargetRoll) {
    modifiers.operationTag = runContext.activeOperation.objectiveKind;
  }

  const hazard = runContext.sectorState.hazardLevel;
  modifiers.highRisk = pressureBand === 'HIGH' && (depthStage === 'DEEP_VEIL' || hazard >= 4);
  if (anchorDef && anchorType === 'ASHEN_HEART' && (nodeType === 'ELITE' || nodeType === 'GATEKEEPER')) {
    modifiers.highRisk = modifiers.highRisk || rng() < 0.25 * pressureScale;
  }
  if (cargoBias && cargoBias.highRiskRollBonus > 0) {
    const anomalyPressureRoll = cargoBias.highRiskRollBonus
      + (nodeType === 'ANOMALY' ? cargoBias.highRiskRollBonus * 0.5 : 0);
    modifiers.highRisk = modifiers.highRisk || rng() < Math.min(0.45, anomalyPressureRoll);
  }
  if (depthIdentityBias && depthIdentityBias.highRiskMultiplier > 1) {
    const identityRisk = (depthIdentityBias.highRiskMultiplier - 1) * 0.35 * pressureScale;
    modifiers.highRisk = modifiers.highRisk || rng() < Math.min(0.4, identityRisk);
  }
  if (identity.pendingUnstablePressure) {
    modifiers.highRisk = modifiers.highRisk || rng() < 0.55;
  }
  if (brief) {
    const highRiskRoll = modifiers.highRisk ? 0.85 : 0.22;
    modifiers.highRisk = modifiers.highRisk || rng() < applyBriefOverlayToRoll(highRiskRoll, 'highRisk', brief.scannerBias);
  }

  if (nodeType === 'RESOURCE' && (pressureBand === 'HIGH' || stageMods.rareLootBias > 0.15)) {
    const highValueBase = 0.35 + stageMods.rareLootBias;
    let highValueChance = highValueBase
      * (anchorDef?.signalRollModifiers.highValueResourceChance ?? 1)
      * nodeBoost.highValueResource;
    if (cargoBias) {
      highValueChance *= cargoBias.highValueResourceChanceMultiplier;
      if (cargoBias.occultRewardChanceBonus > 0) {
        highValueChance *= 1 + cargoBias.occultRewardChanceBonus;
      }
    }
    if (depthIdentityBias) {
      highValueChance *= depthIdentityBias.highValueMultiplier;
    }
    if (anchorModifier) {
      const modMult = MODIFIER_SCANNER_MULTIPLIERS[anchorModifier];
      if (modMult.highValueResourceMultiplier) {
        highValueChance = Math.min(0.85, highValueChance * modMult.highValueResourceMultiplier);
      }
    }
    if (brief) {
      highValueChance = applyBriefOverlayToRoll(highValueChance, 'highValueResource', brief.scannerBias);
    }
    modifiers.highValueResource = rng() < Math.min(0.85, highValueChance);
  } else if (
    cargoBias
    && cargoBias.occultRewardChanceBonus > 0
    && (nodeType === 'ANOMALY' || nodeType === 'RESOURCE')
  ) {
    const occultResourceRoll = 0.12 + cargoBias.occultRewardChanceBonus * 0.35;
    modifiers.highValueResource = rng() < Math.min(0.5, occultResourceRoll);
  }

  const rolledModifier = rollEncounterModifierWithDebug({
    depthIndex,
    nodeType,
    distortion: identity.activeVeilDistortion,
    law: identity.activeDeepVeilLaw,
    highRisk: Boolean(modifiers.highRisk),
    anchorSignal: Boolean(modifiers.anchorSignal),
    operationTagged: Boolean(modifiers.operationTag),
    pendingUnstablePressure: identity.pendingUnstablePressure,
    rng,
    briefEncounterBias: brief?.encounterBias.favoredModifiers,
  });
  modifiers = applyEncounterModifierToContext(modifiers, rolledModifier);

  const rolledTwisted = rollTwistedTemplateWithDebug({
    depthIndex,
    nodeType,
    distortion: identity.activeVeilDistortion,
    law: identity.activeDeepVeilLaw,
    highRisk: Boolean(modifiers.highRisk),
    anchorSignal: Boolean(modifiers.anchorSignal),
    operationTagged: Boolean(modifiers.operationTag),
    alreadySeen: identity.twistedTemplatesSeen,
    rng,
    briefTwistedBias: (() => {
      const bias = { ...brief?.encounterBias.twistedTemplateWeights };
      if (nodeType === 'EXTRACTION' && brief?.scannerBias.overlayBias.extraction) {
        const mult = brief.scannerBias.overlayBias.extraction;
        if (mult > 1) {
          bias.FALSE_EXTRACTION_SIGNAL = (bias.FALSE_EXTRACTION_SIGNAL ?? 1) * mult;
        }
      }
      return bias;
    })(),
  });
  return applyTwistedTemplateToContext(modifiers, rolledTwisted);
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
export type { NodeModifierRollState } from '../types/worldState';
