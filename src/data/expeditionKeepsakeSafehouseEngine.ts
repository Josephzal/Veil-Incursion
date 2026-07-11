import type { ActiveIncursionState } from '../types/game';
import type { KeepsakeRuntime } from '../types/expeditionKeepsake';
import type { ProceduralNodeType } from '../types/proceduralRunTree';
import type { UnstableCarriedEffectDefinition } from '../types/unstableCargoEffects';
import { purgeKeepsakeLeyContamination, queueKeepsakePendingChoice, buildGutterServiceChoice } from './expeditionKeepsakeChoiceEngine';
import { dampenSealedUnstableEffects } from './expeditionKeepsakeCargoEngine';
import { formatKeepsakeLogLine, tryKeepsakeTrigger } from './expeditionKeepsakeEngine';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';

export interface KeepsakeSafehouseApplyResult {
  runtime: KeepsakeRuntime | null;
  incursionPatch?: Partial<ActiveIncursionState>;
  logLines: string[];
}

export function applyKeepsakeOnSafehouseEnter(
  runtime: KeepsakeRuntime | null,
  inc: ActiveIncursionState,
): KeepsakeSafehouseApplyResult {
  const purge = purgeKeepsakeLeyContamination(runtime);
  let nextRuntime = purge.runtime;
  const logLines = [...purge.logLines];

  if (!nextRuntime || nextRuntime.keepsakeId !== 'gutter_crown') {
    return { runtime: nextRuntime, logLines };
  }

  const depth = inc.currentDistrict;
  const trigger = tryKeepsakeTrigger(
    nextRuntime,
    `${getKeepsakeDefinition('gutter_crown').primaryTriggerKey}:${depth}`,
    'depth',
    depth,
  );
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime: nextRuntime, logLines };
  }

  if (trigger.runtime.pendingChoice) {
    return { runtime: trigger.runtime, logLines };
  }

  const queued = queueKeepsakePendingChoice(trigger.runtime, buildGutterServiceChoice());
  logLines.push(formatKeepsakeLogLine('Crown', getKeepsakeDefinition('gutter_crown').triggerMessage));

  return { runtime: queued, logLines };
}

export function resolveKeepsakeBankedResourceMultiplier(
  runtime: KeepsakeRuntime | null | undefined,
): number {
  if (runtime?.flags.gutterLaunderActive) {
    return 1.1;
  }
  return 1;
}

export function dampenKeepsakeStabilizePayload(
  effects: readonly UnstableCarriedEffectDefinition[],
  runtime: KeepsakeRuntime | null | undefined,
): { effects: UnstableCarriedEffectDefinition[]; runtime: KeepsakeRuntime | null } {
  return {
    effects: dampenSealedUnstableEffects(effects, runtime),
    runtime: runtime ?? null,
  };
}

export function formatKeepsakeNextDepthPreviewLine(
  previewType: ProceduralNodeType | null | undefined,
): string | null {
  if (!previewType) return null;
  return `>> SAFEHOUSE INTEL — next depth first vector type: ${previewType}.`;
}
