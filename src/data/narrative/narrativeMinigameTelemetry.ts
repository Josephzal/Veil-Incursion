/**
 * Lightweight narrative minigame debug telemetry (Phase 5).
 * Dev-oriented console hooks only — no analytics backend, no PII.
 */

import type { TensionMechanic } from '../../types/narrativeAssembly';
import type { NarrativeTensionDifficulty } from './narrativeTensionDifficulty';

export interface NarrativeMinigameStartEvent {
  mechanicId: string;
  difficulty?: NarrativeTensionDifficulty | string;
  narrativeEventId?: string;
  depth?: number;
}

export interface NarrativeMinigameCompletedEvent {
  mechanicId: string;
  difficulty?: NarrativeTensionDifficulty | string;
  success: boolean;
  attemptsUsed?: number;
  timeElapsedMs?: number;
  narrativeEventId?: string;
}

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

export function logNarrativeMinigameStarted(event: NarrativeMinigameStartEvent): void {
  if (!isDev) return;
  console.info('[narrative_minigame_started]', event);
}

export function logNarrativeMinigameCompleted(event: NarrativeMinigameCompletedEvent): void {
  if (!isDev) return;
  console.info('[narrative_minigame_completed]', event);
}

export function logNarrativeMinigameUnknownId(
  mechanicId: string,
  narrativeEventId?: string,
): void {
  console.error('[narrative_minigame_unknown_id]', { mechanicId, narrativeEventId });
}

export function isV1NarrativeMechanic(id: TensionMechanic | string | null | undefined): boolean {
  return (
    id === 'Mechanic_CipherRite'
    || id === 'Mechanic_LeyCircuitBreach'
    || id === 'Mechanic_ConcealSlider'
    || id === 'Mechanic_ShadowlineAscent'
    || id === 'Mechanic_SigilTrace'
    || id === 'Mechanic_RiteOfConcordance'
    || id === 'Mechanic_SignalAlignment'
    || id === 'Mechanic_SigilTumbler'
    || id === 'Mechanic_ScavengeBar'
  );
}
