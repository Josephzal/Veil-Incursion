/**
 * Combat Refactor Phase 4 — light combat timeline for setpiece objectives.
 * Not a full Veil Surge system — countdown chips only.
 */

import type {
  CombatTimelineEvent,
  CombatTimelineEventKind,
  EncounterObjectiveRuntime,
  EncounterObjectiveTemplate,
} from '../types/encounterObjective';

let timelineSeq = 0;

export function createTimelineEvent(input: {
  kind: CombatTimelineEventKind;
  label: string;
  turnsRemaining: number;
  linkedObjectiveId?: string;
  cancelOnObjectiveComplete?: boolean;
  previewOnly?: boolean;
}): CombatTimelineEvent {
  timelineSeq += 1;
  return {
    id: `tl-${timelineSeq}-${input.kind}`,
    kind: input.kind,
    label: input.label,
    turnsRemaining: Math.max(0, input.turnsRemaining),
    linkedObjectiveId: input.linkedObjectiveId,
    cancelOnObjectiveComplete: input.cancelOnObjectiveComplete ?? true,
    previewOnly: input.previewOnly ?? false,
  };
}

export function buildTimelineForObjective(
  template: EncounterObjectiveTemplate,
  objective: EncounterObjectiveRuntime,
  turns: number,
): CombatTimelineEvent[] {
  if (!template.timelineKind || !template.timelineLabel) return [];
  return [
    createTimelineEvent({
      kind: template.timelineKind,
      label: template.timelineLabel,
      turnsRemaining: turns,
      linkedObjectiveId: objective.templateId,
      cancelOnObjectiveComplete: !objective.isSoft,
      previewOnly: objective.isSoft,
    }),
  ];
}

/** Tick active timeline events at end of each enemy turn. Returns cancelled ids. */
export function tickCombatTimeline(
  events: CombatTimelineEvent[],
): { next: CombatTimelineEvent[]; expired: CombatTimelineEvent[] } {
  const expired: CombatTimelineEvent[] = [];
  const next: CombatTimelineEvent[] = [];
  for (const ev of events) {
    const turnsRemaining = ev.turnsRemaining - 1;
    if (turnsRemaining <= 0) {
      expired.push({ ...ev, turnsRemaining: 0 });
    } else {
      next.push({ ...ev, turnsRemaining });
    }
  }
  return { next, expired };
}

export function cancelTimelineForObjective(
  events: CombatTimelineEvent[],
  objectiveTemplateId: string,
): CombatTimelineEvent[] {
  return events.filter((ev) => {
    if (ev.linkedObjectiveId !== objectiveTemplateId) return true;
    return !ev.cancelOnObjectiveComplete;
  });
}

export function formatTimelinePreview(events: readonly CombatTimelineEvent[]): string {
  if (events.length === 0) return 'No timeline events.';
  return events
    .map((ev) => {
      const tag = ev.previewOnly ? 'preview' : 'active';
      return `  [${ev.kind}] ${ev.label} — T-${ev.turnsRemaining} (${tag})`;
    })
    .join('\n');
}
