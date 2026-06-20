import type { ShadowWarSectorDefinition, ShadowWarSectorId } from '../types/shadowWar';
import { parseLowPolyPath, polygonCentroid } from '../utils/sectorInfluenceVisual';

export const SHADOW_WAR_VIEWBOX = { width: 480, height: 320 };

const RAW_SECTORS: Array<Omit<ShadowWarSectorDefinition, 'mapGeometry'> & { path: string }> = [
  {
    id: 'THE_SLAG_WORKS',
    label: 'The Slag Works',
    buffSummary: '+1 Kinetic Armor for controlling Cabal',
    buffId: 'KINETIC_ARMOR_PLUS_1',
    path: 'M 40 60 L 120 40 L 150 110 L 90 150 L 30 120 Z',
    defaultIp: { TERRAN_GRID: 420, LEGION: 380, SOLARIS: 210 },
  },
  {
    id: 'THE_ABYSSAL_SINK',
    label: 'The Abyssal Sink',
    buffSummary: '+10% Max HP for controlling Cabal',
    buffId: 'MAX_HP_PLUS_10',
    path: 'M 30 190 L 110 170 L 140 260 L 60 280 L 20 230 Z',
    defaultIp: { TERRAN_GRID: 180, LEGION: 290, SOLARIS: 410 },
  },
  {
    id: 'THE_NULL_ZONE',
    label: 'The Null Zone',
    buffSummary: '+10% Rare Loot Drop Rate',
    buffId: 'RARE_LOOT_PLUS_10',
    path: 'M 190 110 L 290 90 L 320 170 L 250 210 L 170 180 Z',
    defaultIp: { TERRAN_GRID: 310, LEGION: 305, SOLARIS: 300 },
  },
  {
    id: 'THE_BLACKLINE_TERMINUS',
    label: 'The Blackline Terminus',
    buffSummary: '15% Credit discount at the Black Market',
    buffId: 'BLACK_MARKET_DISCOUNT_15',
    path: 'M 330 40 L 430 55 L 450 130 L 370 150 L 310 95 Z',
    defaultIp: { TERRAN_GRID: 520, LEGION: 240, SOLARIS: 190 },
  },
  {
    id: 'THE_FRACTAL_WASTES',
    label: 'The Fractal Wastes',
    buffSummary: '+1 Max AP on combat Turn 1',
    buffId: 'FIRST_TURN_AP_PLUS_1',
    path: 'M 300 190 L 420 175 L 460 260 L 360 290 L 280 240 Z',
    defaultIp: { TERRAN_GRID: 200, LEGION: 480, SOLARIS: 260 },
  },
];

export const SHADOW_WAR_SECTORS: ShadowWarSectorDefinition[] = RAW_SECTORS.map((entry) => {
  const polygon = parseLowPolyPath(entry.path);
  const centroid = polygonCentroid(polygon);
  return {
    id: entry.id,
    label: entry.label,
    buffSummary: entry.buffSummary,
    buffId: entry.buffId,
    defaultIp: entry.defaultIp,
    mapGeometry: {
      path: entry.path,
      polygon,
      labelAnchor: centroid,
      nodeAnchor: { x: centroid.x, y: centroid.y - 12 },
    },
  };
});

export function getShadowWarSector(id: ShadowWarSectorId): ShadowWarSectorDefinition {
  return SHADOW_WAR_SECTORS.find((sector) => sector.id === id) ?? SHADOW_WAR_SECTORS[0];
}

export function createDefaultSectorIpState(): Record<ShadowWarSectorId, import('../types/shadowWar').CabalIpPool> {
  return SHADOW_WAR_SECTORS.reduce(
    (acc, sector) => {
      acc[sector.id] = { ...sector.defaultIp };
      return acc;
    },
    {} as Record<ShadowWarSectorId, import('../types/shadowWar').CabalIpPool>,
  );
}
