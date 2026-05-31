import { MacroSectorDefinition } from '../types/regional';

export const MACRO_SECTORS: MacroSectorDefinition[] = [
  {
    id: 'PACIFIC',
    label: 'PACIFIC',
    metropolitanNode: 'SEATTLE CORE',
    baseTrafficDensity: 34,
    influence: { TERRAN_GRID: 42, LEGION: 31, SOLARIS: 27 },
  },
  {
    id: 'MOUNTAIN',
    label: 'MOUNTAIN',
    metropolitanNode: 'DENVER SPIRE',
    baseTrafficDensity: 58,
    influence: { TERRAN_GRID: 28, LEGION: 44, SOLARIS: 28 },
  },
  {
    id: 'CENTRAL',
    label: 'CENTRAL',
    metropolitanNode: 'CHICAGO NEXUS',
    baseTrafficDensity: 72,
    influence: { TERRAN_GRID: 38, LEGION: 22, SOLARIS: 40 },
  },
  {
    id: 'ATLANTIC',
    label: 'ATLANTIC',
    metropolitanNode: 'NYC GRIDLOCK',
    baseTrafficDensity: 81,
    influence: { TERRAN_GRID: 45, LEGION: 30, SOLARIS: 25 },
  },
  {
    id: 'THE_ARCHIPELAGO',
    label: 'THE ARCHIPELAGO',
    metropolitanNode: 'MIAMI VOID-PORT',
    baseTrafficDensity: 47,
    influence: { TERRAN_GRID: 20, LEGION: 35, SOLARIS: 45 },
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
