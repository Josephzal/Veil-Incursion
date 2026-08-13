import type { RequisitionRuntime as KeepsakeRuntime } from '../types/expeditionRequisition';
import type {
  RequisitionDeployment,
  RequisitionId,
} from '../types/expeditionRequisition';
import type { RunGenerationContext } from '../types/worldState';
import {
  canUseKeepsakeTrigger,
  createKeepsakeRuntime,
  recordKeepsakeTrigger,
} from './keepsakeRunState';
import { EXPEDITION_REQUISITION_REGISTRY } from './expeditionRequisitionRegistry';
import { appendKeepsakeDecision } from './keepsakeRunState';

export interface KeepsakeTriggerResult {
  runtime: KeepsakeRuntime | null;
  triggered: boolean;
  logLine: string | null;
}

export function initializeKeepsakeRuntime(
  requisitionId: RequisitionId | null | undefined,
  deployment?: Partial<RequisitionDeployment> | null,
): KeepsakeRuntime | null {
  if (!requisitionId) return null;
  return createKeepsakeRuntime(requisitionId, deployment);
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
  const def = EXPEDITION_REQUISITION_REGISTRY[runtime.requisitionId];
  let nextRuntime = runtime;
  if (runtime.deployment.attunement) {
    nextRuntime = appendKeepsakeDecision(nextRuntime, {
      key: 'attunement',
      label: 'Attunement',
      value: runtime.deployment.attunement,
    });
  }
  if (runtime.deployment.routeDoctrine) {
    nextRuntime = appendKeepsakeDecision(nextRuntime, {
      key: 'route_doctrine',
      label: 'Route Doctrine',
      value: runtime.deployment.routeDoctrine,
    });
  }
  const logLines: string[] = [
    formatKeepsakeLogLine(def.shortName, `Expedition Requisition armed — ${def.name}.`),
  ];

  const deploymentLabel = nextRuntime.decisions.find((decision) => (
    decision.key === 'attunement'
    || decision.key === 'route_doctrine'
  ));
  if (deploymentLabel) {
    logLines.push(formatKeepsakeLogLine(def.shortName, `${deploymentLabel.label}: ${deploymentLabel.value}.`));
  }

  if (!def.hooks.includes('onRunStart')) {
    return { runtime: nextRuntime, logLines };
  }

  if (runtime.requisitionId === 'hazard_pay') {
    return { runtime: nextRuntime, logLines };
  }
  const triggerKey = `${runtime.requisitionId}_run_start`;
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
  const def = EXPEDITION_REQUISITION_REGISTRY[runtime.requisitionId];
  const next = recordKeepsakeTrigger(runtime, triggerKey, def.triggerMessage, depth);
  return {
    runtime: next,
    triggered: true,
    logLine: formatKeepsakeLogLine(def.shortName, def.triggerMessage),
  };
}

export function getEquippedKeepsakeShortLabel(runtime: KeepsakeRuntime | null | undefined): string | null {
  if (!runtime) return null;
  return EXPEDITION_REQUISITION_REGISTRY[runtime.requisitionId].shortName.toUpperCase();
}
