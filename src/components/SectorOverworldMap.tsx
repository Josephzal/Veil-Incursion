import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import type { DistrictId } from '../data/districtPacing';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import type { IncursionNode, RunNodeType } from '../types/game';
import type { SectorGraph } from '../types/sector';
import type { CabalScannerTheme } from '../types/scanner';
import type { RadarDot } from '../types/run';
import type { PatrolState } from '../types/overworldPatrol';
import { createEmptyPatrolState } from '../types/overworldPatrol';
import {
  buildPatrolRadarDots,
  PATROL_DRIFT_RAD_PER_SEC,
} from '../data/patrolSpawnEngine';
import type { ScannerCabal } from '../types/scanner';
import { resolveMapDrawMetrics } from '../utils/sectorInfluenceVisual';
import {
  mergeLayoutPositions,
  projectClusterEphemerals,
  projectSectorGraphLayout,
  type SectorGraphLayoutPoint,
} from '../utils/sectorGraphLayout';
import { buildRevealedSet } from '../utils/sectorGraphVisibility';
import { bearingFromCanvasCenter } from '../data/scannerNodeLayout';
import {
  buildScoutArenaLayout,
  scoutArenaWorldBounds,
} from '../utils/scoutArenaLayout';
import {
  formatRiftManifestLog,
  layoutToMeters,
  leyTrackerMaxCanvasRadius,
  resolveNearestScoutIntensity,
  resolveScoutPhase,
  SCANNER_EDGE_RADIUS_NORM,
  SENSOR_RANGE_LAYOUT,
  worldToRadarBlip,
  type ScoutTarget,
} from '../utils/overworldBlindScout';
import {
  buildDepthCorridor,
  type BoundaryWall,
} from '../utils/overworldCorridorEngine';
import {
  clampToWorldBounds,
  resolveMovementFacing,
  SLATE_BLACK,
  type AegisFacing,
  worldToScreen,
} from '../utils/overworldRadarProjection';
import DimensionalTearOverlay from './overworld/DimensionalTearOverlay';
import FixedLeyTrackerHud, { LEY_TRACKER_SIZE } from './overworld/FixedLeyTrackerHud';
import FogCorridorMask from './overworld/FogCorridorMask';
import ProceduralRiftSkia from './overworld/ProceduralRiftSkia';
import ProximityScanlineOverlay from './overworld/ProximityScanlineOverlay';
import OverworldTerrainBackdrop from './overworld/OverworldTerrainBackdrop';
import VirtualJoystick from './overworld/VirtualJoystick';
import type { OverworldFeatureSession } from '../types/overworldFeatures';
import { createEmptyOverworldSession } from '../types/overworldFeatures';
import {
  collectVeilEchoRadius,
  facingRadFromAegis,
  isInDirectedPingCone,
} from '../data/overworldFeatureEngine';
import {
  DIRECTED_PING_CONE_RAD,
  DIRECTED_PING_RANGE,
} from '../types/overworldFeatures';

import AegisForward from '../../assets/images/character images/aegis/aegis-forward.png';
import AegisBack from '../../assets/images/character images/aegis/aegis-back.png';
import AegisLeft from '../../assets/images/character images/aegis/aegis-left.png';
import AegisRight from '../../assets/images/character images/aegis/aegis-right.png';

const WORLD_ZOOM = 4;
/** World units per second — frame-rate independent via useFrameCallback delta time. */
const MOVE_SPEED_UNITS_PER_SEC = 200;
const PLAYER_SPRITE_W = 63;
const PLAYER_SPRITE_H = 81;
const NODE_RADIUS = { default: 23, boss: 31 } as const;
const RIFT_HIT_SIZE = 56;

const FACING_SOURCE: Record<AegisFacing, ImageSourcePropType> = {
  forward: AegisForward,
  back: AegisBack,
  left: AegisLeft,
  right: AegisRight,
};

function isSafeAnchorNode(nodeType: RunNodeType, nodeId: string): boolean {
  return nodeType === 'SAFE_ANCHOR_EXTRACTION' || nodeId.startsWith('safe-anchor');
}

