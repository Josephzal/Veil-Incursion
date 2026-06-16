import { FactionType } from '../types/game';
import { CabalInfluenceBalance, ContinentCode, MacroSectorId, MapPoint } from '../types/regional';
import { parseLowPolyPath, polygonCentroid } from '../utils/sectorInfluenceVisual';

export const WORLD_VIEWBOX = { width: 1000, height: 500 } as const;

export interface SectorMapDataEntry {
  id: MacroSectorId;
  name: string;
  continent: ContinentCode;
  path: string;
  defaultFaction: FactionType;
  trafficDensity: number;
  metropolitanNode: string;
  influence: CabalInfluenceBalance;
}

function influenceFromDefault(defaultFaction: FactionType, skew: number): CabalInfluenceBalance {
  const factions: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];
  const secondary = factions.filter((faction) => faction !== defaultFaction);
  const primary = 44 + (skew % 7);
  const secondaryA = 28 + (skew % 5);
  const secondaryB = 100 - primary - secondaryA;
  return {
    TERRAN_GRID: defaultFaction === 'TERRAN_GRID' ? primary : secondary[0] === 'TERRAN_GRID' ? secondaryA : secondaryB,
    LEGION: defaultFaction === 'LEGION' ? primary : secondary[0] === 'LEGION' ? secondaryA : secondaryB,
    SOLARIS: defaultFaction === 'SOLARIS' ? primary : secondary[0] === 'SOLARIS' ? secondaryA : secondaryB,
  };
}

