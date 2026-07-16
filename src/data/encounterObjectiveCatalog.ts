/**
 * Combat Refactor Phase 4 — encounter objective templates (v1).
 */

import type {
  EncounterObjectiveKind,
  EncounterObjectiveTemplate,
  EncounterObjectiveTemplateId,
} from '../types/encounterObjective';

export const ENCOUNTER_OBJECTIVE_TEMPLATES: Record<
  EncounterObjectiveTemplateId,
  EncounterObjectiveTemplate
> = {
  OBJ_KILL_CALLER: {
    id: 'OBJ_KILL_CALLER',
    kind: 'KILL_CALLER',
    label: 'KILL THE CALLER',
    brief: 'Eliminate the Caller. Remaining hostiles lose coordination.',
    isSoft: false,
    winMode: 'KILL_MARKED',
    replacesPressure: true,
    defaultProgressRequired: 1,
    progressNoun: 'Caller down',
    timelineKind: 'RITUAL_CHANNEL',
    timelineLabel: 'Caller signal rising',
  },
  OBJ_INTERRUPT_RITUAL: {
    id: 'OBJ_INTERRUPT_RITUAL',
    kind: 'INTERRUPT_RITUAL',
    label: 'INTERRUPT THE RITUAL',
    brief: 'Break the CHANNEL telegraph before the ritual resolves.',
    isSoft: false,
    winMode: 'INTERRUPT_CHANNEL',
    replacesPressure: true,
    defaultProgressRequired: 1,
    progressNoun: 'Channels broken',
    timelineKind: 'RITUAL_CHANNEL',
    timelineLabel: 'Ritual channel',
  },
  OBJ_SURVIVE_TURNS: {
    id: 'OBJ_SURVIVE_TURNS',
    kind: 'SURVIVE_TURNS',
    label: 'SURVIVE',
    brief: 'Endure hostile cycles. Eradication optional.',
    isSoft: false,
    winMode: 'SURVIVE_TURNS',
    replacesPressure: true,
    defaultProgressRequired: 3,
    progressNoun: 'Cycles endured',
    timelineKind: 'EXTRACTION_WINDOW',
    timelineLabel: 'Hold window',
  },
  OBJ_HOLD_EXTRACTION_WINDOW: {
    id: 'OBJ_HOLD_EXTRACTION_WINDOW',
    kind: 'HOLD_EXTRACTION_WINDOW',
    label: 'HOLD EXTRACTION',
    brief: 'Keep the evac conduit open through the intercept window.',
    isSoft: false,
    winMode: 'SURVIVE_TURNS',
    replacesPressure: true,
    defaultProgressRequired: 3,
    progressNoun: 'Window held',
    timelineKind: 'EXTRACTION_WINDOW',
    timelineLabel: 'Extraction window',
  },
  OBJ_CLEAR_ECHO: {
    id: 'OBJ_CLEAR_ECHO',
    kind: 'CLEAR_ECHO',
    label: 'CLEAR ECHO RESIDUE',
    brief: 'Neutralize the echo signature contaminating this node.',
    isSoft: false,
    winMode: 'CLEAR_ALL',
    replacesPressure: false,
    defaultProgressRequired: 1,
    progressNoun: 'Echo cleared',
    timelineKind: 'ECHO_SURGE',
    timelineLabel: 'Echo surge',
  },
  OBJ_BREAK_ANCHOR_LINK: {
    id: 'OBJ_BREAK_ANCHOR_LINK',
    kind: 'BREAK_ANCHOR_LINK',
    label: 'BREAK ANCHOR LINK',
    brief: 'Sever the anchor-linked hostiles holding this breach.',
    isSoft: false,
    winMode: 'BREAK_LINK',
    replacesPressure: false,
    defaultProgressRequired: 1,
    progressNoun: 'Link broken',
    timelineKind: 'ANCHOR_PULSE',
    timelineLabel: 'Anchor pulse',
  },
  OBJ_PROTECT_CARGO: {
    id: 'OBJ_PROTECT_CARGO',
    kind: 'PROTECT_CARGO',
    label: 'PROTECT CARGO',
    brief: 'Unstable cargo is riding this fight — keep pressure off the hold.',
    isSoft: true,
    winMode: 'SOFT_VALUE',
    replacesPressure: false,
    defaultProgressRequired: 1,
    progressNoun: 'Cargo safe',
    timelineKind: 'CARGO_STRESS',
    timelineLabel: 'Cargo stress',
  },
  OBJ_STABILIZE_RESOURCE: {
    id: 'OBJ_STABILIZE_RESOURCE',
    kind: 'STABILIZE_RESOURCE',
    label: 'STABILIZE RESOURCE',
    brief: 'Keep the harvest node from collapsing under combat stress.',
    isSoft: true,
    winMode: 'SOFT_VALUE',
    replacesPressure: false,
    defaultProgressRequired: 1,
    progressNoun: 'Stabilized',
  },
  OBJ_PREVENT_DETONATION: {
    id: 'OBJ_PREVENT_DETONATION',
    kind: 'PREVENT_DETONATION',
    label: 'PREVENT DETONATION',
    brief: 'Interrupt DETONATE telegraphs before they resolve.',
    isSoft: true,
    winMode: 'SOFT_VALUE',
    replacesPressure: false,
    defaultProgressRequired: 1,
    progressNoun: 'Detonations stopped',
    timelineKind: 'DETONATION_TIMER',
    timelineLabel: 'Detonation timer',
  },
};

export const CALLER_ROSTER_IDS = ['smog-caller', 'static-caller'] as const;

export function getEncounterObjectiveTemplate(
  id: EncounterObjectiveTemplateId,
): EncounterObjectiveTemplate {
  return ENCOUNTER_OBJECTIVE_TEMPLATES[id];
}

export function listEncounterObjectiveTemplates(): EncounterObjectiveTemplate[] {
  return Object.values(ENCOUNTER_OBJECTIVE_TEMPLATES);
}

export function formatObjectiveKindLabel(kind: EncounterObjectiveKind): string {
  return kind.replace(/_/g, ' ');
}
