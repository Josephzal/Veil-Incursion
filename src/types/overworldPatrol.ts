import type { ResonanceZone } from '../data/resonanceHeatVentEngine';

export interface PatrolBlip {
  id: string;
  /** Fixed bearing seed (radians) — drift applied at render time. */
  baseAngleRad: number;
  label: string;
}

export interface PatrolState {
  zone: ResonanceZone;
  spawnRate: number;
  blipCount: number;
  speedMultiplier: number;
  blips: PatrolBlip[];
}

export function createEmptyPatrolState(): PatrolState {
  return {
    zone: 'SAFE',
    spawnRate: 0,
    blipCount: 0,
    speedMultiplier: 1,
    blips: [],
  };
}
