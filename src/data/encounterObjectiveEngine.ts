/**
 * Combat Refactor Phase 4 — encounter objective selection, session, progress.
 */

import type { EnvironmentalModifiers } from '../types/game';
import type { EnemyCombatProfile } from '../types/run';
import type {
  EncounterObjectiveRuntime,
  EncounterObjectiveSession,
  EncounterObjectiveSource,
  EncounterObjectiveStamp,
  EncounterObjectiveStatus,
  EncounterObjectiveTemplateId,
} from '../types/encounterObjective';
import {
  CALLER_ROSTER_IDS,
  getEncounterObjectiveTemplate,
} from './encounterObjectiveCatalog';
import {
  buildTimelineForObjective,
  cancelTimelineForObjective,
  createTimelineEvent,
  tickCombatTimeline,
} from './combatTimelineEngine';
import { DEFEND_RIFT_SURVIVAL_TURNS } from '../types/sectorPacing';
import { getIntentCatalogEntry } from './enemyIntentCatalog';

export interface SelectEncounterObjectiveInput {
  depth: 1 | 2 | 3;
  isElite: boolean;
  isEcho: boolean;
  isAnchor: boolean;
  defendRift: boolean;
  crisisTheme?: string | null;
  compositionTemplateId?: string | null;
  squad: readonly EnemyCombatProfile[];
  hasUnstableCargo?: boolean;
  hasHighValueCargo?: boolean;
  /** Dev / forced override. */
  forceTemplateId?: EncounterObjectiveTemplateId | null;
  nodesCleared?: number;
}

function createRuntime(
  templateId: EncounterObjectiveTemplateId,
  overrides?: Partial<Pick<EncounterObjectiveRuntime, 'progressRequired' | 'survivalTurnsRequired' | 'markedUnitIds'>>,
): EncounterObjectiveRuntime {
  const template = getEncounterObjectiveTemplate(templateId);
  return {
    templateId,
    kind: template.kind,
    label: template.label,
    brief: template.brief,
    status: 'ACTIVE',
    isSoft: template.isSoft,
    winMode: template.winMode,
    replacesPressure: template.replacesPressure,
    progressCurrent: 0,
    progressRequired: overrides?.progressRequired ?? template.defaultProgressRequired,
    progressNoun: template.progressNoun,
    markedUnitIds: overrides?.markedUnitIds ?? [],
    linkedTimelineEventIds: [],
    survivalTurnsRequired: overrides?.survivalTurnsRequired,
  };
}

export function createEmptyEncounterObjectiveSession(): EncounterObjectiveSession {
  return {
    primary: null,
    secondary: [],
    timeline: [],
    source: 'NONE',
    enemyTurnsSurvived: 0,
    channelsInterrupted: 0,
    markedKills: 0,
    detonationsPrevented: 0,
    cargoStressTicks: 0,
  };
}

export function findCallerUnitIds(squad: readonly EnemyCombatProfile[]): string[] {
  return squad
    .filter((u) => u.rosterId && (CALLER_ROSTER_IDS as readonly string[]).includes(u.rosterId))
    .map((u) => u.unitId)
    .filter((id): id is string => Boolean(id));
}

export function squadHasCaller(squad: readonly EnemyCombatProfile[]): boolean {
  return findCallerUnitIds(squad).length > 0;
}

export function squadHasChannelSupport(squad: readonly EnemyCombatProfile[]): boolean {
  return squad.some((u) => {
    if ((u.currentHp ?? 0) <= 0) return false;
    const meta = getIntentCatalogEntry(u.intent);
    return meta.type === 'CHANNEL' || meta.type === 'DETONATE';
  });
}

/**
 * Depth-gated selection. Objectives replace pressure — rare early Depth 1.
 * Priority: defend rift > forced > echo > anchor > caller > ritual > soft cargo.
 */
