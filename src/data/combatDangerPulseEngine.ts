/**
 * Combat Refactor Phase 5 — start-of-turn highest-danger pulse.
 */

import type { EnemyCombatProfile } from '../types/run';
import type { EncounterObjectiveSession } from '../types/encounterObjective';
import { getIntentCatalogEntry, isHighOrCriticalIntent } from './enemyIntentCatalog';
import { buildCombatJuiceEvent } from './combatJuiceFeedbackEngine';
import type { CombatJuiceFeedbackEvent } from '../types/combatJuiceFeedback';

export interface DangerPulseResult {
  message: string | null;
  juiceEvent: CombatJuiceFeedbackEvent | null;
}

/**
 * Pick a single high-severity warning for the start of the player turn.
 * Does not spam LOW/MEDIUM telegraphs.
 */
export function resolveStartOfTurnDangerPulse(
  squad: readonly EnemyCombatProfile[],
  objectiveSession?: EncounterObjectiveSession | null,
): DangerPulseResult {
  const alive = squad.filter((u) => (u.currentHp ?? 0) > 0);

  // Critical / High intents first (telegraphs with ≤1 turn feel most urgent).
  type Candidate = { priority: number; message: string };
  const candidates: Candidate[] = [];

  for (const u of alive) {
    const meta = getIntentCatalogEntry(u.intent);
    if (!isHighOrCriticalIntent(u.intent) && meta.severity !== 'HIGH' && meta.severity !== 'CRITICAL') {
      continue;
    }
    const turns = meta.isTelegraph
      ? Math.max(1, meta.telegraphTurns ?? 1)
      : 1;
    if (meta.severity === 'CRITICAL') {
      candidates.push({
        priority: 100 - turns,
        message: `Critical: ${u.designation} ${meta.type.replace(/_/g, ' ')} resolves in ${turns} turn${turns === 1 ? '' : 's'}.`,
      });
    } else if (meta.type === 'LOCK_ON') {
      candidates.push({
        priority: 90 - turns,
        message: `Critical: ${u.designation} Lock-On resolves next enemy turn.`,
      });
    } else if (meta.type === 'CHANNEL' || meta.type === 'DETONATE') {
      candidates.push({
        priority: 88 - turns,
        message: `Ritual completes in ${turns} turn${turns === 1 ? '' : 's'}.`,
      });
    } else if (meta.severity === 'HIGH' && turns <= 1) {
      candidates.push({
        priority: 70,
        message: `Warning: ${u.designation} ${meta.type.replace(/_/g, ' ')} imminent.`,
      });
    }
  }

  const primary = objectiveSession?.primary;
  if (primary && primary.status === 'ACTIVE' && primary.winMode === 'SURVIVE_TURNS') {
    const remain = Math.max(0, primary.progressRequired - primary.progressCurrent);
    if (remain > 0 && remain <= 2) {
      candidates.push({
        priority: 85 - remain,
        message: `Extraction window closes in ${remain} turn${remain === 1 ? '' : 's'}.`,
      });
    }
  }

  for (const ev of objectiveSession?.timeline ?? []) {
    if (ev.previewOnly) continue;
    if (ev.turnsRemaining <= 2) {
      if (ev.kind === 'CARGO_STRESS') {
        candidates.push({
          priority: 75,
          message: 'Cargo is under stress — keep pressure off the hold.',
        });
      } else if (ev.kind === 'ANCHOR_PULSE') {
        candidates.push({
          priority: 80,
          message: `Anchor pulse charging (${ev.turnsRemaining}).`,
        });
      } else if (ev.kind === 'ECHO_SURGE') {
        candidates.push({
          priority: 78,
          message: `Echo surge in ${ev.turnsRemaining} turn${ev.turnsRemaining === 1 ? '' : 's'}.`,
        });
      } else if (ev.kind === 'RITUAL_CHANNEL') {
        candidates.push({
          priority: 86,
          message: `Ritual channel — ${ev.turnsRemaining} turn${ev.turnsRemaining === 1 ? '' : 's'} remaining.`,
        });
      }
    }
  }

  if (candidates.length === 0) {
    return { message: null, juiceEvent: null };
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const top = candidates[0]!;
  return {
    message: top.message,
    juiceEvent: buildCombatJuiceEvent('DANGER_PULSE', {
      text: top.message,
      intensity: top.priority >= 90 ? 'HIGH' : 'MEDIUM',
    }),
  };
}
