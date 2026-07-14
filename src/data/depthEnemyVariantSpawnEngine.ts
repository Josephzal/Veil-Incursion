import type { EnemyCombatProfile } from '../types/run';
import type { NodeContextModifiers } from '../types/worldState';
import { ENEMY_ROSTER } from './enemyRoster';
import { spawnRosterUnit } from './enemyRoster';
import { ANCHOR_HUSK_INJECT_CHANCE } from './depthEnemyVariantCatalog';
import { seededRandom } from './encounterGenerator';

function isAnchorOrOperationNode(contextModifiers?: NodeContextModifiers | null): boolean {
  if (!contextModifiers) return false;
  return contextModifiers.anchorSignal === true || contextModifiers.operationTag != null;
}

/**
 * Prefer Anchor Husk on Anchor Signal / Operation Target combat nodes (Depth 2–3).
 * Replaces one living non-boss unit when the roll hits and no husk is already present.
 */
export function maybeInjectAnchorHusk(
  squad: EnemyCombatProfile[],
  options: {
    nodeIndex: number;
    district: 1 | 2 | 3;
    encounterSeed?: string;
    contextModifiers?: NodeContextModifiers | null;
    isElite?: boolean;
    resonancePercent?: number;
  },
): EnemyCombatProfile[] {
  if (options.district < 2) return squad;
  if (!isAnchorOrOperationNode(options.contextModifiers)) return squad;
  if (squad.some((unit) => unit.rosterId === 'anchor-husk')) return squad;
  if (squad.length === 0) return squad;

  const rand = seededRandom(
    `${options.encounterSeed ?? 'seed'}:anchor-husk:${options.nodeIndex}:${options.district}`,
  );
  if (rand() > ANCHOR_HUSK_INJECT_CHANCE) return squad;

  const candidates = squad
    .map((unit, index) => ({ unit, index }))
    .filter(({ unit }) => unit.currentHp > 0 && !unit.isBoss && unit.rosterId !== 'amalgam' && unit.rosterId !== 'core-sick-amalgam');
  if (candidates.length === 0) return squad;

  const pick = candidates[Math.floor(rand() * candidates.length)]!;
  const husk = spawnRosterUnit(ENEMY_ROSTER['anchor-husk'], options.nodeIndex, {
    resonancePercent: options.resonancePercent,
    forcedElite: options.isElite === true,
    district: options.district,
  });

  const next = [...squad];
  next[pick.index] = {
    ...husk,
    unitId: pick.unit.unitId ?? husk.unitId,
    gridSlot: pick.unit.gridSlot,
    occupiedSlots: pick.unit.occupiedSlots,
    gridWidth: 1,
  };
  return next;
}

export function prefersAnchorNodeTier(
  contextModifiers?: NodeContextModifiers | null,
): boolean {
  return isAnchorOrOperationNode(contextModifiers);
}