export function selectEncounterObjectiveStamp(
  input: SelectEncounterObjectiveInput,
): EncounterObjectiveStamp | null {
  if (input.forceTemplateId) {
    return {
      primaryTemplateId: input.forceTemplateId,
      source: 'DEV',
      survivalTurnsRequired:
        input.forceTemplateId === 'OBJ_HOLD_EXTRACTION_WINDOW'
        || input.forceTemplateId === 'OBJ_SURVIVE_TURNS'
          ? DEFEND_RIFT_SURVIVAL_TURNS
          : undefined,
      preferredMarkedRosterIds: [...CALLER_ROSTER_IDS],
    };
  }

  if (input.defendRift) {
    const secondary: EncounterObjectiveTemplateId[] = [];
    if (input.hasUnstableCargo || input.hasHighValueCargo) {
      secondary.push('OBJ_PROTECT_CARGO');
    }
    return {
      primaryTemplateId: 'OBJ_HOLD_EXTRACTION_WINDOW',
      secondaryTemplateIds: secondary,
      source: 'DEFEND_RIFT',
      survivalTurnsRequired: DEFEND_RIFT_SURVIVAL_TURNS,
      incomingDamageMitigationPct: 10,
    };
  }

  if (input.isEcho) {
    return {
      primaryTemplateId: 'OBJ_CLEAR_ECHO',
      source: 'ECHO',
      secondaryTemplateIds: input.hasUnstableCargo ? ['OBJ_PROTECT_CARGO'] : undefined,
    };
  }

  if (input.isAnchor) {
    return {
      primaryTemplateId: 'OBJ_BREAK_ANCHOR_LINK',
      source: 'ANCHOR',
    };
  }

  // Depth 1: only stamp when caller present (natural setpiece) or late nodes.
  const earlyDepth1 = input.depth === 1 && (input.nodesCleared ?? 0) < 3;
  if (squadHasCaller(input.squad) && (!earlyDepth1 || input.isElite)) {
    return {
      primaryTemplateId: 'OBJ_KILL_CALLER',
      source: 'CALLER',
      preferredMarkedRosterIds: [...CALLER_ROSTER_IDS],
      incomingDamageMitigationPct: 8,
    };
  }

  const ritualCrisis =
    input.crisisTheme === 'CONTAINMENT_FAILURE'
    || input.crisisTheme === 'MIRROR_CONTAMINATION'
    || input.compositionTemplateId === 'SUPPORT_CORE';

  if (ritualCrisis && input.depth >= 2 && (squadHasChannelSupport(input.squad) || input.isElite)) {
    return {
      primaryTemplateId: 'OBJ_INTERRUPT_RITUAL',
      source: 'RITUAL',
      secondaryTemplateIds: ['OBJ_PREVENT_DETONATION'],
      incomingDamageMitigationPct: 8,
    };
  }

  // Soft cargo-only stamp on high-risk cargo composition (value tracking).
  if (
    input.compositionTemplateId === 'HIGH_RISK_CARGO_GUARD'
    && (input.hasUnstableCargo || input.hasHighValueCargo)
  ) {
    return {
      primaryTemplateId: 'OBJ_PROTECT_CARGO',
      source: 'COMPOSITION',
    };
  }

  return null;
}

export function applyEncounterObjectiveStampToEnvironment(
  env: EnvironmentalModifiers,
  stamp: EncounterObjectiveStamp | null,
): EnvironmentalModifiers {
  if (!stamp) {
    if (!env.encounterObjective) return env;
    const { encounterObjective: _removed, ...rest } = env;
    return rest;
  }

  const template = getEncounterObjectiveTemplate(stamp.primaryTemplateId);
  const next: EnvironmentalModifiers = {
    ...env,
    encounterObjective: stamp,
  };

  if (template.winMode === 'SURVIVE_TURNS') {
    next.combatObjective = 'SURVIVE_TURNS';
    next.survivalTurnsRequired =
      stamp.survivalTurnsRequired
      ?? template.defaultProgressRequired
      ?? DEFEND_RIFT_SURVIVAL_TURNS;
  }

  return next;
}

