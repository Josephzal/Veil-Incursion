/**
 * Combat Refactor Phase 4 — encounter objective validation.
 */

import {
  ENCOUNTER_OBJECTIVE_TEMPLATES,
  listEncounterObjectiveTemplates,
} from '../encounterObjectiveCatalog';
import type { EncounterObjectiveTemplateId } from '../../types/encounterObjective';
import { selectEncounterObjectiveStamp } from '../encounterObjectiveEngine';
import { DEFEND_RIFT_SURVIVAL_TURNS } from '../../types/sectorPacing';

export function validateEncounterObjectiveCatalog(): string[] {
  const errors: string[] = [];
  const templates = listEncounterObjectiveTemplates();
  if (templates.length < 6) {
    errors.push(`Expected ≥6 templates, got ${templates.length}`);
  }
  for (const t of templates) {
    if (!t.label.trim()) errors.push(`${t.id}: empty label`);
    if (!t.brief.trim()) errors.push(`${t.id}: empty brief`);
    if (t.defaultProgressRequired < 1) errors.push(`${t.id}: progress < 1`);
    if (t.isSoft && t.replacesPressure) {
      errors.push(`${t.id}: soft templates must not replace pressure`);
    }
  }
  const required: EncounterObjectiveTemplateId[] = [
    'OBJ_KILL_CALLER',
    'OBJ_INTERRUPT_RITUAL',
    'OBJ_SURVIVE_TURNS',
    'OBJ_HOLD_EXTRACTION_WINDOW',
    'OBJ_CLEAR_ECHO',
    'OBJ_BREAK_ANCHOR_LINK',
    'OBJ_PROTECT_CARGO',
  ];
  for (const id of required) {
    if (!ENCOUNTER_OBJECTIVE_TEMPLATES[id]) {
      errors.push(`Missing required template ${id}`);
    }
  }
  return errors;
}

export function validateDefendRiftObjectiveWiring(): string[] {
  const errors: string[] = [];
  const stamp = selectEncounterObjectiveStamp({
    depth: 1,
    isElite: true,
    isEcho: false,
    isAnchor: false,
    defendRift: true,
    squad: [],
    hasUnstableCargo: true,
  });
  if (!stamp) {
    errors.push('Defend rift must stamp an objective');
    return errors;
  }
  if (stamp.primaryTemplateId !== 'OBJ_HOLD_EXTRACTION_WINDOW') {
    errors.push(`Defend rift expected HOLD_EXTRACTION_WINDOW, got ${stamp.primaryTemplateId}`);
  }
  if (stamp.survivalTurnsRequired !== DEFEND_RIFT_SURVIVAL_TURNS) {
    errors.push(
      `Defend rift survival turns expected ${DEFEND_RIFT_SURVIVAL_TURNS}, got ${stamp.survivalTurnsRequired}`,
    );
  }
  if (!stamp.secondaryTemplateIds?.includes('OBJ_PROTECT_CARGO')) {
    errors.push('Defend rift with unstable cargo should soft-stamp PROTECT_CARGO');
  }
  return errors;
}

export function formatEncounterObjectiveValidationReport(): string {
  const catalogErrors = validateEncounterObjectiveCatalog();
  const defendErrors = validateDefendRiftObjectiveWiring();
  const errors = [...catalogErrors, ...defendErrors];
  const lines = [
    '══════════════════════════════════════',
    'ENCOUNTER OBJECTIVE VALIDATION',
    '══════════════════════════════════════',
    errors.length === 0 ? 'OK — catalog + defend-rift wiring' : `FAIL — ${errors.length} issue(s)`,
  ];
  for (const e of errors) lines.push(`  • ${e}`);
  lines.push('', `Templates: ${listEncounterObjectiveTemplates().length}`);
  return lines.join('\n');
}
