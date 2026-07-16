/**
 * Combat Refactor Phase 4 — Encounter Objectives.
 * Layered beside legacy CombatObjective (ERADICATE / SURVIVE_TURNS).
 */

export type EncounterObjectiveKind =
  | 'KILL_CALLER'
  | 'INTERRUPT_RITUAL'
  | 'SURVIVE_TURNS'
  | 'HOLD_EXTRACTION_WINDOW'
  | 'CLEAR_ECHO'
  | 'BREAK_ANCHOR_LINK'
  /** Soft / value-only in v1 — telemetry + UI, does not gate victory. */
  | 'PROTECT_CARGO'
  | 'STABILIZE_RESOURCE'
  | 'PREVENT_DETONATION';

export type EncounterObjectiveTemplateId =
  | 'OBJ_KILL_CALLER'
  | 'OBJ_INTERRUPT_RITUAL'
  | 'OBJ_SURVIVE_TURNS'
  | 'OBJ_HOLD_EXTRACTION_WINDOW'
  | 'OBJ_CLEAR_ECHO'
  | 'OBJ_BREAK_ANCHOR_LINK'
  | 'OBJ_PROTECT_CARGO'
  | 'OBJ_STABILIZE_RESOURCE'
  | 'OBJ_PREVENT_DETONATION';

export type EncounterObjectiveStatus =
  | 'ACTIVE'
  | 'COMPLETE'
  | 'FAILED'
  | 'ABANDONED';

export type EncounterObjectiveSource =
  | 'DEFEND_RIFT'
  | 'ECHO'
  | 'ANCHOR'
  | 'CALLER'
  | 'RITUAL'
  | 'COMPOSITION'
  | 'CRISIS'
  | 'DEV'
  | 'NONE';

export type CombatTimelineEventKind =
  | 'EXTRACTION_WINDOW'
  | 'RITUAL_CHANNEL'
  | 'ECHO_SURGE'
  | 'ANCHOR_PULSE'
  | 'CARGO_STRESS'
  | 'DETONATION_TIMER';

export type EncounterObjectiveWinMode =
  | 'KILL_MARKED'
  | 'INTERRUPT_CHANNEL'
  | 'SURVIVE_TURNS'
  | 'CLEAR_ALL'
  | 'BREAK_LINK'
  | 'SOFT_VALUE';

export interface CombatTimelineEvent {
  id: string;
  kind: CombatTimelineEventKind;
  label: string;
  turnsRemaining: number;
  linkedObjectiveId?: string;
  cancelOnObjectiveComplete?: boolean;
  /** Preview-only chips for soft objectives / setpiece flavor. */
  previewOnly?: boolean;
}

export interface EncounterObjectiveTemplate {
  id: EncounterObjectiveTemplateId;
  kind: EncounterObjectiveKind;
  label: string;
  brief: string;
  isSoft: boolean;
  winMode: EncounterObjectiveWinMode;
  /** When true, objective replaces full eradicate pressure (survive / kill-marked / interrupt). */
  replacesPressure: boolean;
  defaultProgressRequired: number;
  progressNoun: string;
  timelineKind?: CombatTimelineEventKind;
  timelineLabel?: string;
}

/** Serializable stamp written onto EnvironmentalModifiers at encounter prep. */
export interface EncounterObjectiveStamp {
  primaryTemplateId: EncounterObjectiveTemplateId;
  secondaryTemplateIds?: readonly EncounterObjectiveTemplateId[];
  source: EncounterObjectiveSource;
  survivalTurnsRequired?: number;
  /** Prefer marking these roster ids (callers, etc.). */
  preferredMarkedRosterIds?: readonly string[];
  /** Soft pressure replacement — reduce incoming enemy damage %. */
  incomingDamageMitigationPct?: number;
}

export interface EncounterObjectiveRuntime {
  templateId: EncounterObjectiveTemplateId;
  kind: EncounterObjectiveKind;
  label: string;
  brief: string;
  status: EncounterObjectiveStatus;
  isSoft: boolean;
  winMode: EncounterObjectiveWinMode;
  replacesPressure: boolean;
  progressCurrent: number;
  progressRequired: number;
  progressNoun: string;
  markedUnitIds: string[];
  linkedTimelineEventIds: string[];
  survivalTurnsRequired?: number;
}

export interface EncounterObjectiveSession {
  primary: EncounterObjectiveRuntime | null;
  secondary: EncounterObjectiveRuntime[];
  timeline: CombatTimelineEvent[];
  source: EncounterObjectiveSource;
  enemyTurnsSurvived: number;
  channelsInterrupted: number;
  markedKills: number;
  detonationsPrevented: number;
  cargoStressTicks: number;
}
