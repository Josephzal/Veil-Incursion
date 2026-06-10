import {
  getResonanceZone,
  type ResonanceZone,
} from './resonanceHeatVentEngine';
import { districtMultiplier, type DistrictId } from './districtPacing';
import { leyTrackerMaxCanvasRadius } from '../utils/overworldBlindScout';
import type { PatrolBlip, PatrolState } from '../types/overworldPatrol';
import { createEmptyPatrolState } from '../types/overworldPatrol';
import type { RadarDot } from '../types/run';

/** Rim orbit speed — doubled in Critical via `PatrolState.speedMultiplier`. */
export const PATROL_DRIFT_RAD_PER_SEC = 0.42;

const PATROL_STUB_SECTOR = {
  id: 'patrol-hostile',
  name: 'HOSTILE PATROL',
  subsector: 'VEIL',
  theme: 'CITY' as const,
  description: 'Resonance heat contact',
};

function seededRandom(seed: number): () => number {
  let roll = Math.abs(seed) % 233280 || 1;
  return () => {
    roll = (roll * 9301 + 49297) % 233280;
    return roll / 233280;
  };
}

function resolvePatrolBlipCount(zone: ResonanceZone, rng: () => number): number {
  if (zone === 'SAFE') return 0;
  const roll = rng();
  return roll < 0.45 ? 1 : 2;
}

/** Hostile Ley-Tracker contacts from resonance heat — sync before scanner render. */
export function resolvePatrolState(
  resonancePercent: number,
  district: DistrictId,
  sessionSeed: number,
): PatrolState {
  const zone = getResonanceZone(resonancePercent);
  if (zone === 'SAFE') {
    return createEmptyPatrolState();
  }

  const rng = seededRandom(sessionSeed + district * 131 + Math.floor(resonancePercent) * 17);
  const blipCount = resolvePatrolBlipCount(zone, rng);
  const speedMultiplier = zone === 'CRITICAL' ? 2 : 1;
  const spawnRate = zone === 'CRITICAL' ? 1 : 0.55 + districtMultiplier(district) * 0.12;

  const blips: PatrolBlip[] = [];
  for (let i = 0; i < blipCount; i += 1) {
    blips.push({
      id: `patrol-${sessionSeed}-${district}-${i}`,
      baseAngleRad: rng() * Math.PI * 2,
      label: `HOSTILE SIG-${i + 1}`,
    });
  }

  return {
    zone,
    spawnRate,
    blipCount,
    speedMultiplier,
    blips,
  };
}

export interface PatrolScannerContact {
  id: string;
  x: number;
  y: number;
  angleDeg: number;
}

/** Projects patrol blips to the scanner rim with optional drift rotation. */
export function projectPatrolBlipsToScanner(
  patrol: PatrolState,
  scannerSize: number,
  driftRad = 0,
): PatrolScannerContact[] {
  if (patrol.blips.length === 0) return [];

  const center = scannerSize / 2;
  const edgeR = leyTrackerMaxCanvasRadius(scannerSize);

  return patrol.blips.map((blip) => {
    const angle = blip.baseAngleRad + driftRad;
    const x = center + Math.cos(angle) * edgeR;
    const y = center + Math.sin(angle) * edgeR;
    const angleDeg = ((angle * 180) / Math.PI + 360) % 360;
    return { id: blip.id, x, y, angleDeg };
  });
}

/** Synthetic Ley-Tracker dots for hostile patrol contacts (not breach rifts). */
export function buildPatrolRadarDots(
  patrol: PatrolState,
  scannerSize: number,
  driftRad: number,
): RadarDot[] {
  const contacts = projectPatrolBlipsToScanner(patrol, scannerSize, driftRad);
  return contacts.map((contact, index) => {
    const blip = patrol.blips[index];
    const label = blip?.label ?? `HOSTILE SIG-${index + 1}`;
    return {
      id: contact.id,
      sector: PATROL_STUB_SECTOR,
      encounterType: 'COMBAT',
      label,
      pingLabel: label,
      pingIndex: index,
      x: contact.x,
      y: contact.y,
      angleDeg: contact.angleDeg,
      encounterIndex: -1,
      isHostilePatrol: true,
    };
  });
}