/** Global macro-sectors — low-poly SVG paths on a 1000×500 equirectangular artboard. */
export const SECTOR_DATA: SectorMapDataEntry[] = [
  // North America
  {
    id: 'PACIFIC',
    name: 'PACIFIC // US',
    continent: 'NA',
    path: 'M 92 168 L 132 142 L 158 188 L 152 248 L 112 262 L 82 228 L 78 198 Z',
    defaultFaction: 'TERRAN_GRID',
    trafficDensity: 34,
    metropolitanNode: 'SEATTLE CORE',
    influence: influenceFromDefault('TERRAN_GRID', 1),
  },
  {
    id: 'CASCADIA',
    name: 'CASCADIA',
    continent: 'NA',
    path: 'M 148 118 L 208 92 L 232 138 L 215 182 L 172 178 Z',
    defaultFaction: 'SOLARIS',
    trafficDensity: 41,
    metropolitanNode: 'VANCOUVER SPIRE',
    influence: influenceFromDefault('SOLARIS', 2),
  },
  {
    id: 'HEARTLAND',
    name: 'HEARTLAND',
    continent: 'NA',
    path: 'M 215 148 L 292 128 L 310 218 L 288 268 L 218 262 L 208 198 Z',
    defaultFaction: 'TERRAN_GRID',
    trafficDensity: 72,
    metropolitanNode: 'CHICAGO NEXUS',
    influence: influenceFromDefault('TERRAN_GRID', 3),
  },
  {
    id: 'ATLANTIC',
    name: 'ATLANTIC',
    continent: 'NA',
    path: 'M 292 118 L 358 108 L 372 188 L 352 258 L 288 268 L 278 178 Z',
    defaultFaction: 'TERRAN_GRID',
    trafficDensity: 81,
    metropolitanNode: 'NYC GRIDLOCK',
    influence: influenceFromDefault('TERRAN_GRID', 4),
  },
  {
    id: 'NEO-MEX',
    name: 'NEO-MEX',
    continent: 'NA',
    path: 'M 168 248 L 288 262 L 272 312 L 208 318 L 142 292 L 158 258 Z',
    defaultFaction: 'SOLARIS',
    trafficDensity: 47,
    metropolitanNode: 'PHOENIX VOID-PORT',
    influence: influenceFromDefault('SOLARIS', 5),
  },
  // South America
  {
    id: 'AMAZONIA',
    name: 'AMAZONIA',
    continent: 'SA',
    path: 'M 298 288 L 372 272 L 388 348 L 352 392 L 292 378 L 278 328 Z',
    defaultFaction: 'LEGION',
    trafficDensity: 52,
    metropolitanNode: 'MANAUS CONDUIT',
    influence: influenceFromDefault('LEGION', 6),
  },
  {
    id: 'ANDEAN CORDON',
    name: 'ANDEAN CORDON',
    continent: 'SA',
    path: 'M 278 300 L 298 288 L 318 380 L 308 448 L 278 430 L 268 360 Z',
    defaultFaction: 'LEGION',
    trafficDensity: 38,
    metropolitanNode: 'LIMA SPINE',
    influence: influenceFromDefault('LEGION', 7),
  },
  {
    id: 'PATAGONIA',
    name: 'PATAGONIA',
    continent: 'SA',
    path: 'M 308 420 L 352 400 L 368 468 L 332 490 L 298 472 L 292 438 Z',
    defaultFaction: 'SOLARIS',
    trafficDensity: 29,
    metropolitanNode: 'USHUAIA ANCHOR',
    influence: influenceFromDefault('SOLARIS', 8),
  },
  // Europe
  {
    id: 'NORDIC SPRAWL',
    name: 'NORDIC SPRAWL',
    continent: 'EU',
    path: 'M 468 78 L 528 62 L 548 108 L 532 148 L 482 142 L 458 108 Z',
    defaultFaction: 'TERRAN_GRID',
    trafficDensity: 55,
    metropolitanNode: 'OSLO STACK',
    influence: influenceFromDefault('TERRAN_GRID', 9),
  },
  {
    id: 'WESTERN BLOC',
    name: 'WESTERN BLOC',
    continent: 'EU',
    path: 'M 458 108 L 532 148 L 542 198 L 512 228 L 458 218 L 442 168 Z',
    defaultFaction: 'TERRAN_GRID',
    trafficDensity: 76,
    metropolitanNode: 'PARIS NEXUS',
    influence: influenceFromDefault('TERRAN_GRID', 10),
  },
  {
    id: 'SLAVIC GRID',
    name: 'SLAVIC GRID',
    continent: 'EU',
    path: 'M 532 148 L 598 132 L 618 198 L 592 248 L 528 228 L 518 178 Z',
    defaultFaction: 'LEGION',
    trafficDensity: 63,
    metropolitanNode: 'WARSAW GRID',
    influence: influenceFromDefault('LEGION', 11),
  },
  // Africa
  {
    id: 'SAHARA EXPANSE',
    name: 'SAHARA EXPANSE',
    continent: 'AF',
    path: 'M 458 218 L 558 208 L 578 278 L 548 328 L 468 318 L 448 258 Z',
    defaultFaction: 'LEGION',
    trafficDensity: 44,
    metropolitanNode: 'CAIRO MIRAGE',
    influence: influenceFromDefault('LEGION', 12),
  },
  {
    id: 'CONGO BASIN',
    name: 'CONGO BASIN',
    continent: 'AF',
    path: 'M 468 318 L 548 328 L 568 388 L 518 418 L 458 402 L 442 352 Z',
    defaultFaction: 'LEGION',
    trafficDensity: 36,
    metropolitanNode: 'KINSHASA DEEP',
    influence: influenceFromDefault('LEGION', 13),
  },
  {
    id: 'CAPE SECTOR',
    name: 'CAPE SECTOR',
    continent: 'AF',
    path: 'M 458 402 L 518 418 L 532 468 L 488 488 L 448 462 L 442 428 Z',
    defaultFaction: 'SOLARIS',
    trafficDensity: 48,
    metropolitanNode: 'CAPE TOWN HARBOR',
    influence: influenceFromDefault('SOLARIS', 14),
  },
  // Asia
  {
    id: 'SIBERIAN WASTES',
    name: 'SIBERIAN WASTES',
    continent: 'AS',
    path: 'M 598 72 L 768 58 L 812 128 L 778 178 L 618 168 L 588 118 Z',
    defaultFaction: 'LEGION',
    trafficDensity: 31,
    metropolitanNode: 'NOVOSIBIRSK WASTE',
    influence: influenceFromDefault('LEGION', 15),
  },
  {
    id: 'SINO-GRID',
    name: 'SINO-GRID',
    continent: 'AS',
    path: 'M 618 178 L 778 178 L 798 248 L 752 298 L 628 288 L 608 228 Z',
    defaultFaction: 'TERRAN_GRID',
    trafficDensity: 88,
    metropolitanNode: 'SHANGHAI FORGE',
    influence: influenceFromDefault('TERRAN_GRID', 16),
  },
  {
    id: 'DUNE SEA',
    name: 'DUNE SEA',
    continent: 'AS',
    path: 'M 528 228 L 608 228 L 628 288 L 588 328 L 518 308 L 502 258 Z',
    defaultFaction: 'SOLARIS',
    trafficDensity: 59,
    metropolitanNode: 'DUBAI DUNE',
    influence: influenceFromDefault('SOLARIS', 17),
  },
  {
    id: 'INDO-TRACT',
    name: 'INDO-TRACT',
    continent: 'AS',
    path: 'M 628 288 L 752 298 L 772 368 L 708 398 L 618 372 L 598 328 Z',
    defaultFaction: 'LEGION',
    trafficDensity: 67,
    metropolitanNode: 'MUMBAI TRACT',
    influence: influenceFromDefault('LEGION', 18),
  },
  {
    id: 'PACIFIC RIM',
    name: 'PACIFIC RIM',
    continent: 'AS',
    path: 'M 772 218 L 848 198 L 878 258 L 852 318 L 778 298 L 758 248 Z',
    defaultFaction: 'TERRAN_GRID',
    trafficDensity: 74,
    metropolitanNode: 'TOKYO RIM',
    influence: influenceFromDefault('TERRAN_GRID', 19),
  },
  // Oceania
  {
    id: 'OUTBACK CORDON',
    name: 'OUTBACK CORDON',
    continent: 'OC',
    path: 'M 808 348 L 892 332 L 918 392 L 878 428 L 812 418 L 792 378 Z',
    defaultFaction: 'SOLARIS',
    trafficDensity: 42,
    metropolitanNode: 'SYDNEY CORDON',
    influence: influenceFromDefault('SOLARIS', 20),
  },
];

export function sectorPolygonFromPath(path: string): MapPoint[] {
  return parseLowPolyPath(path);
}

export function sectorAnchorsFromPath(path: string): { labelAnchor: MapPoint; nodeAnchor: MapPoint } {
  const polygon = sectorPolygonFromPath(path);
  const centroid = polygonCentroid(polygon);
  return {
    labelAnchor: centroid,
    nodeAnchor: { x: centroid.x + 8, y: centroid.y + 6 },
  };
}

export function getSectorMapEntry(id: MacroSectorId): SectorMapDataEntry {
  return SECTOR_DATA.find((entry) => entry.id === id) ?? SECTOR_DATA[0];
}
