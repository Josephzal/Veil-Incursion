import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { WORLD_CONTINENT_OUTLINES, WORLD_VIEWBOX } from '../data/worldMapGeometry';
import { MacroSectorDefinition, MacroSectorId } from '../types/regional';
import { TerminalTheme } from '../types/theme';
import {
  getSectorTintColor,
  hitTestSectorAtPoint,
  INACTIVE_SECTOR_LAYER_OPACITY,
  polygonToSkiaPath,
  resolveSectorInfluence,
  clampExpandedMapTranslation,
  clampPreviewMapTranslation,
  focalPinchTranslation,
  focalPinchTranslationPreview,
  resolveMapDrawMetrics,
  screenPointToViewBox,
  screenPointToViewBoxPreview,
  SECTOR_SELECT_HAPTIC_MS,
  viewBoxPointToCanvas,
} from '../utils/sectorInfluenceVisual';

const MAP_BACKDROP = '#06080d';
const OCEAN_GRID_COLOR = '#1a2332';
const CONTINENT_FILL = '#243044';
const CONTINENT_STROKE = '#4a5d78';
const NODE_MARKER_COLOR = '#00ff33';
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const TAP_MAX_DURATION_MS = 450;
const TAP_MAX_DISTANCE_PX = 28;
const DOUBLE_TAP_MAX_DELAY_MS = 380;
const EXPANDED_HORIZONTAL_INSET = 12;
const EXPANDED_HEADER_HEIGHT = 52;
const EXPANDED_VERTICAL_PADDING = 36;
const EXPANDED_DETAIL_HEIGHT = 156;

interface WorldMagnetismMapProps {
  theme: TerminalTheme;
  sectors: MacroSectorDefinition[];
  activeSectorId: MacroSectorId;
  homeSectorId: MacroSectorId;
  isInfluenceFrozen: boolean;
  frozenInfluence: { TERRAN_GRID: number; LEGION: number; SOLARIS: number } | null;
  isWeakLocalSignal: boolean;
  proxyMetropolitanNode: string | null;
  onSectorPress: (id: MacroSectorId) => void;
  expandedDetailPanel?: React.ReactNode;
}

interface MapViewportProps extends WorldMagnetismMapProps {
  fillContainer?: boolean;
  reservedChromeHeight?: number;
  onOpen?: () => void;
  hint: string;
  mapHostStyle?: object;
}

function buildPathFromPolygon(polygon: { x: number; y: number }[]) {
  const path = Skia.Path.MakeFromSVGString(polygonToSkiaPath(polygon));
  return path ?? Skia.Path.Make();
}

