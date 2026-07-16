/**
 * Combat Refactor Phase 4 — DevTest helpers for encounter objectives.
 */

import type { EnvironmentalModifiers } from '../types/game';
import type { EncounterObjectiveTemplateId } from '../types/encounterObjective';
import {
  applyEncounterObjectiveStampToEnvironment,
  selectEncounterObjectiveStamp,
} from './encounterObjectiveEngine';
import { getEncounterObjectiveTemplate, listEncounterObjectiveTemplates } from './encounterObjectiveCatalog';
import { formatTimelinePreview, createTimelineEvent } from './combatTimelineEngine';
import { DEFEND_RIFT_SURVIVAL_TURNS } from '../types/sectorPacing';

export function debugListEncounterObjectiveTemplates(): string {
  const lines = [
    '══════════════════════════════════════',
    'ENCOUNTER OBJECTIVE TEMPLATES',
    '══════════════════════════════════════',
  ];
  for (const t of listEncounterObjectiveTemplates()) {
    lines.push(
      `${t.id} | ${t.kind} | ${t.isSoft ? 'SOFT' : 'HARD'} | win=${t.winMode}`,
      `  ${t.label} — ${t.brief}`,
    );
  }
  return lines.join('\n');
}

export function debugForceEncounterObjective(
  env: EnvironmentalModifiers,
  templateId: EncounterObjectiveTemplateId,
  opts?: { withProtectCargo?: boolean },
): EnvironmentalModifiers {
  const stamp = selectEncounterObjectiveStamp({
    depth: 2,
    isElite: true,
    isEcho: false,
    isAnchor: false,
    defendRift: false,
    squad: [],
    forceTemplateId: templateId,
    hasUnstableCargo: opts?.withProtectCargo,
  });
  if (!stamp) return env;
  if (opts?.withProtectCargo && templateId !== 'OBJ_PROTECT_CARGO') {
    stamp.secondaryTemplateIds = [
      ...(stamp.secondaryTemplateIds ?? []),
      'OBJ_PROTECT_CARGO',
    ];
  }
  return applyEncounterObjectiveStampToEnvironment(env, stamp);
}

export function debugPreviewDefendRiftObjective(): string {
  const stamp = selectEncounterObjectiveStamp({
    depth: 1,
    isElite: true,
    isEcho: false,
    isAnchor: false,
    defendRift: true,
    squad: [],
    hasUnstableCargo: true,
  });
  const template = stamp
    ? getEncounterObjectiveTemplate(stamp.primaryTemplateId)
    : null;
  const timeline = stamp
    ? [
        createTimelineEvent({
          kind: 'EXTRACTION_WINDOW',
          label: 'Extraction window',
          turnsRemaining: stamp.survivalTurnsRequired ?? DEFEND_RIFT_SURVIVAL_TURNS,
          linkedObjectiveId: stamp.primaryTemplateId,
        }),
        createTimelineEvent({
          kind: 'CARGO_STRESS',
          label: 'Cargo stress',
          turnsRemaining: stamp.survivalTurnsRequired ?? DEFEND_RIFT_SURVIVAL_TURNS,
          previewOnly: true,
        }),
      ]
    : [];
  return [
    '══════════════════════════════════════',
    'DEFEND RIFT / DIRTY EXTRACTION PREVIEW',
    '══════════════════════════════════════',
    stamp
      ? `Primary: ${stamp.primaryTemplateId} (${template?.label})`
      : 'No stamp',
    `Survival turns: ${stamp?.survivalTurnsRequired ?? '—'}`,
    `Secondary: ${(stamp?.secondaryTemplateIds ?? []).join(', ') || '—'}`,
    `Incoming mitigation: ${stamp?.incomingDamageMitigationPct ?? 0}%`,
    '',
    'Timeline preview:',
    formatTimelinePreview(timeline),
  ].join('\n');
}

export function debugSimulateObjectiveSelection(input: {
  depth: 1 | 2 | 3;
  isElite?: boolean;
  isEcho?: boolean;
  isAnchor?: boolean;
  defendRift?: boolean;
  crisisTheme?: string;
  compositionTemplateId?: string;
  hasCaller?: boolean;
  hasUnstableCargo?: boolean;
}): string {
  const squad = input.hasCaller
    ? [{ rosterId: 'smog-caller', unitId: 'u-caller', currentHp: 40, intent: 'STRIKE' as const } as never]
    : [];
  const stamp = selectEncounterObjectiveStamp({
    depth: input.depth,
    isElite: input.isElite ?? false,
    isEcho: input.isEcho ?? false,
    isAnchor: input.isAnchor ?? false,
    defendRift: input.defendRift ?? false,
    crisisTheme: input.crisisTheme,
    compositionTemplateId: input.compositionTemplateId,
    squad,
    hasUnstableCargo: input.hasUnstableCargo,
    nodesCleared: input.depth === 1 ? 4 : 10,
  });
  return stamp
    ? `Selected ${stamp.primaryTemplateId} from ${stamp.source}`
    : 'No objective selected';
}
