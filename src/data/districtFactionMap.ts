import type { FactionType } from '../types/game';

export function factionForDistrict(district: 1 | 2 | 3): FactionType {
  if (district === 1) return 'TERRAN_GRID';
  if (district === 2) return 'SOLARIS';
  return 'LEGION';
}