export function buildEncounterObjectiveSession(
  stamp: EncounterObjectiveStamp | null,
  squad: readonly EnemyCombatProfile[],
): EncounterObjectiveSession {
  if (!stamp) return createEmptyEncounterObjectiveSession();

  const primaryTemplate = getEncounterObjectiveTemplate(stamp.primaryTemplateId);
  const marked =
    primaryTemplate.winMode === 'KILL_MARKED'
      ? findCallerUnitIds(squad)
      : [];

  const primary = createRuntime(stamp.primaryTemplateId, {
    progressRequired:
      stamp.survivalTurnsRequired
      ?? (primaryTemplate.winMode === 'SURVIVE_TURNS'
        ? DEFEND_RIFT_SURVIVAL_TURNS
        : primaryTemplate.defaultProgressRequired),
    survivalTurnsRequired: stamp.survivalTurnsRequired,
    markedUnitIds: marked,
  });

  const secondary = (stamp.secondaryTemplateIds ?? []).map((id) => createRuntime(id));

  const timeline = [
    ...buildTimelineForObjective(
      primaryTemplate,
      primary,
      primary.survivalTurnsRequired
        ?? primary.progressRequired
        ?? primaryTemplate.defaultProgressRequired,
    ),
  ];

  for (const soft of secondary) {
    const softTemplate = getEncounterObjectiveTemplate(soft.templateId);
    timeline.push(
      ...buildTimelineForObjective(
        softTemplate,
        soft,
        Math.max(2, primary.progressRequired),
      ),
    );
  }

  // Soft protect-cargo stress chip even without secondary template timeline.
  if (
    stamp.secondaryTemplateIds?.includes('OBJ_PROTECT_CARGO')
    && !timeline.some((t) => t.kind === 'CARGO_STRESS')
  ) {
    timeline.push(
      createTimelineEvent({
        kind: 'CARGO_STRESS',
        label: 'Cargo stress',
        turnsRemaining: primary.progressRequired,
        linkedObjectiveId: 'OBJ_PROTECT_CARGO',
        previewOnly: true,
        cancelOnObjectiveComplete: false,
      }),
    );
  }

  primary.linkedTimelineEventIds = timeline
    .filter((t) => t.linkedObjectiveId === primary.templateId)
    .map((t) => t.id);

  return {
    primary,
    secondary,
    timeline,
    source: stamp.source,
    enemyTurnsSurvived: 0,
    channelsInterrupted: 0,
    markedKills: 0,
    detonationsPrevented: 0,
    cargoStressTicks: 0,
  };
}

function setStatus(
  obj: EncounterObjectiveRuntime,
  status: EncounterObjectiveStatus,
): EncounterObjectiveRuntime {
  return { ...obj, status };
}

export interface ObjectiveProgressResult {
  session: EncounterObjectiveSession;
  primaryCompleted: boolean;
  primaryFailed: boolean;
  logLines: string[];
  phaseAlert: string | null;
}

function completePrimary(
  session: EncounterObjectiveSession,
  logLines: string[],
): ObjectiveProgressResult {
  if (!session.primary || session.primary.status !== 'ACTIVE') {
    return {
      session,
      primaryCompleted: false,
      primaryFailed: false,
      logLines,
      phaseAlert: null,
    };
  }
  const primary = setStatus(
    {
      ...session.primary,
      progressCurrent: session.primary.progressRequired,
    },
    'COMPLETE',
  );
  const timeline = cancelTimelineForObjective(session.timeline, primary.templateId);
  const secondary = session.secondary.map((s) =>
    s.isSoft && s.status === 'ACTIVE' ? setStatus(s, 'COMPLETE') : s,
  );
  logLines.push(`>> OBJECTIVE COMPLETE — ${primary.label}.`);
  return {
    session: { ...session, primary, secondary, timeline },
    primaryCompleted: true,
    primaryFailed: false,
    logLines,
    phaseAlert: `>> OBJECTIVE SECURED // ${primary.label}`,
  };
}

