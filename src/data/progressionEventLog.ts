import type { ProgressionEvent, ProgressionEventKind, ProgressionProfile } from '../types/progression';
import { PROGRESSION_EVENT_LOG_CAP } from './progressionProfileEngine';

let eventSeq = 0;

function nextEventId(): string {
  eventSeq += 1;
  return `prog-evt-${Date.now()}-${eventSeq}`;
}

export function createProgressionEvent(input: {
  kind: ProgressionEventKind;
  message: string;
  unlockId?: string;
  meta?: ProgressionEvent['meta'];
  atMs?: number;
}): ProgressionEvent {
  return {
    id: nextEventId(),
    atMs: input.atMs ?? Date.now(),
    kind: input.kind,
    message: input.message,
    unlockId: input.unlockId,
    meta: input.meta,
  };
}

export function appendProgressionEvent(
  profile: ProgressionProfile,
  input: {
    kind: ProgressionEventKind;
    message: string;
    unlockId?: string;
    meta?: ProgressionEvent['meta'];
  },
): ProgressionProfile {
  const event = createProgressionEvent(input);
  return {
    ...profile,
    eventLog: [...profile.eventLog, event].slice(-PROGRESSION_EVENT_LOG_CAP),
  };
}

export function formatProgressionEventLog(
  profile: ProgressionProfile,
  limit = 20,
): string[] {
  return profile.eventLog
    .slice(-limit)
    .map((event) => {
      const stamp = new Date(event.atMs).toISOString().slice(11, 19);
      return `[${stamp}] ${event.kind} — ${event.message}`;
    });
}

export function clearProgressionEventLog(profile: ProgressionProfile): ProgressionProfile {
  return {
    ...profile,
    eventLog: [],
  };
}
