import { MacroSectorId, MapPoint, SectorMapGeometry } from '../types/regional';

/** Shared artboard for stylized world-map sector polygons. */
export const WORLD_VIEWBOX = { width: 1600, height: 900 } as const;

export const WORLD_SECTOR_GEOMETRY: Record<MacroSectorId, SectorMapGeometry> = {
  PACIFIC: {
    polygon: [
      { x: 140, y: 210 },
      { x: 300, y: 170 },
      { x: 430, y: 230 },
      { x: 410, y: 390 },
      { x: 270, y: 430 },
      { x: 170, y: 360 },
      { x: 120, y: 280 },
    ],
    labelAnchor: { x: 280, y: 300 },
    nodeAnchor: { x: 220, y: 320 },
  },
  MOUNTAIN: {
    polygon: [
      { x: 400, y: 250 },
      { x: 530, y: 230 },
      { x: 600, y: 310 },
      { x: 580, y: 450 },
      { x: 450, y: 470 },
      { x: 370, y: 390 },
      { x: 380, y: 300 },
    ],
    labelAnchor: { x: 490, y: 350 },
    nodeAnchor: { x: 500, y: 360 },
  },
  CENTRAL: {
    polygon: [
      { x: 560, y: 290 },
      { x: 730, y: 270 },
      { x: 800, y: 370 },
      { x: 760, y: 510 },
      { x: 610, y: 490 },
      { x: 530, y: 400 },
    ],
    labelAnchor: { x: 670, y: 380 },
    nodeAnchor: { x: 680, y: 400 },
  },
  ATLANTIC: {
    polygon: [
      { x: 770, y: 190 },
      { x: 990, y: 170 },
      { x: 1120, y: 250 },
      { x: 1100, y: 410 },
      { x: 930, y: 430 },
      { x: 790, y: 360 },
      { x: 750, y: 270 },
    ],
    labelAnchor: { x: 930, y: 300 },
    nodeAnchor: { x: 960, y: 320 },
  },
  THE_ARCHIPELAGO: {
    polygon: [
      { x: 870, y: 450 },
      { x: 1030, y: 430 },
      { x: 1080, y: 530 },
      { x: 1020, y: 630 },
      { x: 870, y: 610 },
      { x: 810, y: 520 },
    ],
    labelAnchor: { x: 940, y: 540 },
    nodeAnchor: { x: 950, y: 560 },
  },
};

/** Decorative continent silhouettes — visual only, not interactive. */
export const WORLD_CONTINENT_OUTLINES: MapPoint[][] = [
  [
    { x: 1180, y: 180 },
    { x: 1320, y: 160 },
    { x: 1420, y: 220 },
    { x: 1380, y: 320 },
    { x: 1240, y: 340 },
    { x: 1160, y: 260 },
  ],
  [
    { x: 1240, y: 360 },
    { x: 1340, y: 340 },
    { x: 1380, y: 500 },
    { x: 1320, y: 700 },
    { x: 1220, y: 760 },
    { x: 1160, y: 620 },
    { x: 1180, y: 420 },
  ],
  [
    { x: 1420, y: 200 },
    { x: 1520, y: 210 },
    { x: 1540, y: 380 },
    { x: 1480, y: 520 },
    { x: 1400, y: 480 },
    { x: 1380, y: 300 },
  ],
  [
    { x: 1480, y: 540 },
    { x: 1560, y: 520 },
    { x: 1580, y: 700 },
    { x: 1520, y: 820 },
    { x: 1440, y: 780 },
    { x: 1420, y: 600 },
  ],
  [
    { x: 200, y: 500 },
    { x: 360, y: 480 },
    { x: 420, y: 580 },
    { x: 380, y: 720 },
    { x: 240, y: 760 },
    { x: 160, y: 640 },
  ],
  [
    { x: 1320, y: 620 },
    { x: 1480, y: 600 },
    { x: 1520, y: 720 },
    { x: 1440, y: 800 },
    { x: 1340, y: 760 },
  ],
];