function clampZoom(value: number): number {
  'worklet';
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function resolveCanvasSizeForHost(
  width: number,
  height: number,
  fillContainer: boolean,
): { width: number; height: number } {
  const aspect = WORLD_VIEWBOX.width / WORLD_VIEWBOX.height;
  if (fillContainer && height > 0 && width > 0) {
    const widthFromHeight = height * aspect;
    if (widthFromHeight <= width) {
      return { width: widthFromHeight, height };
    }
    return { width, height: width / aspect };
  }
  const fittedHeight = width * (WORLD_VIEWBOX.height / WORLD_VIEWBOX.width);
  return { width, height: fittedHeight };
}

function MapViewport({
  theme,
  sectors,
  activeSectorId,
  homeSectorId,
  isInfluenceFrozen,
  frozenInfluence,
  onSectorPress,
  isWeakLocalSignal,
  fillContainer = false,
  reservedChromeHeight,
  onOpen,
  hint,
  mapHostStyle,
}: MapViewportProps): React.JSX.Element {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });
  const [fillHostSize, setFillHostSize] = useState({ width: 0, height: 0 });

  const expandedHostSize = useMemo(() => {
    if (!fillContainer) return null;
    if (fillHostSize.width > 0 && fillHostSize.height > 0) {
      return { width: fillHostSize.width, height: fillHostSize.height };
    }
    const chromeHeight = reservedChromeHeight ?? EXPANDED_HEADER_HEIGHT + EXPANDED_VERTICAL_PADDING + 220;
    const width = Math.max(0, windowWidth - EXPANDED_HORIZONTAL_INSET * 2);
    const height = Math.max(0, windowHeight - chromeHeight);
    return { width, height };
  }, [fillContainer, fillHostSize.height, fillHostSize.width, reservedChromeHeight, windowHeight, windowWidth]);

  const zoomScale = useSharedValue(1);
  const savedZoomScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);
  const contentLeft = useSharedValue(0);
  const contentTop = useSharedValue(0);
  const contentRight = useSharedValue(0);
  const contentBottom = useSharedValue(0);
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);
  const isExpandedViewport = useSharedValue(fillContainer ? 1 : 0);

  const handleHostLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (fillContainer) {
      setFillHostSize({ width, height });
      if (width > 0 && height > 0) {
        canvasWidth.value = width;
        canvasHeight.value = height;
        centerX.value = width / 2;
        centerY.value = height / 2;
      }
      return;
    }
    setHostSize({ width, height });
  }, [canvasHeight, canvasWidth, fillContainer]);

  React.useEffect(() => {
    if (expandedHostSize) {
      canvasWidth.value = expandedHostSize.width;
      canvasHeight.value = expandedHostSize.height;
      centerX.value = expandedHostSize.width / 2;
      centerY.value = expandedHostSize.height / 2;
      return;
    }
    if (hostSize.width === 0) return;
    const next = resolveCanvasSizeForHost(hostSize.width, hostSize.height, false);
    setCanvasSize(next);
    canvasWidth.value = next.width;
    canvasHeight.value = next.height;
    centerX.value = next.width / 2;
    centerY.value = next.height / 2;
  }, [canvasHeight, canvasWidth, centerX, centerY, expandedHostSize, hostSize.height, hostSize.width]);

  const activeCanvasSize = expandedHostSize ?? canvasSize;

  const drawMetrics = useMemo(() => {
    if (activeCanvasSize.width === 0 || activeCanvasSize.height === 0) {
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }
    return resolveMapDrawMetrics(
      activeCanvasSize.width,
      activeCanvasSize.height,
      WORLD_VIEWBOX.width,
      WORLD_VIEWBOX.height,
      'contain',
    );
  }, [activeCanvasSize.height, activeCanvasSize.width]);

  React.useEffect(() => {
    const drawnWidth = WORLD_VIEWBOX.width * drawMetrics.scale;
    const drawnHeight = WORLD_VIEWBOX.height * drawMetrics.scale;
    contentLeft.value = drawMetrics.offsetX;
    contentTop.value = drawMetrics.offsetY;
    contentRight.value = drawMetrics.offsetX + drawnWidth;
    contentBottom.value = drawMetrics.offsetY + drawnHeight;
  }, [
    contentBottom,
    contentLeft,
    contentRight,
    contentTop,
    drawMetrics.offsetX,
    drawMetrics.offsetY,
    drawMetrics.scale,
  ]);

  const continentPaths = useMemo(
    () => WORLD_CONTINENT_OUTLINES.map((outline) => buildPathFromPolygon(outline)),
    [],
  );

  const gridLines = useMemo(() => {
    const lines: { p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];
    const step = 160;
    for (let x = 0; x <= WORLD_VIEWBOX.width; x += step) {
      lines.push({ p1: { x, y: 0 }, p2: { x, y: WORLD_VIEWBOX.height } });
    }
    for (let y = 0; y <= WORLD_VIEWBOX.height; y += step) {
      lines.push({ p1: { x: 0, y }, p2: { x: WORLD_VIEWBOX.width, y } });
    }
    return lines;
  }, []);

  const handleMapPress = useCallback(
    (screenX: number, screenY: number, zoom: number, offsetX: number, offsetY: number) => {
      if (activeCanvasSize.width === 0 || activeCanvasSize.height === 0) return;
      const viewBoxPoint = fillContainer
        ? screenPointToViewBox(
            screenX,
            screenY,
            zoom,
            offsetX,
            offsetY,
            activeCanvasSize.width / 2,
            activeCanvasSize.height / 2,
            drawMetrics,
          )
        : screenPointToViewBoxPreview(
            screenX,
            screenY,
            activeCanvasSize.width,
            activeCanvasSize.height,
            WORLD_VIEWBOX.width,
            WORLD_VIEWBOX.height,
            zoom,
            offsetX,
            offsetY,
          );
      const hit = hitTestSectorAtPoint(viewBoxPoint, sectors);
      if (!hit) return;
      Vibration.vibrate(SECTOR_SELECT_HAPTIC_MS);
      onSectorPress(hit.id);
    },
    [activeCanvasSize.height, activeCanvasSize.width, drawMetrics, fillContainer, onSectorPress, sectors],
  );

  const resetMapView = useCallback(() => {
    zoomScale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedZoomScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [savedTranslateX, savedTranslateY, savedZoomScale, translateX, translateY, zoomScale]);

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      savedZoomScale.value = zoomScale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onUpdate((event) => {
      const nextScale = clampZoom(savedZoomScale.value * event.scale);
      const nextX = isExpandedViewport.value
        ? focalPinchTranslation(
            focalX.value,
            savedTranslateX.value,
            savedZoomScale.value,
            nextScale,
            centerX.value,
          )
        : focalPinchTranslationPreview(
            focalX.value,
            savedTranslateX.value,
            savedZoomScale.value,
            nextScale,
          );
      const nextY = isExpandedViewport.value
        ? focalPinchTranslation(
            focalY.value,
            savedTranslateY.value,
            savedZoomScale.value,
            nextScale,
            centerY.value,
          )
        : focalPinchTranslationPreview(
            focalY.value,
            savedTranslateY.value,
            savedZoomScale.value,
            nextScale,
          );
      const clamped = isExpandedViewport.value
        ? clampExpandedMapTranslation(
            nextX,
            nextY,
            nextScale,
            canvasWidth.value,
            canvasHeight.value,
            centerX.value,
            centerY.value,
            contentLeft.value,
            contentTop.value,
            contentRight.value,
            contentBottom.value,
          )
        : clampPreviewMapTranslation(
            nextX,
            nextY,
            nextScale,
            canvasWidth.value,
            canvasHeight.value,
          );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
      zoomScale.value = nextScale;
    })
    .onEnd(() => {
      if (zoomScale.value <= MIN_ZOOM) {
        zoomScale.value = withTiming(MIN_ZOOM);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedZoomScale.value = MIN_ZOOM;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      savedZoomScale.value = zoomScale.value;
      const clamped = isExpandedViewport.value
        ? clampExpandedMapTranslation(
            translateX.value,
            translateY.value,
            zoomScale.value,
            canvasWidth.value,
            canvasHeight.value,
            centerX.value,
            centerY.value,
            contentLeft.value,
            contentTop.value,
            contentRight.value,
            contentBottom.value,
          )
        : clampPreviewMapTranslation(
            translateX.value,
            translateY.value,
            zoomScale.value,
            canvasWidth.value,
            canvasHeight.value,
          );
      translateX.value = withTiming(clamped.x);
      translateY.value = withTiming(clamped.y);
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
    });

  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .maxPointers(1)
    .onTouchesMove((_event, state) => {
      if (zoomScale.value > MIN_ZOOM + 0.02) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      const nextX = savedTranslateX.value + event.translationX;
      const nextY = savedTranslateY.value + event.translationY;
      const clamped = isExpandedViewport.value
        ? clampExpandedMapTranslation(
            nextX,
            nextY,
            zoomScale.value,
            canvasWidth.value,
            canvasHeight.value,
            centerX.value,
            centerY.value,
            contentLeft.value,
            contentTop.value,
            contentRight.value,
            contentBottom.value,
          )
        : clampPreviewMapTranslation(
            nextX,
            nextY,
            zoomScale.value,
            canvasWidth.value,
            canvasHeight.value,
          );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const sectorTapGesture = Gesture.Tap()
    .maxDuration(TAP_MAX_DURATION_MS)
    .maxDistance(TAP_MAX_DISTANCE_PX)
    .onEnd((event) => {
      runOnJS(handleMapPress)(
        event.x,
        event.y,
        zoomScale.value,
        translateX.value,
        translateY.value,
      );
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(TAP_MAX_DURATION_MS)
    .maxDelay(DOUBLE_TAP_MAX_DELAY_MS)
    .onEnd(() => {
      runOnJS(resetMapView)();
    });

  const mapGesture = Gesture.Simultaneous(
    Gesture.Exclusive(Gesture.Simultaneous(pinchGesture, panGesture), doubleTapGesture),
    sectorTapGesture,
  );

  const mapPanStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const mapScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }],
  }));

  const mapExpandedViewportStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: zoomScale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const activeSector = sectors.find((sector) => sector.id === activeSectorId);
  const activeSectorLabel = activeSector
    ? viewBoxPointToCanvas(activeSector.mapGeometry.labelAnchor, drawMetrics)
    : null;

  const homeSector = sectors.find((sector) => sector.id === homeSectorId);
  const homeMarker = homeSector
    ? viewBoxPointToCanvas(homeSector.mapGeometry.nodeAnchor, drawMetrics)
    : null;

  const mapVisualContent = (
    <>
      <Canvas style={{ width: activeCanvasSize.width, height: activeCanvasSize.height }}>
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
            width={WORLD_VIEWBOX.width}
            height={WORLD_VIEWBOX.height}
            color={MAP_BACKDROP}
          />

          {gridLines.map((line, index) => (
            <Line
              key={`grid-${index}`}
              p1={vec(line.p1.x, line.p1.y)}
              p2={vec(line.p2.x, line.p2.y)}
              color={OCEAN_GRID_COLOR}
              strokeWidth={1}
              opacity={0.28}
            />
          ))}

          {continentPaths.map((path, index) => (
            <Group key={`continent-${index}`}>
              <Path
                path={path}
                color={CONTINENT_FILL}
                style="fill"
                opacity={0.65}
              />
              <Path
                path={path}
                color={CONTINENT_STROKE}
                style="stroke"
                strokeWidth={2.5}
                strokeJoin="round"
                strokeCap="round"
                opacity={0.9}
              />
            </Group>
          ))}

          {sectors.map((sector) => {
            const isActive = sector.id === activeSectorId;
            const influence = resolveSectorInfluence(sector, isInfluenceFrozen, frozenInfluence);
            const fillColor = getSectorTintColor(influence, isActive);
            const path = buildPathFromPolygon(sector.mapGeometry.polygon);
            return (
              <Path
                key={`sector-fill-${sector.id}`}
                path={path}
                color={fillColor}
                style="fill"
                opacity={isActive ? 1 : INACTIVE_SECTOR_LAYER_OPACITY}
              />
            );
          })}

          {sectors.map((sector) => {
            const isActive = sector.id === activeSectorId;
            const path = buildPathFromPolygon(sector.mapGeometry.polygon);
            return (
              <Path
                key={`sector-stroke-${sector.id}`}
                path={path}
                color={isActive ? theme.statusColor : CONTINENT_STROKE}
                style="stroke"
                strokeWidth={isActive ? 3 : 2}
                strokeJoin="round"
                strokeCap="round"
                opacity={isActive ? 1 : INACTIVE_SECTOR_LAYER_OPACITY}
              />
            );
          })}

          {sectors.map((sector) => {
            const isActive = sector.id === activeSectorId;
            const { nodeAnchor } = sector.mapGeometry;
            return (
              <Circle
                key={`node-${sector.id}`}
                cx={nodeAnchor.x}
                cy={nodeAnchor.y}
                r={isActive ? 7 : 5}
                color={isActive ? NODE_MARKER_COLOR : theme.mutedColor}
                opacity={isActive ? 1 : INACTIVE_SECTOR_LAYER_OPACITY}
              />
            );
          })}
        </Group>
      </Canvas>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {activeSector && activeSectorLabel && (
          <Text
            pointerEvents="none"
            style={[
              styles.sectorLabel,
              {
                left: activeSectorLabel.x - 48,
                top: activeSectorLabel.y - 8,
                color: theme.statusColor,
              },
            ]}
          >
            {activeSector.label}
          </Text>
        )}
        {homeMarker && (
          <View
            style={[
              styles.homeMarkerTag,
              { left: homeMarker.x + 10, top: homeMarker.y - 8, borderColor: theme.borderColor },
            ]}
          >
            <Text style={[styles.homeMarkerText, { color: theme.mutedColor }]}>HOME</Text>
          </View>
        )}
      </View>
    </>
  );

  return (
    <View
      style={[styles.viewportRoot, fillContainer ? styles.viewportRootFill : null]}
      onLayout={fillContainer ? handleHostLayout : undefined}
    >
      <View
        style={[
          styles.mapFrame,
          mapHostStyle,
          fillContainer ? styles.mapFrameFill : null,
          {
            borderColor: theme.borderColor,
            borderWidth: theme.borderWidth,
            height: fillContainer
              ? undefined
              : activeCanvasSize.height || undefined,
            aspectRatio:
              fillContainer || activeCanvasSize.height > 0
                ? undefined
                : WORLD_VIEWBOX.width / WORLD_VIEWBOX.height,
          },
        ]}
        onLayout={fillContainer ? undefined : handleHostLayout}
      >
        {activeCanvasSize.width > 0 && (
          <View
            style={[
              styles.mapSurface,
              fillContainer ? styles.mapSurfaceFill : { width: activeCanvasSize.width, height: activeCanvasSize.height },
            ]}
          >
            {fillContainer ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    width: activeCanvasSize.width,
                    height: activeCanvasSize.height,
                  },
                  mapExpandedViewportStyle,
                ]}
              >
                {mapVisualContent}
              </Animated.View>
            ) : (
              <Animated.View pointerEvents="none" style={[styles.mapVisualLayer, mapPanStyle]}>
                <Animated.View
                  style={[
                    {
                      width: activeCanvasSize.width,
                      height: activeCanvasSize.height,
                      transformOrigin: 'top left',
                    },
                    mapScaleStyle,
                  ]}
                >
                  {mapVisualContent}
                </Animated.View>
              </Animated.View>
            )}

            <GestureDetector gesture={mapGesture}>
              <View collapsable={false} style={styles.touchLayer} />
            </GestureDetector>
          </View>
        )}

        {activeCanvasSize.width > 0 && isWeakLocalSignal && (
          <View pointerEvents="none" style={styles.mapHudOverlay}>
            <View style={[styles.weakSignalBadge, { borderColor: theme.primaryColor }]}>
              <Text style={[styles.weakSignalTitle, { color: theme.primaryColor }]}>
                WEAK SIGNAL
              </Text>
            </View>
          </View>
        )}
      </View>

      {!fillContainer && onOpen && (
        <Pressable
          onPress={onOpen}
          style={({ pressed }) => [
            styles.expandBtn,
            {
              borderColor: theme.statusColor,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={[styles.expandBtnText, { color: theme.statusColor }]}>[ EXPAND MAP ]</Text>
        </Pressable>
      )}

      <Text style={[styles.hint, { color: theme.mutedColor }]}>{hint}</Text>
    </View>
  );
}

export default function WorldMagnetismMap({
  expandedDetailPanel,
  ...props
}: WorldMagnetismMapProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const { theme } = props;
  const expandedReservedChromeHeight =
    EXPANDED_HEADER_HEIGHT + EXPANDED_VERTICAL_PADDING + EXPANDED_DETAIL_HEIGHT + 10;

  return (
    <View style={styles.root}>
      <GestureHandlerRootView style={styles.previewGestureRoot}>
        <MapViewport
          {...props}
          onOpen={() => setExpanded(true)}
          hint="TAP SECTOR // PINCH ZOOM // DOUBLE-TAP RESET // [ EXPAND MAP ]"
        />
      </GestureHandlerRootView>

      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <GestureHandlerRootView style={styles.expandedGestureRoot}>
          <View style={styles.expandedBackdrop}>
            <View style={styles.expandedHeader}>
              <Text style={[styles.expandedTitle, { color: theme.primaryColor }]}>
                VECTOR WORLD MAP // MAGNETISM SCAN
              </Text>
              <Pressable
                onPress={() => setExpanded(false)}
                style={({ pressed }) => [
                  styles.closeBtn,
                  { borderColor: theme.borderColor, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.closeBtnText, { color: theme.mutedColor }]}>[ CLOSE ]</Text>
              </Pressable>
            </View>

            <View style={styles.expandedMapHost}>
              {expanded && (
                <MapViewport
                  key="expanded-map"
                  {...props}
                  fillContainer
                  reservedChromeHeight={expandedReservedChromeHeight}
                  hint="TAP SECTOR // PINCH ZOOM // DOUBLE-TAP RESET"
                />
              )}
            </View>

            {expanded && expandedDetailPanel && (
              <View
                style={[
                  styles.expandedDetailPanel,
                  {
                    borderColor: theme.borderColor,
                    height: EXPANDED_DETAIL_HEIGHT,
                  },
                ]}
              >
                <View style={styles.expandedDetailContent}>{expandedDetailPanel}</View>
              </View>
            )}
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 4 },
  viewportRoot: { width: '100%' },
  viewportRootFill: {
    flex: 1,
    width: '100%',
  },
  mapFrame: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: MAP_BACKDROP,
    position: 'relative',
  },
  previewGestureRoot: {
    width: '100%',
  },
  mapFrameFill: {
    flex: 1,
    width: '100%',
  },
  mapSurface: {
    overflow: 'hidden',
    position: 'relative',
  },
  mapSurfaceFill: {
    ...StyleSheet.absoluteFillObject,
  },
  mapHudOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingLeft: 5,
    paddingBottom: 5,
  },
  mapVisualLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  weakSignalBadge: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 3,
    backgroundColor: 'rgba(10, 11, 15, 0.96)',
  },
  weakSignalTitle: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectorLabel: {
    position: 'absolute',
    width: 96,
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  homeMarkerTag: {
    position: 'absolute',
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#0a0b0f',
  },
  homeMarkerText: {
    fontFamily: 'monospace',
    fontSize: 6,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: 'center',
  },
  expandBtn: {
    marginTop: 8,
    alignSelf: 'center',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  expandBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  expandedGestureRoot: {
    flex: 1,
  },
  expandedBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    paddingTop: 44,
    paddingHorizontal: EXPANDED_HORIZONTAL_INSET,
    paddingBottom: 16,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  expandedTitle: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  closeBtn: {
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  closeBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  expandedMapHost: {
    flex: 1,
    minHeight: 280,
  },
  expandedDetailPanel: {
    borderWidth: 1,
    marginTop: 8,
    flexShrink: 0,
    overflow: 'hidden',
  },
  expandedDetailContent: {
    flex: 1,
    padding: 10,
    paddingBottom: 10,
    justifyContent: 'center',
  },
});
