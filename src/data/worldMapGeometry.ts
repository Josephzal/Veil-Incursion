import { MacroSectorId, MapPoint, SectorMapGeometry } from '../types/regional';

/** Shared artboard for stylized low-poly world map. */
export const WORLD_VIEWBOX = { width: 1600, height: 900 } as const;

/**
 * Five macro sectors tile North America in angular low-poly style (gameplay regions).
 * Remaining landmasses are decorative continent silhouettes matching the reference map.
 */
export const WORLD_SECTOR_GEOMETRY: Record<MacroSectorId, SectorMapGeometry> = {
  PACIFIC: {
    polygon: [
      { x: 100, y: 165 },
      { x: 245, y: 145 },
      { x: 265, y: 235 },
      { x: 255, y: 355 },
      { x: 215, y: 405 },
      { x: 135, y: 385 },
      { x: 105, y: 285 },
    ],
    labelAnchor: { x: 185, y: 270 },
    nodeAnchor: { x: 165, y: 300 },
  },
  MOUNTAIN: {
    polygon: [
      { x: 245, y: 145 },
      { x: 365, y: 138 },
      { x: 385, y: 235 },
      { x: 375, y: 365 },
      { x: 255, y: 385 },
      { x: 265, y: 235 },
    ],
    labelAnchor: { x: 320, y: 265 },
    nodeAnchor: { x: 330, y: 280 },
  },
  CENTRAL: {
    polygon: [
      { x: 365, y: 138 },
      { x: 485, y: 132 },
      { x: 505, y: 245 },
      { x: 485, y: 365 },
      { x: 375, y: 375 },
      { x: 385, y: 235 },
    ],
    labelAnchor: { x: 440, y: 260 },
    nodeAnchor: { x: 450, y: 275 },
  },
  ATLANTIC: {
    polygon: [
      { x: 485, y: 132 },
      { x: 595, y: 128 },
      { x: 610, y: 255 },
      { x: 590, y: 355 },
      { x: 495, y: 365 },
      { x: 505, y: 245 },
    ],
    labelAnchor: { x: 545, y: 250 },
    nodeAnchor: { x: 555, y: 265 },
  },
  THE_ARCHIPELAGO: {
    polygon: [
      { x: 355, y: 365 },
      { x: 590, y: 355 },
      { x: 565, y: 435 },
      { x: 485, y: 485 },
      { x: 395, y: 465 },
      { x: 335, y: 405 },
    ],
    labelAnchor: { x: 460, y: 420 },
    nodeAnchor: { x: 470, y: 440 },
  },
};

/** Non-interactive landmass silhouettes — South America, Greenland, Eurasia/Africa, Australia. */
export const WORLD_CONTINENT_OUTLINES: MapPoint[][] = [
  // Greenland
  [
    { x: 625, y: 95 },
    { x: 735, y: 88 },
    { x: 765, y: 135 },
    { x: 710, y: 168 },
    { x: 635, y: 155 },
  ],
  // South America
  [
    { x: 435, y: 505 },
    { x: 545, y: 495 },
    { x: 585, y: 625 },
    { x: 525, y: 790 },
    { x: 455, y: 805 },
    { x: 405, y: 655 },
    { x: 415, y: 545 },
  ],
  // Eurasia + Africa
  [
    { x: 685, y: 135 },
    { x: 1065, y: 112 },
    { x: 1195, y: 205 },
    { x: 1255, y: 395 },
    { x: 1195, y: 575 },
    { x: 1065, y: 695 },
    { x: 895, y: 655 },
    { x: 755, y: 495 },
    { x: 685, y: 325 },
    { x: 655, y: 205 },
  ],
  // Australia
  [
    { x: 1245, y: 625 },
    { x: 1395, y: 615 },
    { x: 1435, y: 705 },
    { x: 1375, y: 768 },
    { x: 1265, y: 745 },
  ],
];
