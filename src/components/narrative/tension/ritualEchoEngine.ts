/**
 * Ritual Echo — sequence generation with forbidden beats for Mechanic_SigilTrace.
 */

import { hashSeed } from '../../../data/narrative/narrativeAssemblyCore';

export type RitualEchoDifficulty = 'LOW' | 'MEDIUM' | 'HIGH' | 'APEX';

export interface RitualBeat {
  nodeId: number;
  forbidden: boolean;
}

export interface RitualEchoSequence {
  difficulty: RitualEchoDifficulty;
  /** Full playback sequence (includes forbidden beats). */
  playback: readonly RitualBeat[];
  /** Expected player taps (forbidden beats excluded). */
  expectedInput: readonly number[];
  playbackStepMs: number;
  nodeFlashMs: number;
}

interface DifficultyTune {
  length: number;
  forbiddenCount: number;
  playbackStepMs: number;
  nodeFlashMs: number;
}

const TUNING: Record<RitualEchoDifficulty, DifficultyTune> = {
  LOW: { length: 3, forbiddenCount: 0, playbackStepMs: 480, nodeFlashMs: 360 },
  MEDIUM: { length: 4, forbiddenCount: 1, playbackStepMs: 420, nodeFlashMs: 320 },
  HIGH: { length: 5, forbiddenCount: 1, playbackStepMs: 380, nodeFlashMs: 300 },
  APEX: { length: 6, forbiddenCount: 2, playbackStepMs: 340, nodeFlashMs: 280 },
};

const NODE_COUNT = 9;

export function generateRitualEchoSequence(
  difficulty: RitualEchoDifficulty = 'MEDIUM',
  seed = 'ritual-echo:default',
  nodeCount = NODE_COUNT,
): RitualEchoSequence {
  const tune = TUNING[difficulty];
  const forbiddenBudget = Math.min(tune.forbiddenCount, Math.max(0, tune.length - 1));

  const playback: RitualBeat[] = [];
  for (let i = 0; i < tune.length; i += 1) {
    const nodeId = hashSeed(`${seed}:node:${i}`) % nodeCount;
    playback.push({ nodeId, forbidden: false });
  }

  // Place forbidden beats on distinct indices (prefer middle slots).
  const slotOrder = shuffleIndices(tune.length, `${seed}:forbid-slots`);
  let placed = 0;
  for (const slot of slotOrder) {
    if (placed >= forbiddenBudget) break;
    // Avoid making the first beat forbidden on LOW/MEDIUM for readability.
    if (slot === 0 && difficulty !== 'APEX' && forbiddenBudget < tune.length) continue;
    const beat = playback[slot];
    if (!beat || beat.forbidden) continue;
    playback[slot] = { ...beat, forbidden: true };
    placed += 1;
  }

  // If LOW rolled 0 forbidden sometimes upgrade to 1 via seed (50%).
  if (difficulty === 'LOW' && placed === 0 && hashSeed(`${seed}:low-forbid`) % 2 === 0 && tune.length >= 2) {
    const slot = 1 + (hashSeed(`${seed}:low-slot`) % (tune.length - 1));
    const beat = playback[slot];
    if (beat) playback[slot] = { ...beat, forbidden: true };
  }

  const expectedInput = playback.filter((b) => !b.forbidden).map((b) => b.nodeId);

  return {
    difficulty,
    playback,
    expectedInput,
    playbackStepMs: tune.playbackStepMs,
    nodeFlashMs: tune.nodeFlashMs,
  };
}

function shuffleIndices(length: number, seed: string): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = hashSeed(`${seed}:swap:${i}`) % (i + 1);
    const tmp = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = tmp;
  }
  return indices;
}

export function ritualDifficultyFromDepth(depth: number | null | undefined): RitualEchoDifficulty {
  if (depth == null || !Number.isFinite(depth)) return 'MEDIUM';
  if (depth <= 1) return 'LOW';
  if (depth === 2) return 'MEDIUM';
  if (depth === 3) return 'HIGH';
  return 'APEX';
}