export interface SectorOverworldMapProps {
  graph: SectorGraph;
  currentNodeId: string;
  encounterPath: IncursionNode[];
  focusedNodeIds: readonly string[];
  cluster: IncursionNode[];
  nodesCleared?: number;
  vectorDots?: RadarDot[];
  patrolState?: PatrolState;
  cabal?: ScannerCabal;
  zoneTint?: Partial<CabalScannerTheme>;
  selectedNodeId?: string | null;
  zoneLineColor?: string;
  accentColor?: string;
  onNodePress?: (nodeId: string) => void;
  onFrequencyMatch?: (nodeId: string, distanceMeters: number) => void;
  onNodeManifest?: (nodeId: string, logLine: string) => void;
  onManifestedIdsChange?: (ids: readonly string[]) => void;
  onScoutProgressChange?: (revealedCount: number, totalCount: number) => void;
  mapStatusText?: string;
  layoutRollKey?: number | string;
  /** District chapter tint — D2 yellow, D3 red. */
  currentDistrict?: DistrictId;
  compact?: boolean;
  interactive?: boolean;
  /** Walkable corridor only — no rifts, scanner HUD, hazards, or resonance features. */
  hubMode?: boolean;
  hubInteractables?: import('../data/hubInteractables').HubInteractable[];
  onNearHubInteractable?: (id: string | null) => void;
  onHubInteractablePress?: (id: string) => void;
  overworldSession?: OverworldFeatureSession;
  onCollectVeilEcho?: (echoId: string) => void;
  onAcquireRawLeyBoon?: (boonId: string) => void;
  onTickOverworldHazards?: (
    player: { x: number; y: number },
    deltaMs: number,
  ) => { gridHoundCaught: boolean };
  onDirectedPing?: (facing: AegisFacing) => void;
  onGridHoundCaught?: () => void;
}

const DISTRICT_ATMOSPHERE_OVERLAY: Record<DistrictId, string | null> = {
  1: null,
  2: 'rgba(255, 214, 64, 0.14)',
  3: 'rgba(255, 69, 58, 0.16)',
};

interface ScoutNode {
  id: string;
  world: SectorGraphLayoutPoint;
  label: string;
  nodeType: RunNodeType;
  isInteractive: boolean;
  isBoss: boolean;
  isAnchor: boolean;
}

