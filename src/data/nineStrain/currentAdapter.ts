import type {
  CurrentAdapterInput,
  CurrentChangeKind,
  CurrentSignalKind,
} from '../../types/nineStrain';

export interface NormalizedCurrentEvent {
  kind: CurrentChangeKind;
  signal: CurrentSignalKind;
  excluded: boolean;
}

function ordinaryKind(input: CurrentAdapterInput): CurrentChangeKind | null {
  if (input.preserved) return 'PRESERVED';
  if (input.ordinarySpend || input.ammoSpent) return 'SPENT';
  if (input.ordinaryGain || input.reloadRestoredRounds) return 'GAINED';
  return null;
}

function majorKind(input: CurrentAdapterInput): CurrentChangeKind | null {
  if (input.reserveEmptied) return 'EMPTIED';
  if (input.reserveEntered50 || input.brinkEntered) return 'THRESHOLD_ENTERED';
  if (
    input.brandCycleCompleted
    || input.ammoCycleCompleted
    || input.cleanCycleCompleted
    || input.catalystResolved
    || input.perfectReload
    || input.magazineEmptyOrFull
    || input.protocolChanged
  ) {
    return 'CYCLE_COMPLETED';
  }
  return null;
}

/**
 * Rot is never Current. Delayed restore and Sixth Seal ultimate refill are excluded.
 * If ordinary and major both fire on one root action, major wins.
 */
export function resolveCurrentEvent(input: CurrentAdapterInput): NormalizedCurrentEvent | null {
  if (input.delayedRestore || input.ultimateOwnedRefill) {
    return { kind: 'GAINED', signal: 'ORDINARY', excluded: true };
  }
  const major = majorKind(input);
  const ordinary = ordinaryKind(input);
  if (major) {
    return { kind: major, signal: 'MAJOR', excluded: false };
  }
  if (ordinary) {
    return { kind: ordinary, signal: 'ORDINARY', excluded: false };
  }
  return null;
}

export function currentEventType(
  kind: CurrentChangeKind,
): 'CURRENT_GAINED' | 'CURRENT_SPENT' | 'CURRENT_PRESERVED' | 'CURRENT_CONVERTED' | 'CURRENT_EMPTIED' | 'CURRENT_THRESHOLD_ENTERED' | 'CURRENT_CYCLE_COMPLETED' {
  if (kind === 'GAINED') return 'CURRENT_GAINED';
  if (kind === 'SPENT') return 'CURRENT_SPENT';
  if (kind === 'PRESERVED') return 'CURRENT_PRESERVED';
  if (kind === 'CONVERTED') return 'CURRENT_CONVERTED';
  if (kind === 'EMPTIED') return 'CURRENT_EMPTIED';
  if (kind === 'THRESHOLD_ENTERED') return 'CURRENT_THRESHOLD_ENTERED';
  return 'CURRENT_CYCLE_COMPLETED';
}
