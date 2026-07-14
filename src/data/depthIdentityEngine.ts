import type { DepthIdentityState } from '../types/depthIdentity';
import { createDefaultDepthIdentityState } from '../types/depthIdentity';
import type { RunGenerationContext } from '../types/worldState';
import type { VeilBiome } from '../types/encounterSpawn';
import {
  applyVeilDistortionToState,
  formatVeilDistortionLogLine,
  rollVeilDistortionForRun,
} from './veilDistortionEngine';
import {
  applyDeepVeilLawToState,
  formatDeepVeilLawLogLine,
  rollDeepVeilLawForRun,
} from './deepVeilLawEngine';
import { getDepthIdentityScanBias, getDeepVeilLawDefinition, getVeilDistortionDefinition } from './depthIdentityCatalog';

export function normalizeDepthIdentityState(
  state: DepthIdentityState | null | undefined,
): DepthIdentityState {
  const defaults = createDefaultDepthIdentityState();
  if (!state) return defaults;
  return {
    ...defaults,
    ...state,
    encounterModifiersSeen: state.encounterModifiersSeen ?? [],
    encounterModifiersCleared: state.encounterModifiersCleared ?? [],
    pendingUnstablePressure: state.pendingUnstablePressure ?? false,
    twistedTemplatesSeen: state.twistedTemplatesSeen ?? [],
    twistedTemplatesCleared: state.twistedTemplatesCleared ?? [],
    twistedOutcomes: state.twistedOutcomes ?? [],
    depth2VariantsDefeated: state.depth2VariantsDefeated ?? [],
    depth3ExclusivesDefeated: state.depth3ExclusivesDefeated ?? [],
    depthIdentityOpProgressGained: state.depthIdentityOpProgressGained ?? 0,
    pendingTwistedChoice: state.pendingTwistedChoice ?? null,
    falseExtractBonusCreditsPending: state.falseExtractBonusCreditsPending ?? 0,
  };
}

export interface DepthIdentityActivationResult {
  depthIdentity: DepthIdentityState;
  logLines: string[];
}

/** Activate Depth 2 Breach Distortion when the player unseals into district 2. */
export function activateDepth2Identity(
  prev: DepthIdentityState | null | undefined,
  runContext: RunGenerationContext | null | undefined,
  veilBiome: VeilBiome | null | undefined,
  seed: string,
): DepthIdentityActivationResult {
  const normalized = normalizeDepthIdentityState(prev);
  if (normalized.activeVeilDistortion) {
    return {
      depthIdentity: normalized,
      logLines: [],
    };
  }
  const distortionId = rollVeilDistortionForRun(runContext, veilBiome, seed);
  const depthIdentity = applyVeilDistortionToState(normalized, distortionId);
  return {
    depthIdentity,
    logLines: [formatVeilDistortionLogLine(distortionId)],
  };
}

/** Activate Depth 3 Deep Veil Law when the player unseals into district 3. */
export function activateDepth3Identity(
  prev: DepthIdentityState | null | undefined,
  runContext: RunGenerationContext | null | undefined,
  veilBiome: VeilBiome | null | undefined,
  seed: string,
): DepthIdentityActivationResult {
  const normalized = normalizeDepthIdentityState(prev);
  if (normalized.activeDeepVeilLaw) {
    return {
      depthIdentity: normalized,
      logLines: [],
    };
  }
  const rolled = rollDeepVeilLawForRun(
    runContext,
    veilBiome,
    normalized.activeVeilDistortion,
    seed,
  );
  const depthIdentity = applyDeepVeilLawToState(normalized, rolled.lawId, rolled.intensified);
  return {
    depthIdentity,
    logLines: [formatDeepVeilLawLogLine(rolled.lawId, rolled.intensified)],
  };
}

export function clearDepthIdentityPendingReveal(
  state: DepthIdentityState | null | undefined,
): DepthIdentityState {
  const base = state ?? createDefaultDepthIdentityState();
  if (!base.pendingReveal) return base;
  return { ...base, pendingReveal: null };
}

export function describeActiveDepthIdentity(
  state: DepthIdentityState | null | undefined,
): string[] {
  const lines: string[] = [];
  if (!state) return lines;
  if (state.activeVeilDistortion) {
    const def = getVeilDistortionDefinition(state.activeVeilDistortion);
    lines.push(`Breach Distortion: ${def.displayName}`);
    lines.push(def.effectSummary);
  }
  if (state.activeDeepVeilLaw) {
    const def = getDeepVeilLawDefinition(state.activeDeepVeilLaw);
    const prefix = state.intensifiedFromDistortion ? 'Deep Veil Law (intensified): ' : 'Deep Veil Law: ';
    lines.push(`${prefix}${def.displayName}`);
    lines.push(def.effectSummary);
  }
  if (state.encounterModifiersSeen.length > 0) {
    lines.push(`Encounter modifiers seen: ${state.encounterModifiersSeen.join(', ')}`);
  }
  if (state.encounterModifiersCleared.length > 0) {
    lines.push(`Encounter modifiers cleared: ${state.encounterModifiersCleared.join(', ')}`);
  }
  if (state.twistedTemplatesSeen.length > 0) {
    lines.push(`Twisted templates seen: ${state.twistedTemplatesSeen.join(', ')}`);
  }
  if (state.twistedTemplatesCleared.length > 0) {
    lines.push(`Twisted templates cleared: ${state.twistedTemplatesCleared.join(', ')}`);
  }
  if (state.pendingUnstablePressure) {
    lines.push('Pending UNSTABLE high-risk pressure on next engagement.');
  }
  if (state.pendingTwistedChoice) {
    lines.push(`Pending twisted choice: ${state.pendingTwistedChoice.templateId}`);
  }
  return lines;
}

export function resolveActiveDepthIdentityScanBias(
  state: DepthIdentityState | null | undefined,
  district: 1 | 2 | 3,
) {
  if (!state) {
    return getDepthIdentityScanBias(null, null);
  }
  if (district >= 3) {
    return getDepthIdentityScanBias(state.activeVeilDistortion, state.activeDeepVeilLaw);
  }
  if (district >= 2) {
    return getDepthIdentityScanBias(state.activeVeilDistortion, null);
  }
  return getDepthIdentityScanBias(null, null);
}

export { createDefaultDepthIdentityState };
