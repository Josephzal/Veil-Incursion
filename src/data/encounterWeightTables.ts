import type { DistrictId } from './districtPacing';
import type { EnemyRosterId } from './enemyRoster';

/** Curated spawn weights by district + local depth (1–15 within each district). */
const D1_WEIGHTS: Record<number, Partial<Record<EnemyRosterId, number>>> = {
  1: { 'miasma-tick-swarm': 3, 'fracture-hound': 2, 'concrete-gargoyle': 1 },
  2: { 'miasma-tick-swarm': 2, 'fracture-hound': 3, 'ash-weeper': 2 },
  3: { 'concrete-gargoyle': 2, 'gutter-goliath': 2, 'fracture-hound': 2 },
  4: { 'concrete-gargoyle': 3, 'echoing-brute': 2, 'ley-siren': 1 },
  5: { 'gutter-goliath': 3, 'echoing-brute': 2, 'ash-weeper': 2 },
  6: { 'gutter-goliath': 2, 'concrete-gargoyle': 2, 'ley-siren': 2, 'null-shade': 1 },
  7: { 'echoing-brute': 2, 'ley-siren': 3, 'null-shade': 2 },
  8: { 'echoing-brute': 3, 'spatial-glitch': 2, 'ley-siren': 2 },
  9: { 'spatial-glitch': 3, 'null-shade': 2, 'gutter-goliath': 2 },
  10: { 'spatial-glitch': 2, 'gutter-goliath': 3, 'null-shade': 2 },
  11: { 'gutter-goliath': 3, 'null-shade': 2, 'spatial-glitch': 2 },
  12: { 'spatial-glitch': 3, 'gutter-goliath': 3, 'ley-siren': 2 },
  13: { 'ley-siren': 3, 'null-shade': 3, 'spatial-glitch': 2 },
  14: { 'spatial-glitch': 3, 'gutter-goliath': 3, 'null-shade': 3 },
  15: { 'spatial-glitch': 4, 'gutter-goliath': 3, 'null-shade': 3 },
};

const D2_WEIGHTS: Record<number, Partial<Record<EnemyRosterId, number>>> = {
  1: { 'ley-siren': 3, 'echoing-brute': 2, 'spatial-glitch': 1 },
  2: { 'ley-siren': 2, 'ash-weeper': 3, 'spatial-glitch': 2 },
  3: { 'spatial-glitch': 2, 'gutter-goliath': 2, 'null-shade': 2 },
  4: { 'spatial-glitch': 3, 'gutter-goliath': 3, 'ley-siren': 2 },
  5: { 'gutter-goliath': 3, 'concrete-gargoyle': 2, 'null-shade': 2 },
  6: { 'concrete-gargoyle': 2, 'null-shade': 3, 'echoing-brute': 2 },
  7: { 'null-shade': 3, 'spatial-glitch': 3, 'ley-siren': 2 },
  8: { 'spatial-glitch': 3, 'gutter-goliath': 2, 'null-shade': 3 },
  9: { 'gutter-goliath': 3, 'spatial-glitch': 3, 'concrete-gargoyle': 2 },
  10: { 'spatial-glitch': 3, 'null-shade': 3, 'gutter-goliath': 2 },
  11: { 'null-shade': 3, 'spatial-glitch': 3, 'ley-siren': 2 },
  12: { 'spatial-glitch': 3, 'gutter-goliath': 3, 'null-shade': 3 },
  13: { 'ley-siren': 3, 'null-shade': 3, 'spatial-glitch': 3 },
  14: { 'gutter-goliath': 3, 'spatial-glitch': 3, 'concrete-gargoyle': 2 },
  15: { 'spatial-glitch': 4, 'null-shade': 3, 'gutter-goliath': 3 },
};

const D3_WEIGHTS: Record<number, Partial<Record<EnemyRosterId, number>>> = {
  1: { 'spatial-glitch': 3, 'null-shade': 3, 'gutter-goliath': 2 },
  2: { 'spatial-glitch': 3, 'gutter-goliath': 3, 'concrete-gargoyle': 2 },
  3: { 'gutter-goliath': 3, 'concrete-gargoyle': 3, 'null-shade': 2 },
  4: { 'concrete-gargoyle': 3, 'spatial-glitch': 3, 'ley-siren': 2 },
  5: { 'concrete-gargoyle': 3, 'gutter-goliath': 3, 'ley-siren': 3 },
  6: { 'gutter-goliath': 3, 'ley-siren': 3, 'spatial-glitch': 3 },
  7: { 'ley-siren': 3, 'spatial-glitch': 3, 'null-shade': 3 },
  8: { 'spatial-glitch': 4, 'null-shade': 3, 'gutter-goliath': 3 },
  9: { 'gutter-goliath': 4, 'concrete-gargoyle': 3, 'spatial-glitch': 3 },
  10: { 'spatial-glitch': 4, 'gutter-goliath': 4, 'null-shade': 3 },
  11: { 'gutter-goliath': 4, 'spatial-glitch': 4, 'null-shade': 3 },
  12: { 'spatial-glitch': 4, 'null-shade': 4, 'gutter-goliath': 3 },
  13: { 'null-shade': 4, 'spatial-glitch': 4, 'ley-siren': 3 },
  14: { 'spatial-glitch': 4, 'gutter-goliath': 4, 'concrete-gargoyle': 3 },
  15: { 'spatial-glitch': 5, 'gutter-goliath': 4, 'null-shade': 4 },
};

export function encounterWeightsForDepth(
  district: DistrictId,
  localDepth: number,
): Partial<Record<EnemyRosterId, number>> | null {
  const clamped = Math.min(15, Math.max(1, localDepth));
  if (district === 1) return D1_WEIGHTS[clamped] ?? null;
  if (district === 2) return D2_WEIGHTS[clamped] ?? null;
  return D3_WEIGHTS[clamped] ?? null;
}
