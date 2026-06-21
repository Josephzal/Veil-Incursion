import type { DistrictId } from './districtPacing';
import { depthFromNodesCleared, getDistrictFromDepth, localLevelFromDepth } from './districtPacing';
import { requiresVeilBleedBoon } from './descentLevelMatrix';
import { pickRawLeyBoonsForClass } from './classBoonEngine';
import type { ClassType } from '../types/game';
import type { EnvoyBoonId, HexShotBoonId } from '../types/classBoon';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import type { SectorGraphLayoutPoint } from '../utils/sectorGraphLayout';
import {
  createEmptyOverworldSession,
  GRID_HOUND_CATCH_RADIUS,
  GRID_HOUND_SPEED,
  GRID_HOUND_VISION_CONE_RAD,
  GRID_HOUND_VISION_RANGE,
  RAW_LEY_BOON_MAX_LOCAL_DEPTH,
  RAW_LEY_BOON_MIN_LOCAL_DEPTH,
  RAW_LEY_BOONS_PER_DISTRICT,
  RESONANCE_POCKET_RADIUS,
  RESONANCE_POCKET_RATE_PER_SEC,
  VEIL_ECHO_PICKUP_RADIUS,
  type GridHoundState,
  type OverworldFeatureSession,
  type RawLeyBoonNode,
  type ResonancePocket,
  type VeilEchoPickup,
} from '../types/overworldFeatures';
import { RESONANCE_ZONE_ALERT_MAX } from './resonanceHeatVentEngine';

export { depthInDistrict } from './combatEncounterBudget';

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function scatterPoint(
  rand: () => number,
  viewBox: { width: number; height: number },
  padding = 120,
): SectorGraphLayoutPoint {
  return {
    x: padding + rand() * (viewBox.width - padding * 2),
    y: padding + rand() * (viewBox.height - padding * 2.6),
  };
}

export function localDepthFromNodesCleared(nodesCleared: number): number {
  return localLevelFromDepth(depthFromNodesCleared(nodesCleared));
}

export function canSpawnRawLeyBoons(
  nodesCleared: number,
  claimedThisDistrict: number,
): boolean {
  const local = localDepthFromNodesCleared(nodesCleared);
  return local >= RAW_LEY_BOON_MIN_LOCAL_DEPTH
    && local <= RAW_LEY_BOON_MAX_LOCAL_DEPTH
    && claimedThisDistrict < RAW_LEY_BOONS_PER_DISTRICT;
}

export interface RawLeyBoonGenerationContext {
  activeClass: ClassType;
  leyLineMutations: readonly LeyLineMutationId[];
  hexShotBoons: readonly HexShotBoonId[];
  envoyBoons: readonly EnvoyBoonId[];
}

export function generateOverworldFeatures(
  nodesCleared: number,
  district: DistrictId,
  seed: string,
  viewBox: { width: number; height: number },
  existingHound: GridHoundState | null = null,
  rawBoonsClaimedThisDistrict = 0,
  boonContext: RawLeyBoonGenerationContext = {
    activeClass: 'AEGIS',
    leyLineMutations: [],
    hexShotBoons: [],
    envoyBoons: [],
  },
): OverworldFeatureSession {
  const rand = seededRandom(seed);
  const echoCount = 2 + Math.floor(rand() * 3);
  const veilEchoes: VeilEchoPickup[] = Array.from({ length: echoCount }, (_, i) => {
    const credits = rand() < 0.55;
    return {
      id: `echo-${seed}-${i}`,
      world: scatterPoint(rand, viewBox),
      rewardType: credits ? 'CREDITS' : 'RESOURCE',
      amount: credits ? 40 + Math.floor(rand() * 80) : 1 + Math.floor(rand() * 3),
      collected: false,
    };
  });

  const pocketCount = 1 + Math.floor(rand() * 2);
  const resonancePockets: ResonancePocket[] = Array.from({ length: pocketCount }, (_, i) => ({
    id: `pocket-${seed}-${i}`,
    world: scatterPoint(rand, viewBox),
    radius: RESONANCE_POCKET_RADIUS * (0.85 + rand() * 0.3),
  }));

  const rawLeyBoons: RawLeyBoonNode[] = [];
  const localLevel = localDepthFromNodesCleared(nodesCleared);
  const forceScarBoon = requiresVeilBleedBoon(localLevel)
    && rawBoonsClaimedThisDistrict < RAW_LEY_BOONS_PER_DISTRICT;
  if (canSpawnRawLeyBoons(nodesCleared, rawBoonsClaimedThisDistrict) || forceScarBoon) {
    const remaining = RAW_LEY_BOONS_PER_DISTRICT - rawBoonsClaimedThisDistrict;
    const spawnCount = forceScarBoon
      ? Math.min(remaining, 1)
      : Math.min(remaining, 1 + Math.floor(rand() * 2));
    const picks = pickRawLeyBoonsForClass(
      spawnCount,
      boonContext.activeClass,
      boonContext.leyLineMutations,
      boonContext.hexShotBoons,
      boonContext.envoyBoons,
    );
    picks.forEach((boonId, i) => {
      rawLeyBoons.push({
        id: `raw-boon-${seed}-${i}`,
        world: scatterPoint(rand, viewBox),
        boonId,
        claimed: false,
      });
    });
  }

  return {
    veilEchoes,
    resonancePockets,
    rawLeyBoons,
    gridHound: existingHound,
    rawBoonsClaimedThisDistrict,
  };
}

