/**
 * Combat Refactor Phase 4 — encounter objective telemetry.
 */

import type {
  EncounterObjectiveKind,
  EncounterObjectiveSource,
  EncounterObjectiveTemplateId,
} from '../../types/encounterObjective';

export interface EncounterObjectiveTelemetry {
  objectivePresented: boolean;
  primaryKind: EncounterObjectiveKind | null;
  primaryTemplateId: EncounterObjectiveTemplateId | null;
  source: EncounterObjectiveSource;
  softKinds: EncounterObjectiveKind[];
  completed: boolean;
  failed: boolean;
  enemyTurnsSurvived: number;
  channelsInterrupted: number;
  markedKills: number;
  detonationsPrevented: number;
  cargoStressTicks: number;
  timelineEventsSeen: number;
  replacedPressure: boolean;
}

export function createEmptyObjectiveTelemetry(): EncounterObjectiveTelemetry {
  return {
    objectivePresented: false,
    primaryKind: null,
    primaryTemplateId: null,
    source: 'NONE',
    softKinds: [],
    completed: false,
    failed: false,
    enemyTurnsSurvived: 0,
    channelsInterrupted: 0,
    markedKills: 0,
    detonationsPrevented: 0,
    cargoStressTicks: 0,
    timelineEventsSeen: 0,
    replacedPressure: false,
  };
}

export function formatObjectiveTelemetrySummary(t: EncounterObjectiveTelemetry): string {
  if (!t.objectivePresented) return 'OBJECTIVE TELEMETRY — none presented';
  const soft = t.softKinds.length > 0 ? t.softKinds.join(', ') : '—';
  return [
    'OBJECTIVE TELEMETRY',
    `  Primary: ${t.primaryKind ?? '—'} (${t.primaryTemplateId ?? '—'})`,
    `  Source: ${t.source} // pressure replaced: ${t.replacedPressure ? 'yes' : 'no'}`,
    `  Soft: ${soft}`,
    `  Outcome: ${t.completed ? 'COMPLETE' : t.failed ? 'FAILED' : 'OPEN'}`,
    `  Survived ${t.enemyTurnsSurvived} // interrupts ${t.channelsInterrupted} // marked kills ${t.markedKills}`,
    `  Detonations stopped ${t.detonationsPrevented} // cargo stress ${t.cargoStressTicks} // timeline ${t.timelineEventsSeen}`,
  ].join('\n');
}
