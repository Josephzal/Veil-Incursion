import { MacroSectorDefinition } from '../types/regional';
import { parseLowPolyPath, polygonCentroid } from '../utils/sectorInfluenceVisual';
import { SECTOR_DATA } from './sectorMapData';

export { SECTOR_DATA, WORLD_VIEWBOX } from './sectorMapData';

export const MACRO_SECTORS: MacroSectorDefinition[] = SECTOR_DATA.map((entry) => {
  const polygon = parseLowPolyPath(entry.path);
  const centroid = polygonCentroid(polygon);
  const nodeAnchor = entry.id === 'PACIFIC'
    ? { x: 118, y: 218 }
    : { x: centroid.x + 8, y: centroid.y + 6 };
  return {
    id: entry.id,
    label: entry.name,
    continent: entry.continent,
    metropolitanNode: entry.metropolitanNode,
    baseTrafficDensity: entry.trafficDensity,
    defaultFaction: entry.defaultFaction,
    influence: entry.influence,
    mapGeometry: {
      path: entry.path,
      polygon,
      labelAnchor: entry.id === 'PACIFIC' ? { x: 118, y: 205 } : centroid,
      nodeAnchor,
    },
  };
});

export function getMacroSector(id: string): MacroSectorDefinition {
  return MACRO_SECTORS.find((sector) => sector.id === id) ?? MACRO_SECTORS[0];
}

export function regionalCoatingSlotId(sectorId: string, faction: string): string {
  return `coating-${sectorId.toLowerCase().replace(/\s+/g, '-')}-${faction.toLowerCase()}`;
}

export function regionalCoatingLabel(sectorLabel: string, faction: string): string {
  return `${sectorLabel} ${faction.replace('_', ' ')} WEAPON COATING`;
}
