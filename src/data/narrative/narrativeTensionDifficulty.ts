/**
 * Shared narrative tension difficulty (Phase 5).
 * Universal — never class/Cabal biased.
 */

export type NarrativeTensionDifficulty = 'LOW' | 'MEDIUM' | 'HIGH' | 'APEX';

/**
 * Map run depth (1–3 district / procedural depth) to tension difficulty.
 * Defaults to MEDIUM when unknown.
 */
export function tensionDifficultyFromDepth(
  depth: number | null | undefined,
): NarrativeTensionDifficulty {
  if (depth == null || !Number.isFinite(depth)) return 'MEDIUM';
  if (depth <= 1) return 'LOW';
  if (depth === 2) return 'MEDIUM';
  if (depth === 3) return 'HIGH';
  return 'APEX';
}

/** Approximate from nodes cleared when only that is available. */
export function tensionDifficultyFromNodesCleared(
  nodesCleared: number | null | undefined,
): NarrativeTensionDifficulty {
  if (nodesCleared == null || !Number.isFinite(nodesCleared)) return 'MEDIUM';
  if (nodesCleared < 5) return 'LOW';
  if (nodesCleared < 12) return 'MEDIUM';
  if (nodesCleared < 20) return 'HIGH';
  return 'APEX';
}

/**
 * Routing audit map (v1) — fiction → mechanic.
 *
 * Cipher Rite: encrypted, terminal, locked cache, intel vault, black-site, grid security
 * Scanner Sweep: 1D blind-zone tracking on a signal lane; sweep pulses disrupt the mask window
 * Ritual Echo: sigil, ritual, occult pattern, echo pattern, glyph lock, blood-rite
 * Veil Lock (Mechanic_SignalAlignment): limited rotatable glyph keys slotted into rings outer→core
 * ScavengeBar: legacy / DevTest only — never normal generation
 * No mechanic: plain stash, dead runner, loose credits, simple resource pickup
 */
export const NARRATIVE_TENSION_ROUTING_AUDIT = {
  CipherRite: 'Mechanic_CipherRite',
  ScannerSweep: 'Mechanic_ConcealSlider',
  RitualEcho: 'Mechanic_SigilTrace',
  SignalAlignment: 'Mechanic_SignalAlignment',
  ScavengeBarDeprecated: 'Mechanic_ScavengeBar',
} as const;
