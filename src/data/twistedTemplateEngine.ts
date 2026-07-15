import type {
  DeepVeilLawId,
  DepthIdentityState,
  TwistedPendingChoice,
  TwistedTemplateId,
  VeilDistortionId,
} from '../types/depthIdentity';
import type { NodeContextModifiers } from '../types/worldState';
import type { ProceduralNodeType } from '../types/proceduralRunTree';
import {
  ALL_TWISTED_TEMPLATE_IDS,
  TWISTED_TEMPLATE_BASE_CHANCE,
  TWISTED_TEMPLATE_DEFINITIONS,
  getTwistedTemplateDefinition,
} from './twistedTemplateCatalog';
import { applyEncounterModifierToContext } from './encounterModifierEngine';

export interface TwistedTemplateRollInput {
  depthIndex: 1 | 2 | 3;
  nodeType: ProceduralNodeType;
  distortion: VeilDistortionId | null;
  law: DeepVeilLawId | null;
  highRisk?: boolean;
  anchorSignal?: boolean;
  operationTagged?: boolean;
  alreadySeen: readonly TwistedTemplateId[];
  rng: () => number;
  forcedId?: TwistedTemplateId | null;
  briefTwistedBias?: Partial<Record<TwistedTemplateId, number>>;
}

function isEligible(
  id: TwistedTemplateId,
  depthIndex: 1 | 2 | 3,
  nodeType: ProceduralNodeType,
  alreadySeen: readonly TwistedTemplateId[],
): boolean {
  const def = TWISTED_TEMPLATE_DEFINITIONS[id];
  if (!def.allowedDepths.includes(depthIndex)) return false;
  if (!def.eligibleNodeTypes.includes(nodeType)) return false;
  const used = alreadySeen.filter((seen) => seen === id).length;
  if (used >= def.maxPerRun) return false;
  return true;
}

function weightForTemplate(id: TwistedTemplateId, input: TwistedTemplateRollInput): number {
  const def = TWISTED_TEMPLATE_DEFINITIONS[id];
  let weight = 10;
  if (input.distortion && def.favoredDistortions.includes(input.distortion)) {
    weight += 18;
  }
  if (input.law && def.favoredLaws.includes(input.law)) {
    weight += 12;
  }
  if (input.highRisk && (id === 'RESOURCE_BLOOM' || id === 'FALSE_EXTRACTION_SIGNAL' || id === 'APEX_SHADOW' || id === 'VEIL_PROPER_CACHE')) {
    weight += 6;
  }
  if (input.anchorSignal && (id === 'ANCHOR_VEIN' || id === 'ANCHOR_CORE_BREACH')) {
    weight += 14;
  }
  if (input.operationTagged && (id === 'ANCHOR_VEIN' || id === 'RESOURCE_BLOOM' || id === 'ANCHOR_CORE_BREACH')) {
    weight += 8;
  }
  if (input.briefTwistedBias?.[id]) {
    weight = Math.max(0, weight * input.briefTwistedBias[id]!);
  }
  return Math.max(0, weight);
}

export function resolveTwistedTemplateRollChance(input: TwistedTemplateRollInput): number {
  let chance = TWISTED_TEMPLATE_BASE_CHANCE[input.depthIndex];
  if (input.depthIndex !== 2 && input.depthIndex !== 3) return 0;
  if (input.highRisk) chance += 0.05;
  if (input.anchorSignal) chance += 0.04;
  if (input.distortion) chance += 0.06;
  if (input.depthIndex === 2) return Math.min(0.38, chance);
  return Math.min(0.42, chance);
}

