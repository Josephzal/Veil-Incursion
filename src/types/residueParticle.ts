export type ResidueEnemyTier = 'standard' | 'elite' | 'boss';

export interface ResidueParticleData {
  id: string;
  instanceId: string;
  startX: number;
  startY: number;
  value: number;
  size: number;
  vacuumDelayMs: number;
}

export interface HarvestFloorBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}
