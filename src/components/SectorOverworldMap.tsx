import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { IncursionNode, RunNodeType } from '../types/game';
import type { SectorGraph } from '../types/sector';
import type { CabalScannerTheme } from '../types/scanner';
import {
  clampContentPanTranslation,
  resolveMapDrawMetrics,
  SECTOR_SELECT_HAPTIC_MS,
  viewBoxPointToCanvas,
} from '../utils/sectorInfluenceVisual';
import {
  mergeLayoutPositions,
  projectClusterEphemerals,
  projectSectorGraphLayout,
  resolveAegisFacing,
  type AegisFacing,
  type SectorGraphLayoutPoint,
} from '../utils/sectorGraphLayout';
import {
  buildRevealedSet,
  buildScanRangeSet,
  FOG_OPACITY,
  isEdgeDimmed,
  NODE_MARKER_OPACITY,
  nodeGlyphForType,
  resolveNodeVisibility,
} from '../utils/sectorGraphVisibility';
import ActiveNodeGlow from './overworld/ActiveNodeGlow';
import AnchorRiftVisual from './overworld/AnchorRiftVisual';
import { resolveOverworldPalette } from './overworld/overworldPalette';

import AegisForward from '../../assets/images/character images/aegis/aegis-forward.png';
import AegisBack from '../../assets/images/character images/aegis/aegis-back.png';
import AegisLeft from '../../assets/images/character images/aegis/aegis-left.png';
import AegisRight from '../../assets/images/character images/aegis/aegis-right.png';

const HIT_RADIUS = 30;
const START_ZOOM = 8.5;
const PLAYER_FOCUS_Y = 0.84;
const PLAYER_SPRITE_W = 42;
const PLAYER_SPRITE_H = 54;
const NODE_RADIUS = { default: 18, current: 20, boss: 24 } as const;
const PATH_DASH_CYCLE = 18;
const PARALLAX_DAMPING = 0.7;

const FACING_SOURCE: Record<AegisFacing, ImageSourcePropType> = {
  forward: AegisForward,
  back: AegisBack,
  left: AegisLeft,
  right: AegisRight,
};

function isSafeAnchorNode(
  nodeType: RunNodeType,
  nodeId: string,
): boolean {
  return nodeType === 'SAFE_ANCHOR_EXTRACTION' || nodeId.startsWith('safe-anchor');
}

export interface SectorOverworldMapProps {
  graph: SectorGraph;
  currentNodeId: string;
  encounterPath: IncursionNode[];
  focusedNodeIds: readonly string[];
  cluster: IncursionNode[];
  selectedNodeId?: string | null;
  zoneLineColor?: string;
  zoneTint?: Partial<CabalScannerTheme>;
  accentColor?: string;
  onNodePress?: (nodeId: string) => void;
  compact?: boolean;
  interactive?: boolean;
}

