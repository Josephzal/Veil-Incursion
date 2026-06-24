import type { FactionType } from '../types/game';
import type { EnemyRosterId } from '../data/enemyRoster';
import { ENEMY_ROSTER, factionForDistrict } from '../data/enemyRoster';

export const FACTION_STRIKE_TINT: Record<FactionType, string> = {
  LEGION: '#a78bfa',
  SOLARIS: '#fbbf24',
  TERRAN_GRID: '#d1d5db',
};

export function factionStrikeTint(faction: FactionType): string {
  return FACTION_STRIKE_TINT[faction];
}

export function factionStrikeTintForRosterId(
  rosterId: string | undefined,
  district: 1 | 2 | 3 = 1,
): string {
  if (rosterId) {
    const entry = ENEMY_ROSTER[rosterId as EnemyRosterId];
    if (entry) return FACTION_STRIKE_TINT[entry.faction];
  }
  return FACTION_STRIKE_TINT[factionForDistrict(district)];
}