export function createGridHound(
  anchor: SectorGraphLayoutPoint,
  viewBox: { width: number; height: number },
): GridHoundState {
  return {
    active: true,
    world: {
      x: Math.max(80, Math.min(viewBox.width - 80, anchor.x + (Math.random() > 0.5 ? 320 : -320))),
      y: Math.max(80, Math.min(viewBox.height - 200, anchor.y - 280)),
    },
    facingRad: Math.atan2(anchor.y - (anchor.y - 280), anchor.x - anchor.x),
    caught: false,
  };
}

export function shouldSpawnGridHound(prevPercent: number, nextPercent: number): boolean {
  return prevPercent < RESONANCE_ZONE_ALERT_MAX && nextPercent >= RESONANCE_ZONE_ALERT_MAX;
}

export function facingRadFromAegis(facing: 'forward' | 'back' | 'left' | 'right'): number {
  switch (facing) {
    case 'forward': return -Math.PI / 2;
    case 'back': return Math.PI / 2;
    case 'left': return Math.PI;
    case 'right': return 0;
    default: return -Math.PI / 2;
  }
}

export function isInDirectedPingCone(
  origin: SectorGraphLayoutPoint,
  facingRad: number,
  target: SectorGraphLayoutPoint,
  range: number,
  coneRad: number,
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  const angle = Math.atan2(dy, dx);
  let delta = angle - facingRad;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta) <= coneRad / 2;
}

export function isInsideResonancePocket(
  player: SectorGraphLayoutPoint,
  pocket: ResonancePocket,
): boolean {
  return Math.hypot(player.x - pocket.world.x, player.y - pocket.world.y) <= pocket.radius;
}

export function collectVeilEchoRadius(): number {
  return VEIL_ECHO_PICKUP_RADIUS;
}

export function resonancePocketTickRate(): number {
  return RESONANCE_POCKET_RATE_PER_SEC;
}

export function isPlayerCaughtByGridHound(
  player: SectorGraphLayoutPoint,
  hound: GridHoundState,
): boolean {
  if (!hound.active || hound.caught) return false;
  return Math.hypot(player.x - hound.world.x, player.y - hound.world.y) <= GRID_HOUND_CATCH_RADIUS;
}

export function isPlayerVisibleToGridHound(
  player: SectorGraphLayoutPoint,
  hound: GridHoundState,
): boolean {
  if (!hound.active || hound.caught) return false;
  const dx = player.x - hound.world.x;
  const dy = player.y - hound.world.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GRID_HOUND_VISION_RANGE) return false;
  const angle = Math.atan2(dy, dx);
  let delta = angle - hound.facingRad;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta) <= GRID_HOUND_VISION_CONE_RAD / 2;
}

export function tickGridHound(
  hound: GridHoundState,
  player: SectorGraphLayoutPoint,
  deltaMs: number,
): GridHoundState {
  if (!hound.active || hound.caught) return hound;

  const dx = player.x - hound.world.x;
  const dy = player.y - hound.world.y;
  const dist = Math.hypot(dx, dy);
  const step = (GRID_HOUND_SPEED * deltaMs) / 1000;
  const chase = isPlayerVisibleToGridHound(player, hound) || dist < GRID_HOUND_VISION_RANGE * 0.6;

  if (!chase) {
    return { ...hound, facingRad: hound.facingRad + 0.4 * (deltaMs / 1000) };
  }

  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : 0;
  return {
    ...hound,
    world: {
      x: hound.world.x + nx * step,
      y: hound.world.y + ny * step,
    },
    facingRad: Math.atan2(ny, nx),
  };
}

export function mergeOverworldSession(
  prev: OverworldFeatureSession | undefined,
  next: OverworldFeatureSession,
): OverworldFeatureSession {
  if (!prev) return next;
  return {
    ...next,
    gridHound: next.gridHound ?? prev.gridHound,
    rawBoonsClaimedThisDistrict: next.rawBoonsClaimedThisDistrict,
  };
}

export function resetOverworldForDistrict(
  claimedCount = 0,
): OverworldFeatureSession {
  return { ...createEmptyOverworldSession(), rawBoonsClaimedThisDistrict: claimedCount };
}
