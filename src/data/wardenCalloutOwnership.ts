/**
 * Development callout ownership reporting for Warden response truthfulness.
 */

export type WardenCalloutReport = {
  calloutType: 'DAMAGE' | 'DEFENSE' | 'CRITICAL' | 'EVADE' | 'CLEAR';
  presentationInstanceId: string | null;
  playerActionId: string | null;
  resolvedResultId: string | null;
  sourceActionKind: string | null;
  sourceAbilityId: string | null;
  targetId: string;
  critical: boolean;
  portalHost: string;
  targetAnchor: { x: number; y: number } | null;
  mountedAtMs: number;
  unmountedAtMs: number | null;
};

const listeners = new Set<(report: WardenCalloutReport) => void>();
const activeByKey = new Map<string, WardenCalloutReport>();

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function subscribeWardenCalloutReports(
  listener: (report: WardenCalloutReport) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportWardenCallout(partial: Omit<WardenCalloutReport, 'mountedAtMs' | 'unmountedAtMs'> & {
  mountedAtMs?: number;
  unmountedAtMs?: number | null;
}): void {
  const report: WardenCalloutReport = {
    ...partial,
    mountedAtMs: partial.mountedAtMs ?? Date.now(),
    unmountedAtMs: partial.unmountedAtMs ?? null,
  };
  const key = `${report.calloutType}:${report.targetId}:${report.presentationInstanceId ?? 'none'}`;
  if (report.calloutType === 'CLEAR') {
    activeByKey.clear();
  } else {
    activeByKey.set(key, report);
  }
  if (isDev()) {
    // eslint-disable-next-line no-console
    console.info('[WARDEN CALLOUT]', report);
  }
  listeners.forEach((fn) => {
    try {
      fn(report);
    } catch {
      // ignore
    }
  });
}

export function clearWardenCalloutReports(): void {
  reportWardenCallout({
    calloutType: 'CLEAR',
    presentationInstanceId: null,
    playerActionId: null,
    resolvedResultId: null,
    sourceActionKind: null,
    sourceAbilityId: null,
    targetId: '',
    critical: false,
    portalHost: 'clear',
    targetAnchor: null,
    unmountedAtMs: Date.now(),
  });
}

export function getActiveWardenCalloutReports(): WardenCalloutReport[] {
  return [...activeByKey.values()];
}

/**
 * Pure truthfulness helper — a CRITICAL callout is legal only when the
 * immutable result for that target is critical and dealt damage.
 */
export function mayPublishCriticalCallout(input: {
  resultTargetId: string;
  resultCritical: boolean;
  calloutTargetId: string;
  /** When provided, CRITICAL requires actual damage dealt. */
  resultDamage?: number;
}): boolean {
  if (input.resultDamage != null && input.resultDamage <= 0) return false;
  return input.resultCritical && input.resultTargetId === input.calloutTargetId;
}
