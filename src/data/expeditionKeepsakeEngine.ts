import type { KeepsakeDeployment, KeepsakeId, KeepsakeRuntime } from '../types/expeditionKeepsake';
import type { RunGenerationContext } from '../types/worldState';
import {
  canUseKeepsakeTrigger,
  createKeepsakeRuntime,
  recordKeepsakeTrigger,
} from './keepsakeRunState';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';
import { recordKeepsakeDeploymentDecisions } from './expeditionKeepsakeDeploymentEngine';

export interface KeepsakeTriggerResult {
  runtime: KeepsakeRuntime | null;
  triggered: boolean;
  logLine: string | null;
}

export function initializeKeepsakeRuntime(
  keepsakeId: KeepsakeId | null | undefined,
  deployment?: Partial<KeepsakeDeployment> | null,
): KeepsakeRuntime | null {
  if (!keepsakeId) return null;
  return createKeepsakeRuntime(keepsakeId, deployment);
}

export function formatKeepsakeLogLine(shortName: string, message: string): string {
  return `>> ${shortName.toUpperCase()} // ${message}`;
}

export function applyKeepsakeOnRunStart(
  runtime: KeepsakeRuntime | null,
  runContext?: RunGenerationContext | null,
): {
  runtime: KeepsakeRuntime | null;
  logLines: string[];
} {
  if (!runtime) return { runtime: null, logLines: [] };
  const def = getKeepsakeDefinition(runtime.keepsakeId);
  let nextRuntime = recordKeepsakeDeploymentDecisions(runtime);
  const logLines: string[] = [
    formatKeepsakeLogLine(def.shortName, `Expedition relic armed — ${def.name}.`),
  ];

  const deploymentLabel = nextRuntime.decisions.find((decision) => (
    decision.key === 'attunement'
    || decision.key === 'route_doctrine'
    || decision.key === 'mirror_category'
  ));
  if (deploymentLabel) {
    logLines.push(formatKeepsakeLogLine(def.shortName, `${deploymentLabel.label}: ${deploymentLabel.value}.`));
  }

  if (!def.hooks.includes('onRunStart')) {
    return { runtime: nextRuntime, logLines };
  }

  const triggerKey = `${runtime.keepsakeId}_run_start`;
  if (!canUseKeepsakeTrigger(nextRuntime, triggerKey, 'run')) {
    return { runtime: nextRuntime, logLines };
  }

  nextRuntime = recordKeepsakeTrigger(nextRuntime, triggerKey, def.triggerMessage);
  logLines.push(formatKeepsakeLogLine(def.shortName, def.triggerMessage));
  return { runtime: nextRuntime, logLines };
}

export function tryKeepsakeTrigger(
  runtime: KeepsakeRuntime | null,
  triggerKey: string,
  guard: 'run' | 'depth' | 'none',
  depth?: number,
): KeepsakeTriggerResult {
  if (!runtime) {
    return { runtime: null, triggered: false, logLine: null };
  }
  if (!canUseKeepsakeTrigger(runtime, triggerKey, guard, depth)) {
    return { runtime, triggered: false, logLine: null };
  }
  const def = getKeepsakeDefinition(runtime.keepsakeId);
  const next = recordKeepsakeTrigger(runtime, triggerKey, def.triggerMessage, depth);
  return {
    runtime: next,
    triggered: true,
    logLine: formatKeepsakeLogLine(def.shortName, def.triggerMessage),
  };
}

export function getEquippedKeepsakeShortLabel(runtime: KeepsakeRuntime | null | undefined): string | null {
  if (!runtime) return null;
  return getKeepsakeDefinition(runtime.keepsakeId).shortName.toUpperCase();
}
