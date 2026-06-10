import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  Canvas,
  DashPathEffect,
  Group,
  Line,
  vec,
} from '@shopify/react-native-skia';
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
  resolveNearestScoutIntensity,
  resolveScoutPhase,
  worldToRadarBlip,
  type ScoutTarget,
} from '../utils/overworldBlindScout';
import {
  buildDepthCorridor,
  positionInFrontOfWalker,
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
import { BlueprintStreetGrid } from './overworld/SonarRadarBackdrop';
import VirtualJoystick from './overworld/VirtualJoystick';

import AegisForward from '../../assets/images/character images/aegis/aegis-forward.png';
import AegisBack from '../../assets/images/character images/aegis/aegis-back.png';
import AegisLeft from '../../assets/images/character images/aegis/aegis-left.png';
import AegisRight from '../../assets/images/character images/aegis/aegis-right.png';

const WORLD_ZOOM = 4;
const MOVE_SPEED = 0.85;
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

function facingVector(facing: AegisFacing): { x: number; y: number } {
  switch (facing) {
    case 'back': return { x: 0, y: -1 };
    case 'forward': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    default: return { x: 0, y: -1 };
  }
}

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
  cabal?: ScannerCabal;
  zoneTint?: Partial<CabalScannerTheme>;
  selectedNodeId?: string | null;
  zoneLineColor?: string;
  accentColor?: string;
  onNodePress?: (nodeId: string) => void;
  onFrequencyMatch?: (nodeId: string, distanceMeters: number) => void;
  onNodeManifest?: (nodeId: string, logLine: string) => void;
  onManifestedIdsChange?: (ids: readonly string[]) => void;
  compact?: boolean;
  interactive?: boolean;
}

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
  cabal = 'TERRAN_GRID',
  zoneTint,
  selectedNodeId = null,
  onNodePress,
  onFrequencyMatch,
  onNodeManifest,
  onManifestedIdsChange,
  compact = false,
  interactive = true,
}: SectorOverworldMapProps): React.JSX.Element {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [facing, setFacing] = useState<AegisFacing>('back');
  const [manifestedIds, setManifestedIds] = useState<Set<string>>(() => new Set());
  const [positionOverrides, setPositionOverrides] = useState<Record<string, SectorGraphLayoutPoint>>({});
  const [vaporizedWalls, setVaporizedWalls] = useState<Set<string>>(() => new Set());
  const [corridorBounds, setCorridorBounds] = useState({ minX: 0, maxX: 320, minY: 0, maxY: 400 });
  const [corridorWalls, setCorridorWalls] = useState<BoundaryWall[]>([]);
  const [radarBlips, setRadarBlips] = useState<ScoutTarget[]>([]);
  const [playerPos, setPlayerPos] = useState<SectorGraphLayoutPoint>({ x: 0, y: 0 });
  const [tearActive, setTearActive] = useState(false);
  const [scanlineIntensity, setScanlineIntensity] = useState(0);

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
  const overridesRef = useRef<Record<string, SectorGraphLayoutPoint>>({});
  const facingRef = useRef<AegisFacing>('back');

  const baseLayout = useMemo(() => projectSectorGraphLayout(graph), [graph]);
  const ephemeralPositions = useMemo(
    () => projectClusterEphemerals(cluster, graph, baseLayout, currentNodeId),
    [cluster, graph, baseLayout, currentNodeId],
  );

  const resolvedCurrentId = graph.nodes[currentNodeId] ? currentNodeId : graph.entryId;
  const scoutSessionKey = `${resolvedCurrentId}:${nodesCleared}`;

  const graphLayoutPositions = useMemo(
    () => mergeLayoutPositions(baseLayout.positions, ephemeralPositions),
    [baseLayout.positions, ephemeralPositions],
  );

  const graphSpawnPoint = graphLayoutPositions[resolvedCurrentId]
    ?? graphLayoutPositions[graph.entryId]
    ?? { x: baseLayout.viewBox.width / 2, y: baseLayout.viewBox.height * 0.75 };

  const scoutArena = useMemo(() => {
    if (compact) return null;
    return buildScoutArenaLayout(cluster, graphSpawnPoint, scoutSessionKey);
  }, [compact, cluster, graphSpawnPoint, scoutSessionKey]);

  const layoutPositions = useMemo(() => {
    if (scoutArena) {
      return { ...graphLayoutPositions, ...scoutArena.positions };
    }
    return graphLayoutPositions;
  }, [scoutArena, graphLayoutPositions]);

  const mapViewBox = scoutArena?.viewBox ?? baseLayout.viewBox;
  const spawnPoint = scoutArena?.anchor ?? graphSpawnPoint;

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
    overridesRef.current = positionOverrides;
  }, [positionOverrides]);

  useEffect(() => {
    scoutNodesRef.current = scoutNodes;
  }, [scoutNodes]);

  useEffect(() => {
    facingRef.current = facing;
  }, [facing]);

  const depthSessionRef = useRef(`${resolvedCurrentId}:${nodesCleared}`);

  useEffect(() => {
    if (scoutArena) {
      const bounds = scoutArenaWorldBounds(scoutArena.anchor, scoutArena.viewBox);
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
    if (depthSessionRef.current === session) return;
    depthSessionRef.current = session;
    playerWorldX.value = spawnPoint.x;
    playerWorldY.value = spawnPoint.y;
    resonanceLoggedRef.current = new Set();
    setManifestedIds(new Set());
    setPositionOverrides({});
    setVaporizedWalls(new Set());
    setPlayerPos(spawnPoint);
  }, [resolvedCurrentId, nodesCleared, spawnPoint.x, spawnPoint.y, playerWorldX, playerWorldY]);

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

  const manifestNode = useCallback((nodeId: string, world: SectorGraphLayoutPoint, node: ScoutNode) => {
    setManifestedIds((prev) => new Set([...prev, nodeId]));
    setPositionOverrides((prev) => ({ ...prev, [nodeId]: world }));
    setTearActive(true);
    const logLine = formatRiftManifestLog(node.nodeType, node.label);
    onNodeManifest?.(nodeId, logLine);
    onNodePress?.(nodeId);
  }, [onNodeManifest, onNodePress]);

  const syncBlindScout = useCallback((x: number, y: number) => {
    setPlayerPos({ x, y });
    const player = { x, y };
    const blips: ScoutTarget[] = [];
    const hiddenDistances: number[] = [];

    scoutNodesRef.current.forEach((node) => {
      const baseWorld = layoutPositions[node.id] ?? node.world;
      const world = overridesRef.current[node.id] ?? baseWorld;
      const dx = world.x - x;
      const dy = world.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const distanceMeters = layoutToMeters(distance);
      const manifested = manifestedRef.current.has(node.id);
      const phase = resolveScoutPhase(distance, manifested);

      if (!manifested) {
        hiddenDistances.push(distance);
      }

      if (phase === 'BLIP' || phase === 'STABILIZED') {
        const { angle, radius } = worldToRadarBlip(baseWorld, player);
        blips.push({
          id: node.id,
          world: baseWorld,
          distance,
          distanceMeters,
          phase,
          blinking: phase === 'BLIP',
          radarAngle: angle,
          radarRadius: radius,
        });
      }

      if (phase === 'STABILIZED' && !manifested) {
        if (!resonanceLoggedRef.current.has(node.id)) {
          resonanceLoggedRef.current.add(node.id);
          onFrequencyMatch?.(node.id, distanceMeters);
        }
      }
    });

    setRadarBlips(blips);
    setScanlineIntensity(resolveNearestScoutIntensity(hiddenDistances));
  }, [layoutPositions, onFrequencyMatch]);

  useFrameCallback(() => {
    'worklet';
    if (compact) return;

    const mag = Math.hypot(joystickX.value, joystickY.value);
    if (mag < 0.08) return;

    const nx = joystickX.value / mag;
    const ny = joystickY.value / mag;
    const step = mag * MOVE_SPEED;
    const next = clampToWorldBounds(
      playerWorldX.value + nx * step,
      playerWorldY.value + ny * step,
      boundsShared.value,
    );
    playerWorldX.value = next.x;
    playerWorldY.value = next.y;
    runOnJS(handleFacing)(nx, ny);
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
    syncBlindScout(spawnPoint.x, spawnPoint.y);
  }, [spawnPoint.x, spawnPoint.y, syncBlindScout]);

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
    const maxR = center - 20;

    return vectorDots
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
  }, [radarBlips, vectorDots]);

  const stabilizedNodes = useMemo(() => {
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
    const dir = facingVector(facingRef.current);
    const snap = positionInFrontOfWalker(playerPos.x, playerPos.y, dir.x, dir.y, 46);
    manifestNode(nodeId, snap, node);
  }, [manifestNode, playerPos.x, playerPos.y]);

  const handleManifestedTap = useCallback((nodeId: string) => {
    if (!manifestedRef.current.has(nodeId)) return;
    onNodePress?.(nodeId);
  }, [onNodePress]);

  const renderRiftNodes = useMemo((): Array<{ node: ScoutNode; manifested: boolean }> => {
    if (compact) {
      return scoutNodes.map((node) => ({ node, manifested: true }));
    }
    return [
      ...stabilizedNodes.map((node) => ({ node, manifested: false })),
      ...manifestedNodes.map((node) => ({ node, manifested: true })),
    ];
  }, [compact, scoutNodes, stabilizedNodes, manifestedNodes]);

  return (
    <View
      style={[styles.root, compact ? styles.rootCompact : styles.rootFull]}
      onLayout={handleLayout}
    >
      <View style={styles.radarHost}>
        {canvasSize.width > 0 && canvasSize.height > 0 ? (
          <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
            <Group transform={worldTransform}>
              <BlueprintStreetGrid
                viewBoxWidth={mapViewBox.width}
                viewBoxHeight={mapViewBox.height}
              />
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

              {renderRiftNodes.map(({ node, manifested }) => {
                const world = manifested
                  ? (positionOverrides[node.id] ?? node.world)
                  : (layoutPositions[node.id] ?? node.world);
                const radius = node.isBoss ? NODE_RADIUS.boss : NODE_RADIUS.default;
                return (
                  <ProceduralRiftSkia
                    key={node.id}
                    cx={world.x}
                    cy={world.y}
                    radius={radius}
                    nodeType={node.nodeType}
                    isBoss={node.isBoss}
                    intensity={manifested ? 1 : 0.42}
                    locked={manifested && node.id === selectedNodeId}
                    pulse={!manifested}
                  />
                );
              })}
            </Group>
          </Canvas>
        ) : null}

        {!compact ? (
          <ProximityScanlineOverlay
            width={canvasSize.width}
            height={canvasSize.height}
            intensity={scanlineIntensity}
          />
        ) : null}

        <View pointerEvents="none" style={styles.walkerSlot}>
          <Image source={FACING_SOURCE[facing]} style={styles.walkerImage} resizeMode="contain" />
        </View>

        {!compact ? stabilizedNodes.map((node) => {
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

        {!compact ? manifestedNodes.map((node) => {
          const world = positionOverrides[node.id] ?? node.world;
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

        {!compact ? (
          <FixedLeyTrackerHud
            cabal={cabal}
            zoneTint={zoneTint}
            vectorDots={visibleRadarDots}
            selectedNodeId={selectedNodeId}
          />
        ) : null}
        {!compact ? <VirtualJoystick vectorX={joystickX} vectorY={joystickY} /> : null}

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
});
