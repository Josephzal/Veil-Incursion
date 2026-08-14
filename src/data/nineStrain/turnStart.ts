import type { PendingQueuedEffect, TurnStartPhase } from '../../types/nineStrain';

export const TURN_START_PHASES: readonly TurnStartPhase[] = [
  'RESOURCE_CONVERSION_WAKE',
  'FATEBOUND_VALIDATION',
  'AFTERIMAGE_DELAY_CHOICE',
  'PENDING_TRACE_RESOLUTION',
  'OTHER_QUEUED_EFFECTS',
  'PLAYER_CONTROL',
];

export function orderPendingTurnStartEffects(
  pending: readonly PendingQueuedEffect[],
): PendingQueuedEffect[] {
  const traces = pending.filter((row) => row.kind === 'TRACE').sort((a, b) => a.createdOrder - b.createdOrder);
  const others = pending.filter((row) => row.kind !== 'TRACE').sort((a, b) => {
    if (a.definitionId !== b.definitionId) return a.definitionId.localeCompare(b.definitionId);
    return a.createdOrder - b.createdOrder;
  });
  return [...traces, ...others];
}
