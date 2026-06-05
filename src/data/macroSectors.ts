import { MacroSectorDefinition } from '../types/regional';
import { WORLD_SECTOR_GEOMETRY } from './worldMapGeometry';

export const MACRO_SECTORS: MacroSectorDefinition[] = [
  {
    id: 'PACIFIC',
    label: 'PACIFIC',
    metropolitanNode: 'SEATTLE CORE',
    baseTrafficDensity: 34,
    influence: { TERRAN_GRID: 42, LEGION: 31, SOLARIS: 27 },
    mapGeometry: WORLD_SECTOR_GEOMETRY.PACIFIC,
  },
  {
    id: 'MOUNTAIN',
    label: 'MOUNTAIN',
    metropolitanNode: 'DENVER SPIRE',
    baseTrafficDensity: 58,
    influence: { TERRAN_GRID: 28, LEGION: 44, SOLARIS: 28 },
    mapGeometry: WORLD_SECTOR_GEOMETRY.MOUNTAIN,
  },
  {
    id: 'CENTRAL',
    label: 'CENTRAL',
    metropolitanNode: 'CHICAGO NEXUS',
    baseTrafficDensity: 72,
    influence: { TERRAN_GRID: 38, LEGION: 22, SOLARIS: 40 },
    mapGeometry: WORLD_SECTOR_GEOMETRY.CENTRAL,
  },
  {
    id: 'ATLANTIC',
    label: 'ATLANTIC',
    metropolitanNode: 'NYC GRIDLOCK',
    baseTrafficDensity: 81,
    influence: { TERRAN_GRID: 45, LEGION: 30, SOLARIS: 25 },
    mapGeometry: WORLD_SECTOR_GEOMETRY.ATLANTIC,
  },
  {
    id: 'THE_ARCHIPELAGO',
    label: 'THE ARCHIPELAGO',
    metropolitanNode: 'MIAMI VOID-PORT',
    baseTrafficDensity: 47,
    influence: { TERRAN_GRID: 20, LEGION: 35, SOLARIS: 45 },
    mapGeometry: WORLD_SECTOR_GEOMETRY.THE_ARCHIPELAGO,
  },
];

export function getMacroSector(id: string): MacroSectorDefinition {
  return MACRO_SECTORS.find((s) => s.id === id) ?? MACRO_SECTORS[0];
}

export function regionalCoatingSlotId(sectorId: string, faction: string): string {
  return `coating-${sectorId.toLowerCase()}-${faction.toLowerCase()}`;
}

export function regionalCoatingLabel(sectorLabel: string, faction: string): string {
  return `${sectorLabel} ${faction.replace('_', ' ')} WEAPON COATING`;
}
