/**
 * Dev-only ultimate activation trace (Phase 3M runtime repair).
 * Enable with globalThis.__VEIL_ULTIMATE_TRACE__ = true
 */

export type UltimateTraceEvent =
  | 'ultimate-control-activated'
  | 'ultimate-interaction-requested'
  | 'ultimate-interaction-mounted'
  | 'ultimate-interaction-cancelled'
  | 'ultimate-interaction-completed'
  | 'ultimate-commit-started'
  | 'ultimate-commit-finished';

export interface UltimateTracePayload {
  event: UltimateTraceEvent;
  weaponFamilyId?: string | null;
  ultimateId?: string | null;
  activationToken?: string | null;
  targets?: readonly string[];
  interactionId?: string | null;
  detail?: string;
  at: number;
}

const BUFFER: UltimateTracePayload[] = [];
const MAX = 80;

function enabled(): boolean {
  try {
    return (globalThis as { __VEIL_ULTIMATE_TRACE__?: boolean }).__VEIL_ULTIMATE_TRACE__ === true;
  } catch {
    return false;
  }
}

export function traceUltimateActivation(payload: Omit<UltimateTracePayload, 'at'>): void {
  if (!enabled()) return;
  const entry: UltimateTracePayload = { ...payload, at: Date.now() };
  BUFFER.push(entry);
  if (BUFFER.length > MAX) BUFFER.splice(0, BUFFER.length - MAX);
  // eslint-disable-next-line no-console
  console.info('[ultimate-trace]', entry.event, entry);
}

export function getUltimateTraceBuffer(): readonly UltimateTracePayload[] {
  return BUFFER;
}

export function clearUltimateTraceBuffer(): void {
  BUFFER.length = 0;
}

export function createUltimateActivationToken(): string {
  return `ult-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** True when a timed interaction window expired with no player input. */
export function shouldCancelUltimateOnZeroInput(score: {
  hitCount?: number;
  tapCount?: number;
  nodesCompleted?: number;
  stageScores?: readonly number[];
  interacted?: boolean;
}): boolean {
  if (score.interacted === true) return false;
  if ((score.hitCount ?? 0) > 0) return false;
  if ((score.tapCount ?? 0) > 0) return false;
  if ((score.nodesCompleted ?? 0) > 0) return false;
  if (score.stageScores && score.stageScores.some((s) => s > 0.05)) return false;
  return true;
}
