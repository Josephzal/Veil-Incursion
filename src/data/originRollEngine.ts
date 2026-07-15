import type { EncounterOrigin, EncounterSquadTier } from '../types/encounterSpawn';
import { ORIGIN_WEIGHTS } from '../types/encounterSpawn';
import { seededRandom } from './encounterGenerator';

const RIVAL_STREAK_DAMPING = 0.25;

/** Per-node RIVAL_MERC vs VEIL roll (Echo excluded — node override only). */
export function rollEncounterOrigin(
  depth: 1 | 2 | 3,
  tier: EncounterSquadTier,
  seed: string,
  lastOrigin?: EncounterOrigin | null,
  rivalMercWeightMultiplier = 1,
): EncounterOrigin {
  const base = ORIGIN_WEIGHTS[depth][tier];
  let rivalWeight = base.RIVAL_MERC * Math.max(0, rivalMercWeightMultiplier);
  if (lastOrigin === 'RIVAL_MERC') {
    rivalWeight *= RIVAL_STREAK_DAMPING;
  }
  const total = rivalWeight + base.VEIL;
  const rand = seededRandom(`${seed}:origin:${depth}:${tier}:${lastOrigin ?? 'none'}`);
  return rand() < rivalWeight / total ? 'RIVAL_MERC' : 'VEIL';
}

export function originRollPreview(
  depth: 1 | 2 | 3,
  tier: EncounterSquadTier,
  lastOrigin?: EncounterOrigin | null,
  rivalMercWeightMultiplier = 1,
): { rivalPct: number; veilPct: number } {
  const base = ORIGIN_WEIGHTS[depth][tier];
  let rivalWeight = base.RIVAL_MERC * Math.max(0, rivalMercWeightMultiplier);
  if (lastOrigin === 'RIVAL_MERC') {
    rivalWeight *= RIVAL_STREAK_DAMPING;
  }
  const total = rivalWeight + base.VEIL;
  return {
    rivalPct: Math.round((rivalWeight / total) * 100),
    veilPct: Math.round((base.VEIL / total) * 100),
  };
}
