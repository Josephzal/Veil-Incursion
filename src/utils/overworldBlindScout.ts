import type { RunNodeType } from '../types/game';
import type { SectorGraphLayoutPoint } from './sectorGraphLayout';

export const SENSOR_RANGE_LAYOUT = 320;
export const RESONANCE_RANGE_LAYOUT = 72;
export const LAYOUT_TO_METERS = 2.4;

export type ScoutPhase = 'VOID' | 'BLIP' | 'RESONANCE' | 'STABILIZED' | 'MANIFESTED';

export interface ScoutTarget {
  id: string;
  world: SectorGraphLayoutPoint;
  distance: number;
  distanceMeters: number;
  phase: ScoutPhase;
  blinking: boolean;
  radarAngle: number;
  radarRadius: number;
}

export function layoutToMeters(distance: number): number {
  'worklet';
  return Math.round(distance * LAYOUT_TO_METERS);
}

export function resolveScoutPhase(
  distance: number,
  manifested: boolean,
): ScoutPhase {
  if (manifested) return 'MANIFESTED';
  if (distance <= RESONANCE_RANGE_LAYOUT) return 'STABILIZED';
  if (distance <= SENSOR_RANGE_LAYOUT) return 'BLIP';
  return 'VOID';
}

export function isRadarBlinking(phase: ScoutPhase): boolean {
  return phase === 'BLIP';
}

export function worldToRadarBlip(
  node: SectorGraphLayoutPoint,
  player: SectorGraphLayoutPoint,
  maxRadius = 0.88,
): { angle: number; radius: number } {
  'worklet';
  const dx = node.x - player.x;
  const dy = node.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const radius = Math.min(maxRadius, distance / SENSOR_RANGE_LAYOUT);
  return { angle, radius };
}

export function formatFrequencyMatchLog(distanceMeters: number): string {
  return `>> FREQUENCY MATCH DETECTED // DISTANCE: ${distanceMeters}m`;
}

export function formatRiftManifestLog(nodeType: RunNodeType, label: string): string {
  const sig = resolveRiftSignature(nodeType);
  const short = label.split(' // ').slice(-1)[0] ?? label;
  return `>> ${sig} UNLOCKED: ${short.toUpperCase()} // SECURITY RATIO: LOW`;
}

export function resolveRiftSignature(nodeType: RunNodeType): string {
  switch (nodeType) {
    case 'STANDARD_COMBAT':
    case 'ELITE_COMBAT':
    case 'BOSS_COMBAT':
      return 'COMBAT CACHE';
    case 'NARRATIVE_EVENT':
      return 'NARRATIVE ANOMALY';
    case 'RESOURCE_HARVEST':
      return 'RESOURCE CLUSTER';
    case 'BLACK_MARKET':
      return 'UNDERCITY CONDUIT';
    case 'SANCTUARY':
      return 'SANCTUARY RIFT';
    case 'SAFE_ANCHOR_EXTRACTION':
    case 'MASTER_EXTRACTION_LINK':
      return 'EXTRACTION ANCHOR';
    default:
      return 'VECTOR ANOMALY';
  }
}

export function resolveNearestScoutIntensity(
  distances: number[],
  sensorRange = SENSOR_RANGE_LAYOUT,
): number {
  if (distances.length === 0) return 0;
  const min = Math.min(...distances);
  if (min > sensorRange) return 0;
  return 1 - min / sensorRange;
}