export function progressObjectiveOnEnemyTurnEnd(
  session: EncounterObjectiveSession,
): ObjectiveProgressResult {
  const logLines: string[] = [];
  if (!session.primary || session.primary.status !== 'ACTIVE') {
    const { next, expired } = tickCombatTimeline(session.timeline);
    for (const ev of expired) {
      if (!ev.previewOnly) {
        logLines.push(`>> TIMELINE EXPIRED — ${ev.label}.`);
      }
    }
    return {
      session: { ...session, timeline: next },
      primaryCompleted: false,
      primaryFailed: false,
      logLines,
      phaseAlert: null,
    };
  }

  const enemyTurnsSurvived = session.enemyTurnsSurvived + 1;
  let primary = { ...session.primary };
  const { next: timelineAfterTick, expired } = tickCombatTimeline(session.timeline);

  for (const ev of expired) {
    if (ev.previewOnly) continue;
    if (
      primary.winMode === 'SURVIVE_TURNS'
      && ev.kind === 'EXTRACTION_WINDOW'
      && ev.linkedObjectiveId === primary.templateId
    ) {
      // Survive win is driven by progress counter below, not expiry.
      continue;
    }
    logLines.push(`>> TIMELINE PRESSURE — ${ev.label} resolved.`);
  }

  if (primary.winMode === 'SURVIVE_TURNS') {
    primary = {
      ...primary,
      progressCurrent: Math.min(primary.progressRequired, enemyTurnsSurvived),
    };
    logLines.push(
      `>> OBJECTIVE — ${primary.label}: ${primary.progressCurrent}/${primary.progressRequired} ${primary.progressNoun.toLowerCase()}.`,
    );
    if (primary.progressCurrent >= primary.progressRequired) {
      return completePrimary(
        { ...session, primary, timeline: timelineAfterTick, enemyTurnsSurvived },
        logLines,
      );
    }
  }

  let cargoStressTicks = session.cargoStressTicks;
  if (session.secondary.some((s) => s.kind === 'PROTECT_CARGO' && s.status === 'ACTIVE')) {
    cargoStressTicks += 1;
  }

  return {
    session: {
      ...session,
      primary,
      timeline: timelineAfterTick,
      enemyTurnsSurvived,
      cargoStressTicks,
    },
    primaryCompleted: false,
    primaryFailed: false,
    logLines,
    phaseAlert: null,
  };
}

export function progressObjectiveOnMarkedKill(
  session: EncounterObjectiveSession,
  unitId: string | undefined,
): ObjectiveProgressResult {
  const logLines: string[] = [];
  if (!session.primary || session.primary.status !== 'ACTIVE' || !unitId) {
    return {
      session,
      primaryCompleted: false,
      primaryFailed: false,
      logLines,
      phaseAlert: null,
    };
  }
  if (session.primary.winMode !== 'KILL_MARKED') {
    return {
      session,
      primaryCompleted: false,
      primaryFailed: false,
      logLines,
      phaseAlert: null,
    };
  }
  if (!session.primary.markedUnitIds.includes(unitId)) {
    return {
      session,
      primaryCompleted: false,
      primaryFailed: false,
      logLines,
      phaseAlert: null,
    };
  }

  const markedKills = session.markedKills + 1;
  const primary = {
    ...session.primary,
    progressCurrent: Math.min(session.primary.progressRequired, markedKills),
  };
  logLines.push(`>> OBJECTIVE — marked hostile eliminated (${primary.progressCurrent}/${primary.progressRequired}).`);
  if (primary.progressCurrent >= primary.progressRequired) {
    return completePrimary(
      { ...session, primary, markedKills },
      logLines,
    );
  }
  return {
    session: { ...session, primary, markedKills },
    primaryCompleted: false,
    primaryFailed: false,
    logLines,
    phaseAlert: null,
  };
}

