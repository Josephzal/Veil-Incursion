/**
 * Combat Telegraph Language — Phase 1.
 * Arena intent glyphs derived from Intent 2.0 catalog.
 * Primary combat truth lives on the arena; side intel remains secondary.
 */

import type { EnemyIntent } from '../types/run';
import type {
  EnemyIntentSeverity,
  EnemyIntentType,
} from '../types/enemyIntentMeta';
import {
  getIntentCatalogEntry,
  getIntentSeverity,
  getIntentType,
  isTelegraphIntent,
  severityColor,
} from './enemyIntentCatalog';

/** Compact arena glyph family — maps Intent 2.0 types onto readable symbols. */
export type ArenaIntentGlyphKind =
  | 'ATTACK'
  | 'HEAVY'
  | 'LOCK_ON'
  | 'CHANNEL'
  | 'GUARD'
  | 'SUPPORT'
  | 'DEBUFF'
  | 'SUMMON'
  | 'DETONATE'
  | 'REPOSITION'
  | 'CARGO'
  | 'JAMMED'
  | 'UNKNOWN';

export interface ArenaIntentGlyph {
  kind: ArenaIntentGlyphKind;
  /** Single-character / short symbol for the badge. */
  symbol: string;
  /** Short label for optional accessibility / expand later. */
  label: string;
  severity: EnemyIntentSeverity;
  intentType: EnemyIntentType;
  /** Telegraph countdown remaining (0 = no badge). */
  turnsRemaining: number;
  /** True when the intent is a wind-up / charge telegraph. */
  isTelegraph: boolean;
  /** Display for countdown chip — e.g. T-1 or CHARGE 1. */
  countdownLabel: string | null;
  accentColor: string;
  /** Danger volume for pulse (1 = imminent, 2 = notable, 3 = calm). */
  arenaPriority: 1 | 2 | 3;
}

function glyphKindForType(type: EnemyIntentType): ArenaIntentGlyphKind {
  switch (type) {
    case 'BASIC_ATTACK':
      return 'ATTACK';
    case 'HEAVY_ATTACK':
    case 'CONSUME':
      return 'HEAVY';
    case 'LOCK_ON':
    case 'MARK':
      return 'LOCK_ON';
    case 'CHANNEL':
    case 'RITUAL':
      return 'CHANNEL';
    case 'GUARD':
      return 'GUARD';
    case 'BUFF':
    case 'SUPPORT_LINK':
      return 'SUPPORT';
    case 'DEBUFF':
      return 'DEBUFF';
    case 'SUMMON':
      return 'SUMMON';
    case 'DETONATE':
      return 'DETONATE';
    case 'REPOSITION':
      return 'REPOSITION';
    case 'CARGO_THREAT':
      return 'CARGO';
    default:
      return 'UNKNOWN';
  }
}

/** Terminal-safe symbols — ASCII / box drawing so every platform renders cleanly. */
function symbolForKind(kind: ArenaIntentGlyphKind): string {
  switch (kind) {
    case 'ATTACK':
      return '>';
    case 'HEAVY':
      return '*';
    case 'LOCK_ON':
      return 'o';
    case 'CHANNEL':
      return '+';
    case 'GUARD':
      return '#';
    case 'SUPPORT':
      return '=';
    case 'DEBUFF':
      return 'x';
    case 'SUMMON':
      return '^';
    case 'DETONATE':
      return '!';
    case 'REPOSITION':
      return '~';
    case 'CARGO':
      return '%';
    case 'JAMMED':
      return '?';
    case 'UNKNOWN':
    default:
      return '.';
  }
}

function shortLabelForKind(kind: ArenaIntentGlyphKind): string {
  switch (kind) {
    case 'ATTACK':
      return 'STRIKE';
    case 'HEAVY':
      return 'HEAVY';
    case 'LOCK_ON':
      return 'LOCK';
    case 'CHANNEL':
      return 'CHN';
    case 'GUARD':
      return 'DEF';
    case 'SUPPORT':
      return 'SUP';
    case 'DEBUFF':
      return 'DBF';
    case 'SUMMON':
      return 'SUM';
    case 'DETONATE':
      return 'EXP';
    case 'REPOSITION':
      return 'MOV';
    case 'CARGO':
      return 'CRG';
    case 'JAMMED':
      return 'JAM';
    default:
      return '???';
  }
}

function arenaPriorityFor(
  severity: EnemyIntentSeverity,
  isTelegraph: boolean,
  turnsRemaining: number,
): 1 | 2 | 3 {
  if (severity === 'CRITICAL' || (isTelegraph && turnsRemaining > 0 && severity === 'HIGH')) {
    return 1;
  }
  if (severity === 'HIGH' || isTelegraph || turnsRemaining > 0) {
    return 2;
  }
  return 3;
}

function formatCountdownLabel(args: {
  intent: EnemyIntent;
  turnsRemaining: number;
  kind: ArenaIntentGlyphKind;
}): string | null {
  const { intent, turnsRemaining, kind } = args;
  if (turnsRemaining <= 0) return null;
  // Compact arena grammar — CH-N mirrors T-N, stays readable in dense slots.
  if (intent === 'CHARGE' || kind === 'HEAVY' || kind === 'DETONATE') {
    return `CH-${turnsRemaining}`;
  }
  return `T-${turnsRemaining}`;
}

/** Arena palette — danger crimson, steel/cool for calmer intents (avoid yellow dominance). */
export function arenaSeverityAccent(severity: EnemyIntentSeverity): string {
  switch (severity) {
    case 'LOW':
      return '#94a3b8';
    case 'MODERATE':
      return '#fca5a5';
    case 'HIGH':
      return '#f87171';
    case 'CRITICAL':
      return '#ef4444';
    default:
      return severityColor(severity);
  }
}

export function resolveArenaIntentGlyph(args: {
  intent: EnemyIntent;
  turnsRemaining?: number;
  jammed?: boolean;
}): ArenaIntentGlyph {
  if (args.jammed) {
    return {
      kind: 'JAMMED',
      symbol: symbolForKind('JAMMED'),
      label: 'JAM',
      severity: 'MODERATE',
      intentType: 'DEBUFF',
      turnsRemaining: 0,
      isTelegraph: false,
      countdownLabel: null,
      accentColor: '#64748b',
      arenaPriority: 3,
    };
  }

  const entry = getIntentCatalogEntry(args.intent);
  const intentType = getIntentType(args.intent);
  const severity = getIntentSeverity(args.intent);
  const kind = glyphKindForType(intentType);
  const isTelegraph = isTelegraphIntent(args.intent) || entry.isTelegraph === true;
  const turnsRemaining = Math.max(0, args.turnsRemaining ?? 0);
  const accent = arenaSeverityAccent(severity);

  return {
    kind,
    symbol: symbolForKind(kind),
    label: shortLabelForKind(kind),
    severity,
    intentType,
    turnsRemaining,
    isTelegraph,
    countdownLabel: formatCountdownLabel({
      intent: args.intent,
      turnsRemaining,
      kind,
    }),
    accentColor: accent,
    arenaPriority: arenaPriorityFor(severity, isTelegraph, turnsRemaining),
  };
}