export function rollTwistedTemplate(
  input: TwistedTemplateRollInput,
): TwistedTemplateId | null {
  if (input.forcedId && TWISTED_TEMPLATE_DEFINITIONS[input.forcedId]) {
    if (isEligible(input.forcedId, input.depthIndex, input.nodeType, input.alreadySeen)) {
      return input.forcedId;
    }
  }

  const candidates = ALL_TWISTED_TEMPLATE_IDS.filter((id) => (
    isEligible(id, input.depthIndex, input.nodeType, input.alreadySeen)
    && weightForTemplate(id, input) > 0
  ));
  if (candidates.length === 0) return null;

  const chance = resolveTwistedTemplateRollChance(input);
  if (chance <= 0 || input.rng() > chance) return null;

  const weighted = candidates.map((id) => ({ id, weight: weightForTemplate(id, input) }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;
  let roll = input.rng() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return weighted[weighted.length - 1]?.id ?? null;
}

export function applyTwistedTemplateToContext(
  modifiers: NodeContextModifiers,
  templateId: TwistedTemplateId | null,
): NodeContextModifiers {
  if (!templateId) return modifiers;
  const def = getTwistedTemplateDefinition(templateId);
  let next: NodeContextModifiers = {
    ...modifiers,
    twistedTemplate: templateId,
    twistedTemplateLabel: def.displayName,
    twistedTemplateSummary: def.telegraph,
  };
  if (templateId === 'MIRROR_COMBAT') {
    next = applyEncounterModifierToContext(next, 'MIRRORED');
  }
  if (templateId === 'APEX_SHADOW') {
    next = applyEncounterModifierToContext({ ...next, highRisk: true }, 'CORE_SICK');
  }
  if (templateId === 'ANCHOR_CORE_BREACH') {
    next = { ...next, highRisk: true, anchorSignal: true, anchorStage: next.anchorStage ?? 'CORE' };
  }
  return next;
}

export function recordTwistedTemplateSeen(
  state: DepthIdentityState,
  templateId: TwistedTemplateId,
): DepthIdentityState {
  if (state.twistedTemplatesSeen.includes(templateId)) return state;
  return {
    ...state,
    twistedTemplatesSeen: [...state.twistedTemplatesSeen, templateId],
  };
}

export function recordTwistedTemplateCleared(
  state: DepthIdentityState,
  templateId: TwistedTemplateId,
): DepthIdentityState {
  let next = recordTwistedTemplateSeen(state, templateId);
  if (!next.twistedTemplatesCleared.includes(templateId)) {
    next = {
      ...next,
      twistedTemplatesCleared: [...next.twistedTemplatesCleared, templateId],
    };
  }
  return { ...next, pendingTwistedChoice: null };
}

export function buildTwistedPendingChoice(
  templateId: TwistedTemplateId,
  nodeId: string,
): TwistedPendingChoice | null {
  const def = getTwistedTemplateDefinition(templateId);
  if (!def.requiresChoice) return null;
  return {
    templateId,
    nodeId,
    title: def.displayName,
    prompt: def.prompt,
    warnings: def.warnings,
    options: def.options,
  };
}

export function queueTwistedPendingChoice(
  state: DepthIdentityState,
  templateId: TwistedTemplateId,
  nodeId: string,
): DepthIdentityState {
  const choice = buildTwistedPendingChoice(templateId, nodeId);
  if (!choice) {
    return recordTwistedTemplateSeen(state, templateId);
  }
  return {
    ...recordTwistedTemplateSeen(state, templateId),
    pendingTwistedChoice: choice,
  };
}

export function clearTwistedPendingChoice(state: DepthIdentityState): DepthIdentityState {
  if (!state.pendingTwistedChoice) return state;
  return { ...state, pendingTwistedChoice: null };
}

export function formatTwistedTemplateScannerLabel(templateId: TwistedTemplateId): string {
  const def = getTwistedTemplateDefinition(templateId);
  return `TWIST // ${def.displayName.toUpperCase()}`;
}

export function formatTwistedTemplateEngageLog(templateId: TwistedTemplateId): string {
  const def = getTwistedTemplateDefinition(templateId);
  return `>> TWISTED TEMPLATE — ${def.displayName.toUpperCase()} // ${def.telegraph.toUpperCase()}`;
}

let debugForcedTwistedTemplate: TwistedTemplateId | null = null;

export function maybeQueueFalseExtractionAtSafeAnchor(
  state: DepthIdentityState,
  district: 1 | 2 | 3,
  nodeId: string,
  distortion: VeilDistortionId | null,
  rng: () => number,
): DepthIdentityState {
  const normalized = state;
  if (normalized.pendingTwistedChoice) return normalized;

  if (district === 3) {
    if (normalized.twistedTemplatesSeen.includes('FINAL_ROUTE_FRACTURE')) return normalized;
    const forced = getDebugForcedTwistedTemplate();
    if (forced && forced !== 'FINAL_ROUTE_FRACTURE') return normalized;
    let chance = 0.28;
    if (normalized.activeDeepVeilLaw === 'THE_ROADS_ARE_LOOPING') chance = 0.45;
    if (forced === 'FINAL_ROUTE_FRACTURE' || rng() < chance) {
      return queueTwistedPendingChoice(normalized, 'FINAL_ROUTE_FRACTURE', nodeId);
    }
    return normalized;
  }

  if (district !== 2) return normalized;
  if (normalized.twistedTemplatesSeen.includes('FALSE_EXTRACTION_SIGNAL')) return normalized;

  const forced = getDebugForcedTwistedTemplate();
  if (forced && forced !== 'FALSE_EXTRACTION_SIGNAL') return normalized;

  let chance = 0.22;
  if (distortion === 'PREDATORY_GEOMETRY') chance = 0.4;
  if (forced === 'FALSE_EXTRACTION_SIGNAL' || rng() < chance) {
    return queueTwistedPendingChoice(normalized, 'FALSE_EXTRACTION_SIGNAL', nodeId);
  }
  return normalized;
}

export function setDebugForcedTwistedTemplate(id: TwistedTemplateId | null): void {
  debugForcedTwistedTemplate = id;
}

export function getDebugForcedTwistedTemplate(): TwistedTemplateId | null {
  return debugForcedTwistedTemplate;
}

export function rollTwistedTemplateWithDebug(
  input: Omit<TwistedTemplateRollInput, 'forcedId'>,
): TwistedTemplateId | null {
  return rollTwistedTemplate({
    ...input,
    forcedId: debugForcedTwistedTemplate,
  });
}