export default function SectorOverworldMap({
  graph,
  currentNodeId,
  encounterPath,
  focusedNodeIds,
  cluster,
  nodesCleared = 0,
  vectorDots = [],
  patrolState = createEmptyPatrolState(),
  cabal = 'TERRAN_GRID',
  zoneTint,
  selectedNodeId = null,
  onNodePress,
  onFrequencyMatch,
  onNodeManifest,
  onManifestedIdsChange,
  onScoutProgressChange,
  mapStatusText,
  layoutRollKey,
  currentDistrict = 1,
  compact = false,
  interactive = true,
  hubMode = false,
  hubInteractables = [],
  onNearHubInteractable,
  onHubInteractablePress,
  overworldSession = createEmptyOverworldSession(),
  onCollectVeilEcho,
  onAcquireRawLeyBoon,
  onTickOverworldHazards,
  onDirectedPing,
  onGridHoundCaught,
}: SectorOverworldMapProps): React.JSX.Element {
  const [arenaRoll, setArenaRoll] = useState(() => Math.random());
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [facing, setFacing] = useState<AegisFacing>('back');
  const [manifestedIds, setManifestedIds] = useState<Set<string>>(() => new Set());
  const [revealedOnMapIds, setRevealedOnMapIds] = useState<Set<string>>(() => new Set());
  const [sensorDetectedIds, setSensorDetectedIds] = useState<Set<string>>(() => new Set());
  const [registryIds, setRegistryIds] = useState<Set<string>>(() => new Set());
  const [positionOverrides, setPositionOverrides] = useState<Record<string, SectorGraphLayoutPoint>>({});
  const [vaporizedWalls, setVaporizedWalls] = useState<Set<string>>(() => new Set());
  const [corridorBounds, setCorridorBounds] = useState({ minX: 0, maxX: 320, minY: 0, maxY: 400 });
  const [corridorWalls, setCorridorWalls] = useState<BoundaryWall[]>([]);
  const [radarBlips, setRadarBlips] = useState<ScoutTarget[]>([]);
  const [playerPos, setPlayerPos] = useState<SectorGraphLayoutPoint>({ x: 0, y: 0 });
  const [tearActive, setTearActive] = useState(false);
  const [scanlineIntensity, setScanlineIntensity] = useState(0);
  const [ghostRadarBlip, setGhostRadarBlip] = useState<{ x: number; y: number } | null>(null);
  const [patrolDriftRad, setPatrolDriftRad] = useState(0);
  const [pingRevealIds, setPingRevealIds] = useState<Set<string>>(() => new Set());

  const playerWorldX = useSharedValue(0);
  const playerWorldY = useSharedValue(0);
  const joystickX = useSharedValue(0);
  const joystickY = useSharedValue(0);
  const worldScale = useSharedValue(WORLD_ZOOM);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);
  const boundsShared = useSharedValue({ minX: 0, maxX: 320, minY: 0, maxY: 400 });
  const wallShred = useSharedValue(1);

  const resonanceLoggedRef = useRef<Set<string>>(new Set());
  const scoutNodesRef = useRef<ScoutNode[]>([]);
  const manifestedRef = useRef<Set<string>>(new Set());
  const revealedOnMapRef = useRef<Set<string>>(new Set());
  const sensorDetectedRef = useRef<Set<string>>(new Set());
  const overridesRef = useRef<Record<string, SectorGraphLayoutPoint>>({});
  const facingRef = useRef<AegisFacing>('back');

  const baseLayout = useMemo(() => projectSectorGraphLayout(graph), [graph]);
  const ephemeralPositions = useMemo(
    () => projectClusterEphemerals(cluster, graph, baseLayout, currentNodeId),
    [cluster, graph, baseLayout, currentNodeId],
  );

  const resolvedCurrentId = graph.nodes[currentNodeId] ? currentNodeId : graph.entryId;
  const graphLayoutPositions = useMemo(
    () => mergeLayoutPositions(baseLayout.positions, ephemeralPositions),
    [baseLayout.positions, ephemeralPositions],
  );

  const graphSpawnPoint = graphLayoutPositions[resolvedCurrentId]
    ?? graphLayoutPositions[graph.entryId]
    ?? { x: baseLayout.viewBox.width / 2, y: baseLayout.viewBox.height * 0.75 };

  const scoutArena = useMemo(() => {
    if (compact) return null;
    return buildScoutArenaLayout(cluster, arenaRoll);
  }, [compact, cluster, arenaRoll]);

  const layoutPositions = useMemo(() => {
    if (scoutArena) {
      return { ...graphLayoutPositions, ...scoutArena.positions };
    }
    return graphLayoutPositions;
  }, [scoutArena, graphLayoutPositions]);

  const mapViewBox = scoutArena?.viewBox ?? baseLayout.viewBox;
  const spawnPoint = scoutArena?.anchor ?? graphSpawnPoint;

  const applySpawnPoint = useCallback(() => {
    if (compact) return;
    playerWorldX.value = spawnPoint.x;
    playerWorldY.value = spawnPoint.y;
    setPlayerPos({ x: spawnPoint.x, y: spawnPoint.y });
  }, [compact, spawnPoint.x, spawnPoint.y, playerWorldX, playerWorldY]);

  const revealed = useMemo(
    () => buildRevealedSet(graph, encounterPath, focusedNodeIds),
    [graph, encounterPath, focusedNodeIds],
  );
  const interactiveIds = useMemo(() => new Set(cluster.map((n) => n.id)), [cluster]);

  const scoutNodes: ScoutNode[] = useMemo(() => {
    return cluster
      .filter((node) => interactiveIds.has(node.id))
      .map((node) => {
        const base = layoutPositions[node.id];
        if (!base) return null;
        const graphNode = graph.nodes[node.id];
        const nodeType = graphNode?.type ?? node.type;
        return {
          id: node.id,
          world: positionOverrides[node.id] ?? base,
          label: graphNode?.label ?? node.label ?? node.id,
          nodeType,
          isInteractive: interactive,
          isBoss: nodeType === 'BOSS_COMBAT' || graphNode?.isAnomalyNest === true,
          isAnchor: isSafeAnchorNode(nodeType, node.id),
        };
      })
      .filter((node): node is ScoutNode => node != null);
  }, [cluster, graph, interactive, interactiveIds, layoutPositions, positionOverrides]);

  useEffect(() => {
    manifestedRef.current = manifestedIds;
    onManifestedIdsChange?.([...manifestedIds]);
  }, [manifestedIds, onManifestedIdsChange]);

  useEffect(() => {
    revealedOnMapRef.current = revealedOnMapIds;
  }, [revealedOnMapIds]);

  useEffect(() => {
    sensorDetectedRef.current = sensorDetectedIds;
  }, [sensorDetectedIds]);

  useEffect(() => {
    if (compact) return;
    onScoutProgressChange?.(sensorDetectedIds.size, scoutNodes.length);
  }, [compact, sensorDetectedIds, scoutNodes.length, onScoutProgressChange]);

  const layoutSessionRef = useRef(layoutRollKey);

  useEffect(() => {
    if (compact || layoutRollKey == null) return;
    if (layoutSessionRef.current !== layoutRollKey) {
      layoutSessionRef.current = layoutRollKey;
      setArenaRoll(Math.random());
      setRevealedOnMapIds(new Set());
      setSensorDetectedIds(new Set());
      setManifestedIds(new Set());
      setRegistryIds(new Set());
      resonanceLoggedRef.current = new Set();
    }
  }, [compact, layoutRollKey]);

  useEffect(() => {
    overridesRef.current = positionOverrides;
  }, [positionOverrides]);

  useEffect(() => {
    scoutNodesRef.current = scoutNodes;
  }, [scoutNodes]);

  useEffect(() => {
    facingRef.current = facing;
  }, [facing]);

  const depthSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (scoutArena) {
      const bounds = scoutArenaWorldBounds(scoutArena.viewBox);
      setCorridorBounds(bounds);
      setCorridorWalls([]);
      boundsShared.value = bounds;
      return;
    }
    const corridor = buildDepthCorridor(
      graph,
      layoutPositions,
      resolvedCurrentId,
      cluster,
      vaporizedWalls,
    );
    setCorridorBounds(corridor.bounds);
    setCorridorWalls(corridor.walls);
    boundsShared.value = corridor.bounds;
  }, [scoutArena, graph, layoutPositions, resolvedCurrentId, cluster, vaporizedWalls, boundsShared]);

  useEffect(() => {
    const session = `${resolvedCurrentId}:${nodesCleared}`;
    if (depthSessionRef.current !== session) {
      depthSessionRef.current = session;
      setArenaRoll(Math.random());
      resonanceLoggedRef.current = new Set();
      setManifestedIds(new Set());
      setRevealedOnMapIds(new Set());
      setSensorDetectedIds(new Set());
      setRegistryIds(new Set());
      setPositionOverrides({});
      setVaporizedWalls(new Set());
    }
    applySpawnPoint();
  }, [resolvedCurrentId, nodesCleared, applySpawnPoint]);

  useEffect(() => {
    applySpawnPoint();
  }, [applySpawnPoint, scoutArena?.anchor.x, scoutArena?.anchor.y]);

  useEffect(() => {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return;
    const base = resolveMapDrawMetrics(
      canvasSize.width,
      canvasSize.height,
      mapViewBox.width,
      mapViewBox.height,
      'contain',
    );
    worldScale.value = base.scale * (compact ? 1 : WORLD_ZOOM);
  }, [canvasSize, mapViewBox, compact, worldScale]);

  const handleFacing = useCallback((dx: number, dy: number) => {
    setFacing(resolveMovementFacing(dx, dy));
  }, []);

  const syncBlindScout = useCallback((x: number, y: number) => {
    setPlayerPos({ x, y });
    if (hubMode) {
      if (hubInteractables.length === 0) {
        onNearHubInteractable?.(null);
        return;
      }
      let nearestId: string | null = null;
      let nearestDist = Infinity;
      hubInteractables.forEach((spot) => {
        const dist = Math.hypot(spot.x - x, spot.y - y);
        if (dist <= spot.radius && dist < nearestDist) {
          nearestDist = dist;
          nearestId = spot.id;
        }
      });
      onNearHubInteractable?.(nearestId);
      return;
    }
    const player = { x, y };
    const blips: ScoutTarget[] = [];
    const hiddenDistances: number[] = [];
    const newlyRevealed: string[] = [];
    const newlyDetected: string[] = [];
    let ghostBlipPos: { x: number; y: number } | null = null;
    let ghostNearestDistance = Infinity;
    const scannerCenter = LEY_TRACKER_SIZE / 2;
    const scannerEdgeR = leyTrackerMaxCanvasRadius(LEY_TRACKER_SIZE);

    scoutNodesRef.current.forEach((node) => {
      const baseWorld = layoutPositions[node.id] ?? node.world;
      const world = overridesRef.current[node.id] ?? baseWorld;
      const dx = world.x - x;
      const dy = world.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const distanceMeters = layoutToMeters(distance);
      const manifested = manifestedRef.current.has(node.id);
      const revealedOnMap = revealedOnMapRef.current.has(node.id);
      const phase = resolveScoutPhase(distance, manifested);

      if (!manifested) {
        hiddenDistances.push(distance);
      }

      if (phase === 'STABILIZED' && !manifested && !revealedOnMap) {
        newlyRevealed.push(node.id);
      }

      const showOnScanner = phase === 'BLIP'
        || phase === 'STABILIZED'
        || phase === 'MANIFESTED'
        || revealedOnMap
        || manifested;

      if (showOnScanner) {
        const { angle, radius } = worldToRadarBlip(baseWorld, player);
        const outOfSensor = distance > SENSOR_RANGE_LAYOUT;
        const displayRadius = (revealedOnMap || manifested) && outOfSensor
          ? SCANNER_EDGE_RADIUS_NORM
          : radius;
        const scannerPhase = manifested
          ? 'MANIFESTED'
          : phase === 'BLIP' && !revealedOnMap
            ? 'BLIP'
            : 'STABILIZED';

        blips.push({
          id: node.id,
          world: baseWorld,
          distance,
          distanceMeters,
          phase: scannerPhase,
          blinking: scannerPhase === 'BLIP',
          radarAngle: angle,
          radarRadius: displayRadius,
        });
      }

      if (phase === 'STABILIZED' && !manifested) {
        if (!resonanceLoggedRef.current.has(node.id)) {
          resonanceLoggedRef.current.add(node.id);
          onFrequencyMatch?.(node.id, distanceMeters);
        }
      }

      if (phase !== 'VOID' && !sensorDetectedRef.current.has(node.id)) {
        newlyDetected.push(node.id);
      }

      if (phase === 'VOID' && !manifested && distance < ghostNearestDistance) {
        ghostNearestDistance = distance;
        const { angle } = worldToRadarBlip(baseWorld, player);
        ghostBlipPos = {
          x: scannerCenter + Math.cos(angle) * scannerEdgeR,
          y: scannerCenter + Math.sin(angle) * scannerEdgeR,
        };
      }
    });

    if (newlyRevealed.length > 0) {
      setRevealedOnMapIds((prev) => new Set([...prev, ...newlyRevealed]));
    }

    if (newlyDetected.length > 0) {
      setSensorDetectedIds((prev) => new Set([...prev, ...newlyDetected]));
    }

    const voidNodesRemain = scoutNodesRef.current.some((node) => {
      const baseWorld = layoutPositions[node.id] ?? node.world;
      const world = overridesRef.current[node.id] ?? baseWorld;
      const distance = Math.hypot(world.x - x, world.y - y);
      return resolveScoutPhase(distance, manifestedRef.current.has(node.id)) === 'VOID';
    });
    setGhostRadarBlip(voidNodesRemain ? ghostBlipPos : null);
    setRadarBlips(blips);
    setScanlineIntensity(resolveNearestScoutIntensity(hiddenDistances));

    const pickupRadius = collectVeilEchoRadius();
    overworldSession.veilEchoes.forEach((echo) => {
      if (echo.collected || !onCollectVeilEcho) return;
      const dist = Math.hypot(echo.world.x - x, echo.world.y - y);
      if (dist <= pickupRadius) onCollectVeilEcho(echo.id);
    });
    overworldSession.rawLeyBoons.forEach((boon) => {
      if (boon.claimed || !onAcquireRawLeyBoon) return;
      const dist = Math.hypot(boon.world.x - x, boon.world.y - y);
      if (dist <= pickupRadius) onAcquireRawLeyBoon(boon.id);
    });
  }, [
    hubMode,
    hubInteractables,
    onNearHubInteractable,
    layoutPositions,
    onAcquireRawLeyBoon,
    onCollectVeilEcho,
    onFrequencyMatch,
    overworldSession.rawLeyBoons,
    overworldSession.veilEchoes,
  ]);

  const manifestNode = useCallback((nodeId: string, world: SectorGraphLayoutPoint, node: ScoutNode) => {
    manifestedRef.current = new Set([...manifestedRef.current, nodeId]);
    setManifestedIds((prev) => new Set([...prev, nodeId]));
    setRevealedOnMapIds((prev) => new Set([...prev, nodeId]));
    setSensorDetectedIds((prev) => new Set([...prev, nodeId]));
    setPositionOverrides((prev) => ({ ...prev, [nodeId]: world }));
    setTearActive(true);
    const logLine = formatRiftManifestLog(node.nodeType, node.label);
    onNodeManifest?.(nodeId, logLine);
    onNodePress?.(nodeId);
    syncBlindScout(playerPos.x, playerPos.y);
  }, [onNodeManifest, onNodePress, playerPos.x, playerPos.y, syncBlindScout]);

  const handleHazardTick = useCallback((x: number, y: number, deltaMs: number) => {
    if (!onTickOverworldHazards) return;
    const result = onTickOverworldHazards({ x, y }, deltaMs);
    if (result.gridHoundCaught) {
      onGridHoundCaught?.();
    }
  }, [onGridHoundCaught, onTickOverworldHazards]);

  useFrameCallback((frameInfo) => {
    'worklet';
    if (compact) return;

    const dtMs = frameInfo.timeSincePreviousFrame ?? 16.667;
    const mag = Math.hypot(joystickX.value, joystickY.value);
    if (mag >= 0.08) {
      const nx = joystickX.value / mag;
      const ny = joystickY.value / mag;
      const step = MOVE_SPEED_UNITS_PER_SEC * (dtMs / 1000);
      const next = clampToWorldBounds(
        playerWorldX.value + nx * step,
        playerWorldY.value + ny * step,
        boundsShared.value,
      );
      playerWorldX.value = next.x;
      playerWorldY.value = next.y;
      runOnJS(handleFacing)(nx, ny);
    }
    if (!hubMode) {
      runOnJS(handleHazardTick)(playerWorldX.value, playerWorldY.value, dtMs);
    }
  });

  useAnimatedReaction(
    () => ({ x: playerWorldX.value, y: playerWorldY.value }),
    (pos, prev) => {
      if (prev && pos.x === prev.x && pos.y === prev.y) return;
      runOnJS(syncBlindScout)(pos.x, pos.y);
    },
    [syncBlindScout],
  );

  const worldTransform = useDerivedValue(() => [
    { translateX: canvasWidth.value / 2 },
    { translateY: canvasHeight.value / 2 },
    { scale: worldScale.value },
    { translateX: -playerWorldX.value },
    { translateY: -playerWorldY.value },
  ]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ width, height });
    canvasWidth.value = width;
    canvasHeight.value = height;
  };

  useEffect(() => {
    if (patrolState.blipCount === 0) {
      setPatrolDriftRad(0);
      return;
    }

    let rafId: number | null = null;
    let lastTs: number | null = null;

    const tick = (ts: number) => {
      const prev = lastTs ?? ts;
      const deltaMs = Math.min(32, ts - prev);
      lastTs = ts;
      setPatrolDriftRad((rad) => rad + (
        PATROL_DRIFT_RAD_PER_SEC * patrolState.speedMultiplier * deltaMs
      ) / 1000);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [patrolState.blipCount, patrolState.speedMultiplier]);

  const effectiveScale = canvasSize.width > 0
    ? resolveMapDrawMetrics(
      canvasSize.width,
      canvasSize.height,
      mapViewBox.width,
      mapViewBox.height,
      'contain',
    ).scale * (compact ? 1 : WORLD_ZOOM)
    : WORLD_ZOOM;

  const visibleRadarDots = useMemo(() => {
    const blipById = new Map(radarBlips.map((blip) => [blip.id, blip]));
    const center = LEY_TRACKER_SIZE / 2;
    const maxR = leyTrackerMaxCanvasRadius(LEY_TRACKER_SIZE);

    const riftDots = vectorDots
      .filter((dot) => blipById.has(dot.id))
      .map((dot) => {
        const blip = blipById.get(dot.id)!;
        const r = blip.radarRadius * maxR;
        const x = center + Math.cos(blip.radarAngle) * r;
        const y = center + Math.sin(blip.radarAngle) * r;
        return {
          ...dot,
          x,
          y,
          angleDeg: bearingFromCanvasCenter(LEY_TRACKER_SIZE, x, y),
        };
      });

    const patrolDots = buildPatrolRadarDots(
      patrolState,
      LEY_TRACKER_SIZE,
      patrolDriftRad,
    );

    return [...riftDots, ...patrolDots];
  }, [radarBlips, vectorDots, patrolState, patrolDriftRad]);

  const revealedMapNodes = useMemo(() => {
    if (compact) return [];
    return scoutNodes.filter((node) => revealedOnMapIds.has(node.id) && !manifestedIds.has(node.id));
  }, [compact, scoutNodes, revealedOnMapIds, manifestedIds]);

  const stabilizedTapNodes = useMemo(() => {
    if (compact) return [];
    return scoutNodes.filter((node) => {
      if (manifestedIds.has(node.id)) return false;
      const baseWorld = layoutPositions[node.id] ?? node.world;
      const distance = Math.hypot(baseWorld.x - playerPos.x, baseWorld.y - playerPos.y);
      return resolveScoutPhase(distance, false) === 'STABILIZED';
    });
  }, [compact, scoutNodes, manifestedIds, layoutPositions, playerPos]);

  const manifestedNodes = compact
    ? scoutNodes
    : scoutNodes.filter((node) => manifestedIds.has(node.id));

  const handleStabilizedTap = useCallback((nodeId: string) => {
    const node = scoutNodesRef.current.find((n) => n.id === nodeId);
    if (!node || manifestedRef.current.has(nodeId)) return;
    const baseWorld = layoutPositions[nodeId] ?? node.world;
    manifestNode(nodeId, baseWorld, node);
    setRegistryIds((prev) => new Set([...prev, nodeId]));
  }, [layoutPositions, manifestNode]);

  const handleManifestedTap = useCallback((nodeId: string) => {
    if (!manifestedRef.current.has(nodeId)) return;
    setRegistryIds((prev) => new Set([...prev, nodeId]));
    onNodePress?.(nodeId);
  }, [onNodePress]);

  const handleRegistrySelect = useCallback((nodeId: string) => {
    if (!manifestedRef.current.has(nodeId)) return;
    onNodePress?.(nodeId);
  }, [onNodePress]);

  const handleDirectedPing = useCallback(() => {
    if (!onDirectedPing) return;
    onDirectedPing(facingRef.current);
    const origin = { x: playerPos.x, y: playerPos.y };
    const facingRad = facingRadFromAegis(facingRef.current);
    const revealed = new Set<string>();
    scoutNodesRef.current.forEach((node) => {
      const world = overridesRef.current[node.id]
        ?? layoutPositions[node.id]
        ?? node.world;
      if (isInDirectedPingCone(origin, facingRad, world, DIRECTED_PING_RANGE, DIRECTED_PING_CONE_RAD)) {
        revealed.add(node.id);
      }
    });
    if (revealed.size > 0) {
      setRevealedOnMapIds((prev) => {
        const next = new Set(prev);
        revealed.forEach((id) => next.add(id));
        return next;
      });
      setRegistryIds((prev) => {
        const next = new Set(prev);
        revealed.forEach((id) => next.add(id));
        return next;
      });
    }
    setPingRevealIds(revealed);
    setTimeout(() => setPingRevealIds(new Set()), 2400);
  }, [layoutPositions, onDirectedPing, playerPos]);

  const registryEntries = useMemo(() => {
    return scoutNodes
      .filter((node) => registryIds.has(node.id))
      .map((node) => ({
        id: node.id,
        label: node.label,
        manifested: manifestedIds.has(node.id),
      }));
  }, [scoutNodes, registryIds, manifestedIds]);

  const districtOverlayColor = DISTRICT_ATMOSPHERE_OVERLAY[currentDistrict];

  const renderRiftNodes = useMemo((): Array<{ node: ScoutNode; manifested: boolean }> => {
    if (compact) {
      return scoutNodes.map((node) => ({ node, manifested: true }));
    }
    return [
      ...revealedMapNodes.map((node) => ({ node, manifested: false })),
      ...manifestedNodes.map((node) => ({ node, manifested: true })),
    ];
  }, [compact, scoutNodes, revealedMapNodes, manifestedNodes]);

  return (
    <View
      style={[styles.root, compact ? styles.rootCompact : styles.rootFull]}
      onLayout={handleLayout}
    >
      <View style={styles.radarHost}>
        {!compact && mapStatusText ? (
          <View style={styles.mapStatusOverlay} pointerEvents="none">
            <Text style={styles.mapStatusText}>{mapStatusText}</Text>
          </View>
        ) : null}

        {canvasSize.width > 0 && canvasSize.height > 0 ? (
          <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
            <Group transform={worldTransform}>
              <OverworldTerrainBackdrop
                viewBoxWidth={mapViewBox.width}
                viewBoxHeight={mapViewBox.height}
              />
              {!compact && districtOverlayColor ? (
                <Rect
                  x={0}
                  y={0}
                  width={mapViewBox.width}
                  height={mapViewBox.height}
                  color={districtOverlayColor}
                />
              ) : null}
              <FogCorridorMask
                viewBoxWidth={mapViewBox.width}
                viewBoxHeight={mapViewBox.height}
                corridor={corridorBounds}
              />

              {corridorWalls.map((wall) => {
                const vaporized = vaporizedWalls.has(wall.id);
                return (
                  <Line
                    key={wall.id}
                    p1={vec(wall.x1, wall.y1)}
                    p2={vec(wall.x2, wall.y2)}
                    color="rgba(0, 255, 51, 0.42)"
                    strokeWidth={2}
                    opacity={vaporized ? wallShred : 0.88}
                  >
                    <DashPathEffect intervals={[5, 8]} />
                  </Line>
                );
              })}

              {compact ? baseLayout.edges.map((edge) => {
                if (!revealed.has(edge.fromId) && !revealed.has(edge.toId)) return null;
                const from = layoutPositions[edge.fromId];
                const to = layoutPositions[edge.toId];
                if (!from || !to) return null;
                return (
                  <Line
                    key={`${edge.fromId}-${edge.toId}`}
                    p1={vec(from.x, from.y)}
                    p2={vec(to.x, to.y)}
                    color="rgba(0, 255, 51, 0.14)"
                    strokeWidth={1}
                    opacity={0.35}
                  />
                );
              }) : null}

              {!hubMode ? overworldSession.resonancePockets.map((pocket) => (
                <Circle
                  key={pocket.id}
                  cx={pocket.world.x}
                  cy={pocket.world.y}
                  r={pocket.radius}
                  color="rgba(255, 48, 48, 0.14)"
                />
              )) : null}

              {!hubMode ? overworldSession.veilEchoes.filter((e) => !e.collected).map((echo) => (
                <Circle
                  key={echo.id}
                  cx={echo.world.x}
                  cy={echo.world.y}
                  r={18}
                  color="rgba(0, 255, 120, 0.38)"
                />
              )) : null}

              {!hubMode ? overworldSession.rawLeyBoons.filter((b) => !b.claimed).map((boon) => (
                <Circle
                  key={boon.id}
                  cx={boon.world.x}
                  cy={boon.world.y}
                  r={22}
                  color="rgba(168, 85, 247, 0.42)"
                />
              )) : null}

              {!hubMode && overworldSession.gridHound?.active && !overworldSession.gridHound.caught ? (
                <Group>
                  <Circle
                    cx={overworldSession.gridHound.world.x}
                    cy={overworldSession.gridHound.world.y}
                    r={28}
                    color="rgba(255, 40, 40, 0.75)"
                  />
                  <Line
                    p1={vec(
                      overworldSession.gridHound.world.x,
                      overworldSession.gridHound.world.y,
                    )}
                    p2={vec(
                      overworldSession.gridHound.world.x
                        + Math.cos(overworldSession.gridHound.facingRad) * 180,
                      overworldSession.gridHound.world.y
                        + Math.sin(overworldSession.gridHound.facingRad) * 180,
                    )}
                    color="rgba(255, 80, 80, 0.45)"
                    strokeWidth={3}
                  />
                </Group>
              ) : null}

              {!hubMode ? renderRiftNodes.map(({ node, manifested }) => {
                const world = layoutPositions[node.id] ?? node.world;
                const drawWorld = manifested
                  ? (positionOverrides[node.id] ?? world)
                  : world;
                const radius = node.isBoss ? NODE_RADIUS.boss : NODE_RADIUS.default;
                const isSelected = node.id === selectedNodeId;
                return (
                  <ProceduralRiftSkia
                    key={node.id}
                    cx={drawWorld.x}
                    cy={drawWorld.y}
                    radius={radius}
                    nodeType={node.nodeType}
                    isBoss={node.isBoss}
                    intensity={manifested ? 1 : 0.42}
                    locked={manifested && isSelected}
                    selected={isSelected}
                    pulse={!manifested && !isSelected}
                  />
                );
              }) : null}
            </Group>
          </Canvas>
        ) : null}

        {!compact && !hubMode ? (
          <ProximityScanlineOverlay
            width={canvasSize.width}
            height={canvasSize.height}
            intensity={scanlineIntensity}
          />
        ) : null}

        <View pointerEvents="none" style={styles.walkerSlot}>
          <Image source={FACING_SOURCE[facing]} style={styles.walkerImage} resizeMode="contain" />
        </View>

        {!compact && hubMode ? hubInteractables.map((spot) => {
          const screen = worldToScreen(
            { x: spot.x, y: spot.y },
            playerPos,
            canvasSize.width,
            canvasSize.height,
            effectiveScale,
          );
          return (
            <Pressable
              key={spot.id}
              style={[
                styles.hubInteractableHit,
                {
                  left: screen.x - 36,
                  top: screen.y - 36,
                },
              ]}
              onPress={() => onHubInteractablePress?.(spot.id)}
            >
              <Text style={styles.hubInteractableLabel}>{spot.label}</Text>
            </Pressable>
          );
        }) : null}

        {!compact && !hubMode ? stabilizedTapNodes.map((node) => {
          const world = layoutPositions[node.id] ?? node.world;
          const screen = worldToScreen(
            world,
            playerPos,
            canvasSize.width,
            canvasSize.height,
            effectiveScale,
          );
          return (
            <Pressable
              key={`stabilized-${node.id}`}
              style={[
                styles.riftHit,
                {
                  left: screen.x - RIFT_HIT_SIZE / 2,
                  top: screen.y - RIFT_HIT_SIZE / 2,
                },
              ]}
              onPress={() => handleStabilizedTap(node.id)}
            />
          );
        }) : null}

        {!compact && !hubMode ? manifestedNodes.map((node) => {
          const world = positionOverrides[node.id]
            ?? layoutPositions[node.id]
            ?? node.world;
          const screen = worldToScreen(
            world,
            playerPos,
            canvasSize.width,
            canvasSize.height,
            effectiveScale,
          );
          return (
            <Pressable
              key={`manifested-${node.id}`}
              style={[
                styles.riftHit,
                {
                  left: screen.x - RIFT_HIT_SIZE / 2,
                  top: screen.y - RIFT_HIT_SIZE / 2,
                },
              ]}
              onPress={() => handleManifestedTap(node.id)}
            />
          );
        }) : null}

        {!compact && !hubMode ? (
          <FixedLeyTrackerHud
            cabal={cabal}
            zoneTint={zoneTint}
            vectorDots={visibleRadarDots}
            proximityGhost={ghostRadarBlip}
            selectedNodeId={selectedNodeId}
            registryEntries={registryEntries}
            onRegistrySelect={handleRegistrySelect}
          />
        ) : null}
        {!compact ? <VirtualJoystick vectorX={joystickX} vectorY={joystickY} /> : null}

        {!compact && !hubMode && onDirectedPing ? (
          <Pressable style={styles.pingBtn} onPress={handleDirectedPing}>
            <Text style={styles.pingBtnText}>[ PING ]</Text>
          </Pressable>
        ) : null}

        {!compact && pingRevealIds.size > 0 ? (
          <View style={styles.pingFlash} pointerEvents="none">
            <Text style={styles.pingFlashText}>ECHO LOCK // {pingRevealIds.size} SIGNATURE(S)</Text>
          </View>
        ) : null}

        <DimensionalTearOverlay
          active={tearActive}
          onComplete={() => setTearActive(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: SLATE_BLACK,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.22)',
  },
  rootFull: {
    flex: 1,
    minHeight: 220,
  },
  rootCompact: {
    height: 140,
  },
  radarHost: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  mapStatusOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '72%',
  },
  mapStatusText: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
    color: '#94a3b8',
  },
  walkerSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  walkerImage: {
    width: PLAYER_SPRITE_W,
    height: PLAYER_SPRITE_H,
  },
  riftHit: {
    position: 'absolute',
    width: RIFT_HIT_SIZE,
    height: RIFT_HIT_SIZE,
    zIndex: 12,
    borderRadius: RIFT_HIT_SIZE / 2,
  },
  pingBtn: {
    position: 'absolute',
    left: 10 + LEY_TRACKER_SIZE + 8,
    bottom: 10,
    zIndex: 17,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.55)',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pingBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    color: '#00ff33',
    letterSpacing: 0.5,
  },
  pingFlash: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    zIndex: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pingFlashText: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: '#86efac',
    letterSpacing: 0.6,
  },
  hubInteractableHit: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.55)',
    backgroundColor: 'rgba(0, 255, 51, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  hubInteractableLabel: {
    fontFamily: 'monospace',
    fontSize: 6,
    fontWeight: '700',
    color: '#00ff33',
    letterSpacing: 0.4,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
