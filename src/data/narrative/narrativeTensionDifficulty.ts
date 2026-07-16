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
 * Ley Circuit Breach: encrypted, terminal, locked cache, intel vault, black-site, hack, grid security
 *   (6×6 polarity routing puzzle — the in-game hacking minigame)
 * Shadowline Ascent (Mechanic_ShadowlineAscent): stealth, conceal, patrol, surveillance, militarized
 *   (turn-based 3-lane × 9-step detection shaft — the in-game stealth minigame)
 * Rite of Concordance (Mechanic_RiteOfConcordance): sigil, ritual, occult pattern, echo pattern, glyph lock, blood-rite
 *   (three-thread ritual waveform cleanse — the in-game ritual minigame)
 * Sigil Tumbler (Mechanic_SigilTumbler): occult-tech lockpick — resonance angle + rhythm tumbler timing
 *   (rift / ley / stabilize / extraction vector / lock fiction — the in-game lockpick minigame)
 * Ritual Echo (Mechanic_SigilTrace): DEPRECATED in-game — DevTest + legacy only (remapped to Rite of Concordance)
 * Cipher Rite: DEPRECATED in-game — DevTest force + legacy nodes only (remapped to Ley Circuit Breach)
 * Veil Lock (Mechanic_SignalAlignment): DEPRECATED in-game — DevTest + legacy only (remapped to Sigil Tumbler)
 * Scanner Sweep (Mechanic_ConcealSlider): DEPRECATED in-game — DevTest + legacy only (remapped to Shadowline Ascent)
 * ScavengeBar: legacy / DevTest only — never normal generation
 * No mechanic: plain stash, dead runner, loose credits, simple resource pickup
 */
export const NARRATIVE_TENSION_ROUTING_AUDIT = {
  LeyCircuitBreach: 'Mechanic_LeyCircuitBreach',
  ShadowlineAscent: 'Mechanic_ShadowlineAscent',
  RiteOfConcordance: 'Mechanic_RiteOfConcordance',
  SigilTumbler: 'Mechanic_SigilTumbler',
  RitualEchoDeprecated: 'Mechanic_SigilTrace',
  ScannerSweepDeprecated: 'Mechanic_ConcealSlider',
  CipherRiteDeprecated: 'Mechanic_CipherRite',
  SignalAlignmentDeprecated: 'Mechanic_SignalAlignment',
  ScavengeBarDeprecated: 'Mechanic_ScavengeBar',
} as const;
