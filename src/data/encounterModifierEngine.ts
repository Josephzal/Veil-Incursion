import type {
  DeepVeilLawId,
  DepthIdentityState,
  EncounterModifierId,
  VeilDistortionId,
} from '../types/depthIdentity';
import type { NodeContextModifiers } from '../types/worldState';
import type { ProceduralNodeType } from '../types/proceduralRunTree';
import {
  ALL_ENCOUNTER_MODIFIER_IDS,
  ENCOUNTER_MODIFIER_BASE_CHANCE,
  ENCOUNTER_MODIFIER_DEFINITIONS,
  getEncounterModifierDefinition,
} from './encounterModifierCatalog';

export interface EncounterModifierRollInput {
  depthIndex: 1 | 2 | 3;
  nodeType: ProceduralNodeType;
  distortion: VeilDistortionId | null;
  law: DeepVeilLawId | null;
  highRisk?: boolean;
  anchorSignal?: boolean;
  operationTagged?: boolean;
  pendingUnstablePressure?: boolean;
  rng: () => number;
  forcedId?: EncounterModifierId | null;
  briefEncounterBias?: Partial<Record<EncounterModifierId, number>>;
}

function isEligible(
  id: EncounterModifierId,
  depthIndex: 1 | 2 | 3,
  nodeType: ProceduralNodeType,
): boolean {
  const def = ENCOUNTER_MODIFIER_DEFINITIONS[id];
  if (!def.allowedDepths.includes(depthIndex)) return false;
  return def.eligibleNodeTypes.includes(nodeType);
}

function weightForModifier(id: EncounterModifierId, input: EncounterModifierRollInput): number {
  const def = ENCOUNTER_MODIFIER_DEFINITIONS[id];
  let weight = 8;
  if (input.distortion && def.favoredDistortions.includes(input.distortion)) {
    weight += 16;
  }
  if (input.law && def.favoredLaws.includes(input.law)) {
    weight += 14;
  }
  if (input.highRisk && (id === 'BLEEDING' || id === 'UNSTABLE' || id === 'CORE_SICK')) {
    weight += 6;
  }
  if (input.anchorSignal && (id === 'RESONANT' || id === 'CORE_SICK')) {
    weight += 10;
  }
  if (input.operationTagged && id === 'RESONANT') {
    weight += 8;
  }
  if (input.pendingUnstablePressure && id === 'UNSTABLE') {
    weight += 4;
  }
  if (depthHardBlock(id, input.depthIndex)) {
    return 0;
  }
  if (input.briefEncounterBias?.[id]) {
    return Math.max(0, weight * input.briefEncounterBias[id]!);
  }
  return Math.max(0, weight);
}

function depthHardBlock(id: EncounterModifierId, depthIndex: 1 | 2 | 3): boolean {
  if (id === 'CORE_SICK' && depthIndex < 3) return true;
  return false;
}

export function resolveEncounterModifierRollChance(input: EncounterModifierRollInput): number {
  let chance = ENCOUNTER_MODIFIER_BASE_CHANCE[input.depthIndex];
  if (input.highRisk) chance += 0.08;
  if (input.anchorSignal || input.operationTagged) chance += 0.05;
  if (input.pendingUnstablePressure) chance += 0.1;
  if (input.distortion) chance += 0.04;
  if (input.law) chance += 0.06;
  if (input.depthIndex === 1) {
    return Math.min(0.06, chance);
  }
  if (input.depthIndex === 2) {
    return Math.min(0.42, chance);
  }
  return Math.min(0.62, chance);
}

export function rollEncounterModifier(
  input: EncounterModifierRollInput,
): EncounterModifierId | null {
  if (input.forcedId && ENCOUNTER_MODIFIER_DEFINITIONS[input.forcedId]) {
    if (isEligible(input.forcedId, input.depthIndex, input.nodeType)) {
      return input.forcedId;
    }
  }

  const candidates = ALL_ENCOUNTER_MODIFIER_IDS.filter((id) => (
    isEligible(id, input.depthIndex, input.nodeType)
    && weightForModifier(id, input) > 0
  ));
  if (candidates.length === 0) return null;

  const chance = resolveEncounterModifierRollChance(input);
  if (input.rng() > chance) return null;

  const weighted = candidates.map((id) => ({ id, weight: weightForModifier(id, input) }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;
  let roll = input.rng() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return weighted[weighted.length - 1]?.id ?? null;
}

export function applyEncounterModifierToContext(
  modifiers: NodeContextModifiers,
  modifierId: EncounterModifierId | null,
): NodeContextModifiers {
  if (!modifierId) return modifiers;
  const def = getEncounterModifierDefinition(modifierId);
  return {
    ...modifiers,
    encounterModifier: modifierId,
    encounterModifierLabel: def.displayName,
    encounterModifierSummary: def.telegraph,
  };
}

export function recordEncounterModifierSeen(
  state: DepthIdentityState,
  modifierId: EncounterModifierId,
): DepthIdentityState {
  if (state.encounterModifiersSeen.includes(modifierId)) return state;
  return {
    ...state,
    encounterModifiersSeen: [...state.encounterModifiersSeen, modifierId],
  };
}

export function recordEncounterModifierCleared(
  state: DepthIdentityState,
  modifierId: EncounterModifierId,
): DepthIdentityState {
  let next = recordEncounterModifierSeen(state, modifierId);
  if (!next.encounterModifiersCleared.includes(modifierId)) {
    next = {
      ...next,
      encounterModifiersCleared: [...next.encounterModifiersCleared, modifierId],
    };
  }
  if (modifierId === 'UNSTABLE') {
    next = { ...next, pendingUnstablePressure: true };
  }
  return next;
}

export function consumePendingUnstablePressure(
  state: DepthIdentityState,
): DepthIdentityState {
  if (!state.pendingUnstablePressure) return state;
  return { ...state, pendingUnstablePressure: false };
}

export function formatEncounterModifierCombatIntro(modifierId: EncounterModifierId): string {
  const def = getEncounterModifierDefinition(modifierId);
  return `>> ENCOUNTER MODIFIER — ${def.displayName.toUpperCase()} // ${def.telegraph.toUpperCase()}`;
}

export function formatEncounterModifierScannerLabel(modifierId: EncounterModifierId): string {
  const def = getEncounterModifierDefinition(modifierId);
  return `MOD // ${def.displayName.toUpperCase()}`;
}

let debugForcedEncounterModifier: EncounterModifierId | null = null;

export function setDebugForcedEncounterModifier(id: EncounterModifierId | null): void {
  debugForcedEncounterModifier = id;
}

export function getDebugForcedEncounterModifier(): EncounterModifierId | null {
  return debugForcedEncounterModifier;
}

export function rollEncounterModifierWithDebug(
  input: Omit<EncounterModifierRollInput, 'forcedId'>,
): EncounterModifierId | null {
  return rollEncounterModifier({
    ...input,
    forcedId: debugForcedEncounterModifier,
  });
}