interface ScreenNode {
  id: string;
  screenX: number;
  screenY: number;
  glyph: string;
  nodeType: RunNodeType;
  visibility: ReturnType<typeof resolveNodeVisibility>;
  isCurrent: boolean;
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
  selectedNodeId = null,
  zoneLineColor = '#3f6212',
  zoneTint,
  onNodePress,
  compact = false,
  interactive = true,
}: SectorOverworldMapProps): React.JSX.Element {
  const palette = useMemo(() => resolveOverworldPalette(zoneTint), [zoneTint]);
  const labelAccent = palette.terminalGreen;

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [facing, setFacing] = useState<AegisFacing>('back');

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);
  const contentLeft = useSharedValue(0);
  const contentTop = useSharedValue(0);
  const contentRight = useSharedValue(0);
  const contentBottom = useSharedValue(0);
  const pathPhase = useSharedValue(0);

  const baseLayout = useMemo(() => projectSectorGraphLayout(graph), [graph]);
  const ephemeralPositions = useMemo(
    () => projectClusterEphemerals(cluster, graph, baseLayout, currentNodeId),
    [cluster, graph, baseLayout, currentNodeId],
  );
  const layoutPositions = useMemo(
    () => mergeLayoutPositions(baseLayout.positions, ephemeralPositions),
    [baseLayout.positions, ephemeralPositions],
  );

  const revealed = useMemo(
    () => buildRevealedSet(graph, encounterPath, focusedNodeIds),
    [graph, encounterPath, focusedNodeIds],
  );
  const scanRange = useMemo(() => buildScanRangeSet(cluster), [cluster]);
  const interactiveIds = useMemo(() => new Set(cluster.map((n) => n.id)), [cluster]);

  const resolvedCurrentId = graph.nodes[currentNodeId]
    ? currentNodeId
    : graph.entryId;

  const mapZoom = compact ? 1 : START_ZOOM;

  const drawMetrics = useMemo(() => {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) {
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }
    const base = resolveMapDrawMetrics(
      canvasSize.width,
      canvasSize.height,
      baseLayout.viewBox.width,
      baseLayout.viewBox.height,
      'contain',
    );
    return {
      scale: base.scale * mapZoom,
      offsetX: base.offsetX,
      offsetY: base.offsetY,
    };
  }, [canvasSize, baseLayout.viewBox, mapZoom]);

  const toScreen = useCallback(
    (point: SectorGraphLayoutPoint) => {
      const canvas = viewBoxPointToCanvas(point, drawMetrics);
      return { x: canvas.x, y: canvas.y };
    },
    [drawMetrics],
  );

  const currentLayoutPoint = layoutPositions[resolvedCurrentId] ?? { x: 0, y: 0 };
  const focusTargetId = selectedNodeId ?? resolvedCurrentId;
  const focusLayoutPoint = layoutPositions[focusTargetId] ?? currentLayoutPoint;

  useEffect(() => {
    if (!layoutPositions[focusTargetId] || !layoutPositions[resolvedCurrentId]) return;
    setFacing(resolveAegisFacing(
      layoutPositions[resolvedCurrentId],
      layoutPositions[focusTargetId],
    ));
  }, [focusTargetId, resolvedCurrentId, layoutPositions]);

  const contentBounds = useMemo(() => {
    const left = drawMetrics.offsetX;
    const top = drawMetrics.offsetY;
    const right = drawMetrics.offsetX + baseLayout.viewBox.width * drawMetrics.scale;
    const bottom = drawMetrics.offsetY + baseLayout.viewBox.height * drawMetrics.scale;
    return { left, top, right, bottom };
  }, [drawMetrics, baseLayout.viewBox]);

  useEffect(() => {
    contentLeft.value = contentBounds.left;
    contentTop.value = contentBounds.top;
    contentRight.value = contentBounds.right;
    contentBottom.value = contentBounds.bottom;
  }, [contentBounds, contentBottom, contentLeft, contentRight, contentTop]);

  useEffect(() => {
    pathPhase.value = withRepeat(
      withTiming(PATH_DASH_CYCLE, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [pathPhase]);

  const centerOnCurrent = useCallback(() => {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return;
    const screen = toScreen(currentLayoutPoint);
    const targetX = canvasSize.width / 2 - screen.x;
    const targetY = canvasSize.height * PLAYER_FOCUS_Y - screen.y;
    const clamped = clampContentPanTranslation(
      targetX,
      targetY,
      canvasSize.width,
      canvasSize.height,
      contentBounds.left,
      contentBounds.top,
      contentBounds.right,
      contentBounds.bottom,
    );
    translateX.value = withTiming(clamped.x, { duration: 280 });
    translateY.value = withTiming(clamped.y, { duration: 280 });
    savedTranslateX.value = clamped.x;
    savedTranslateY.value = clamped.y;
  }, [
    canvasSize,
    contentBounds,
    currentLayoutPoint,
    savedTranslateX,
    savedTranslateY,
    toScreen,
    translateX,
    translateY,
  ]);

  useEffect(() => {
    if (!compact) centerOnCurrent();
  }, [resolvedCurrentId, canvasSize.width, canvasSize.height, compact, centerOnCurrent]);

  const handleNodePress = useCallback((nodeId: string) => {
    Vibration.vibrate(SECTOR_SELECT_HAPTIC_MS);
    onNodePress?.(nodeId);
  }, [onNodePress]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ width, height });
    canvasWidth.value = width;
    canvasHeight.value = height;
  };

  const applyPanUpdate = (nextX: number, nextY: number) => {
    'worklet';
    const clamped = clampContentPanTranslation(
      nextX,
      nextY,
      canvasWidth.value,
      canvasHeight.value,
      contentLeft.value,
      contentTop.value,
      contentRight.value,
      contentBottom.value,
    );
    translateX.value = clamped.x;
    translateY.value = clamped.y;
  };

  const panGesture = Gesture.Pan()
    .enabled(!compact)
    .maxPointers(1)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      applyPanUpdate(
        savedTranslateX.value + event.translationX,
        savedTranslateY.value + event.translationY,
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const mapPanStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const parallaxTransform = useDerivedValue(() => [
    { translateX: -translateX.value * PARALLAX_DAMPING },
    { translateY: -translateY.value * PARALLAX_DAMPING },
  ]);

  const screenNodes: ScreenNode[] = useMemo(() => {
    const nodes: ScreenNode[] = [];
    const allIds = new Set([
      ...Object.keys(graph.nodes),
      ...Object.keys(ephemeralPositions),
    ]);

    allIds.forEach((id) => {
      const pos = layoutPositions[id];
      if (!pos) return;
      const screen = toScreen(pos);
      const graphNode = graph.nodes[id];
      const clusterNode = cluster.find((n) => n.id === id);
      const nodeType = graphNode?.type ?? clusterNode?.type ?? 'NARRATIVE_EVENT';
      const visibility = resolveNodeVisibility(id, graph, revealed, scanRange);
      nodes.push({
        id,
        screenX: screen.x,
        screenY: screen.y,
        glyph: nodeGlyphForType(nodeType),
        nodeType,
        visibility,
        isCurrent: id === resolvedCurrentId,
        isInteractive: interactive && interactiveIds.has(id),
        isBoss: nodeType === 'BOSS_COMBAT' || graphNode?.isAnomalyNest === true,
        isAnchor: isSafeAnchorNode(nodeType, id),
      });
    });
    return nodes;
  }, [
    graph,
    cluster,
    ephemeralPositions,
    layoutPositions,
    toScreen,
    revealed,
    scanRange,
    resolvedCurrentId,
    interactive,
    interactiveIds,
  ]);

  const playerScreen = toScreen(currentLayoutPoint);

  const gridLines = useMemo(() => {
    const lines: { p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];
    const step = 48;
    for (let x = 0; x <= baseLayout.viewBox.width; x += step) {
      lines.push({ p1: { x, y: 0 }, p2: { x, y: baseLayout.viewBox.height } });
    }
    for (let y = 0; y <= baseLayout.viewBox.height; y += step) {
      lines.push({ p1: { x: 0, y }, p2: { x: baseLayout.viewBox.width, y } });
    }
    return lines;
  }, [baseLayout.viewBox]);

  const mainMapTransform = useMemo(
    () => [
      { translateX: drawMetrics.offsetX },
      { translateY: drawMetrics.offsetY },
      { scale: drawMetrics.scale },
    ],
    [drawMetrics],
  );

  const mapContent = (
    <Animated.View style={[styles.mapTransform, mapPanStyle]}>
      <View>
        {canvasSize.width > 0 && canvasSize.height > 0 ? (
          <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
            <Rect
              x={0}
              y={0}
              width={canvasSize.width}
              height={canvasSize.height}
              color={palette.voidBlack}
            />

            <Group transform={parallaxTransform}>
              <Group
                transform={[
                  { translateX: drawMetrics.offsetX },
                  { translateY: drawMetrics.offsetY },
                  { scale: drawMetrics.scale },
                ]}
              >
                <Rect
                  x={0}
                  y={0}
                  width={baseLayout.viewBox.width}
                  height={baseLayout.viewBox.height}
                  color={palette.voidBlack}
                />
                {gridLines.map((line, i) => (
                  <Line
                    key={`parallax-grid-${i}`}
                    p1={vec(line.p1.x, line.p1.y)}
                    p2={vec(line.p2.x, line.p2.y)}
                    color={palette.gridLine}
                    strokeWidth={1}
                    opacity={0.18}
                  />
                ))}
              </Group>
            </Group>

            <Group transform={mainMapTransform}>
              {baseLayout.edges.map((edge) => {
                const from = layoutPositions[edge.fromId];
                const to = layoutPositions[edge.toId];
                if (!from || !to) return null;
                const dimmed = isEdgeDimmed(edge, revealed);
                return (
                  <Line
                    key={`${edge.fromId}-${edge.toId}`}
                    p1={vec(from.x, from.y)}
                    p2={vec(to.x, to.y)}
                    color={dimmed ? palette.edgeDim : palette.edgeActive}
                    strokeWidth={dimmed ? 1 : 1.5}
                    opacity={dimmed ? 0.45 : 0.9}
                  >
                    {!dimmed ? (
                      <DashPathEffect intervals={[6, 12]} phase={pathPhase} />
                    ) : null}
                  </Line>
                );
              })}

              {screenNodes.map((node) => {
                const pos = layoutPositions[node.id];
                if (!pos) return null;
                const radius = node.isBoss
                  ? NODE_RADIUS.boss
                  : node.isCurrent
                    ? NODE_RADIUS.current
                    : NODE_RADIUS.default;
                const fog = FOG_OPACITY[node.visibility];
                const markerOpacity = NODE_MARKER_OPACITY[node.visibility];
                const fill = node.id === selectedNodeId
                  ? palette.nodeFillSelected
                  : palette.nodeFill;
                const isActive = node.isInteractive || node.isCurrent;
                const showAnchorRift = node.isAnchor && node.isInteractive;

                if (showAnchorRift) {
                  return (
                    <Group key={node.id}>
                      <AnchorRiftVisual
                        cx={pos.x}
                        cy={pos.y}
                        accessible={node.isInteractive}
                      />
                      {fog > 0 ? (
                        <Circle
                          cx={pos.x}
                          cy={pos.y}
                          r={radius + 8}
                          color={palette.voidBlack}
                          opacity={fog}
                        />
                      ) : null}
                    </Group>
                  );
                }

                return (
                  <Group key={node.id}>
                    {isActive ? (
                      <ActiveNodeGlow
                        cx={pos.x}
                        cy={pos.y}
                        color={palette.terminalGreen}
                        opacity={node.isCurrent ? 0.62 : 0.48}
                      />
                    ) : null}
                    <Circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius}
                      color={fill}
                      opacity={markerOpacity}
                    />
                    <Circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius}
                      color={palette.nodeStroke}
                      style="stroke"
                      strokeWidth={node.isCurrent ? 2.5 : node.isInteractive ? 2 : 1.5}
                      opacity={markerOpacity}
                    />
                    {fog > 0 ? (
                      <Circle
                        cx={pos.x}
                        cy={pos.y}
                        r={radius + 6}
                        color={palette.voidBlack}
                        opacity={fog}
                      />
                    ) : null}
                  </Group>
                );
              })}
            </Group>
          </Canvas>
        ) : null}

        {screenNodes.map((node) => {
          if (node.isAnchor && node.isInteractive) return null;
          const glyphSize = node.isBoss
            ? NODE_RADIUS.boss * 2
            : node.isCurrent
              ? NODE_RADIUS.current * 2
              : NODE_RADIUS.default * 2;
          return (
            <View
              key={`glyph-${node.id}`}
              pointerEvents="none"
              style={[
                styles.glyphLabel,
                {
                  width: glyphSize,
                  height: glyphSize,
                  left: node.screenX - glyphSize / 2,
                  top: node.screenY - glyphSize / 2,
                  opacity: NODE_MARKER_OPACITY[node.visibility],
                },
              ]}
            >
              <Text style={[styles.glyphText, { color: labelAccent }]}>{node.glyph}</Text>
            </View>
          );
        })}

        <View
          pointerEvents="none"
          style={[
            styles.playerSprite,
            {
              left: playerScreen.x - PLAYER_SPRITE_W / 2,
              top: playerScreen.y - PLAYER_SPRITE_H + 10,
            },
          ]}
        >
          <Image
            source={FACING_SOURCE[facing]}
            style={styles.playerImage}
            resizeMode="contain"
          />
          <View style={[styles.playerDot, { backgroundColor: labelAccent, borderColor: zoneLineColor }]} />
        </View>

        {interactive
          ? screenNodes
            .filter((node) => node.isInteractive)
            .map((node) => (
              <Pressable
                key={`hit-${node.id}`}
                onPress={() => handleNodePress(node.id)}
                style={[
                  styles.hitTarget,
                  {
                    left: node.screenX - HIT_RADIUS,
                    top: node.screenY - HIT_RADIUS,
                  },
                ]}
              />
            ))
          : null}
      </View>
    </Animated.View>
  );

  return (
    <View
      style={[
        styles.root,
        compact ? styles.rootCompact : styles.rootFull,
        { borderColor: palette.zoneLine },
      ]}
      onLayout={handleLayout}
    >
      {!compact ? (
        <View style={styles.headerRow}>
          <Text style={[styles.headerLabel, { color: labelAccent }]}>
            SECTOR OVERWORLD // STRATEGIC MAP
          </Text>
          <Text style={styles.headerSub}>
            {`T${graph.sectorTier} // DEPTH ${graph.maxGraphDepth} // DRAG TO SCROLL`}
          </Text>
        </View>
      ) : null}

      <GestureDetector gesture={panGesture}>
        <View style={styles.mapHost} collapsable={false}>
          {mapContent}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#090d16',
    borderWidth: 1,
  },
  rootFull: {
    flex: 1,
    minHeight: 220,
  },
  rootCompact: {
    height: 140,
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 116, 139, 0.28)',
    gap: 2,
  },
  headerLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
    color: '#64748b',
  },
  mapHost: {
    flex: 1,
    overflow: 'hidden',
  },
  mapTransform: {
    flex: 1,
  },
  glyphLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
  },
  playerSprite: {
    position: 'absolute',
    width: PLAYER_SPRITE_W,
    height: PLAYER_SPRITE_H + 8,
    alignItems: 'center',
  },
  playerImage: {
    width: PLAYER_SPRITE_W,
    height: PLAYER_SPRITE_H,
  },
  playerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    marginTop: 2,
  },
  hitTarget: {
    position: 'absolute',
    width: HIT_RADIUS * 2,
    height: HIT_RADIUS * 2,
    borderRadius: HIT_RADIUS,
  },
});