export function progressObjectiveOnChannelInterrupt(
  session: EncounterObjectiveSession,
  intentType?: string,
): ObjectiveProgressResult {
  const logLines: string[] = [];
  let next = session;
  let channelsInterrupted = session.channelsInterrupted;
  let detonationsPrevented = session.detonationsPrevented;

  if (intentType === 'DETONATE') {
    detonationsPrevented += 1;
    const soft = next.secondary.map((s) => {
      if (s.kind !== 'PREVENT_DETONATION' || s.status !== 'ACTIVE') return s;
      const progressCurrent = Math.min(s.progressRequired, s.progressCurrent + 1);
      logLines.push(`>> SOFT OBJECTIVE — detonation interrupted (${progressCurrent}/${s.progressRequired}).`);
      return {
        ...s,
        progressCurrent,
        status: progressCurrent >= s.progressRequired ? 'COMPLETE' as const : s.status,
      };
    });
    next = { ...next, secondary: soft, detonationsPrevented };
  }

  if (!next.primary || next.primary.status !== 'ACTIVE') {
    return {
      session: next,
      primaryCompleted: false,
      primaryFailed: false,
      logLines,
      phaseAlert: null,
    };
  }

  if (next.primary.winMode !== 'INTERRUPT_CHANNEL') {
    return {
      session: next,
      primaryCompleted: false,
      primaryFailed: false,
      logLines,
      phaseAlert: null,
    };
  }

  if (intentType && intentType !== 'CHANNEL' && intentType !== 'DETONATE') {
    return {
      session: next,
      primaryCompleted: false,
      primaryFailed: false,
      logLines,
      phaseAlert: null,
    };
  }

  channelsInterrupted += 1;
  const primary = {
    ...next.primary,
    progressCurrent: Math.min(next.primary.progressRequired, channelsInterrupted),
  };
  logLines.push(
    `>> OBJECTIVE — ritual channel broken (${primary.progressCurrent}/${primary.progressRequired}).`,
  );
  if (primary.progressCurrent >= primary.progressRequired) {
    return completePrimary(
      { ...next, primary, channelsInterrupted, detonationsPrevented },
      logLines,
    );
  }
  return {
    session: { ...next, primary, channelsInterrupted, detonationsPrevented },
    primaryCompleted: false,
    primaryFailed: false,
    logLines,
    phaseAlert: null,
  };
}

export function progressObjectiveOnSquadCleared(
  session: EncounterObjectiveSession,
): ObjectiveProgressResult {
  const logLines: string[] = [];
  if (!session.primary || session.primary.status !== 'ACTIVE') {
    return {
      session,
      primaryCompleted: false,
      primaryFailed: false,
      logLines,
      phaseAlert: null,
    };
  }
  if (
    session.primary.winMode !== 'CLEAR_ALL'
    && session.primary.winMode !== 'BREAK_LINK'
  ) {
    return {
      session,
      primaryCompleted: false,
      primaryFailed: false,
      logLines,
      phaseAlert: null,
    };
  }
  const primary = {
    ...session.primary,
    progressCurrent: session.primary.progressRequired,
  };
  return completePrimary({ ...session, primary }, logLines);
}

export function formatObjectiveHudLine(session: EncounterObjectiveSession): string | null {
  const primary = session.primary;
  if (!primary || primary.status === 'ABANDONED') return null;
  const status =
    primary.status === 'COMPLETE' ? 'SECURED'
      : primary.status === 'FAILED' ? 'FAILED'
        : `${primary.progressCurrent}/${primary.progressRequired}`;
  return `${primary.label} — ${status}`;
}

export function formatObjectiveBriefing(session: EncounterObjectiveSession): string[] {
  const lines: string[] = [];
  if (session.primary) {
    lines.push(`>> OBJECTIVE — ${session.primary.label}`);
    lines.push(`>> ${session.primary.brief}`);
    if (session.primary.markedUnitIds.length > 0) {
      lines.push(`>> MARKED HOSTILES: ${session.primary.markedUnitIds.length}`);
    }
  }
  for (const soft of session.secondary) {
    lines.push(`>> SOFT OBJECTIVE — ${soft.label}: ${soft.brief}`);
  }
  for (const ev of session.timeline) {
    const tag = ev.previewOnly ? 'preview' : 'T';
    lines.push(`>> TIMELINE — ${ev.label} [${tag}-${ev.turnsRemaining}]`);
  }
  return lines;
}

export function getIncomingDamageMitigationFromStamp(
  stamp: EncounterObjectiveStamp | null | undefined,
): number {
  return stamp?.incomingDamageMitigationPct ?? 0;
}

export function describeObjectiveSource(source: EncounterObjectiveSource): string {
  return source.replace(/_/g, ' ');
}
