import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, {
  Defs,
  G,
  Line,
  Path,
  Pattern,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { useHubLayout } from '../../context/HubLayoutContext';
import {
  SECTOR_MAP_DEFINITIONS,
  SECTOR_MAP_VIEWBOX,
} from '../../data/sectorWorldCatalog';
import type { SectorId, SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { sectorAbbreviation, VEIL_BIOME_VISUALS } from '../../utils/veilFrontSectorUi';
import { hexToRgba } from '../../utils/sectorInfluenceVisual';
import {
  hitTestSectorAtPoint,
  polygonCentroid,
  resolveMapDrawMetrics,
  screenPointToViewBoxExpanded,
  SECTOR_SELECT_HAPTIC_MS,
  splitSectorLabelLines,
  viewBoxPointToCanvas,
} from '../../utils/sectorInfluenceVisual';

const MAP_ASPECT = SECTOR_MAP_VIEWBOX.height / SECTOR_MAP_VIEWBOX.width;

const AnimatedG = Animated.createAnimatedComponent(G);

interface VeilFrontMapProps {
  theme: TerminalTheme;
  sectors: SectorState[];
  activeSectorId: SectorId;
  onSectorPress: (id: SectorId) => void;
  /** Progression unlock map — locked sectors render darkened. */
  unlockedSectorIds?: ReadonlySet<SectorId> | readonly SectorId[];
  /** Optional lock sub-labels (LOCKED / MANDATE / HUNTING). */
  sectorLockLabels?: Partial<Record<SectorId, string>>;
}

function VeilFrontBlueprintGrid({ width, height }: { width: number; height: number }): React.JSX.Element {
  return (
    <>
      <Defs>
        <Pattern id="veilFrontGrid" width={28} height={28} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={28} y2={0} stroke="rgba(100, 116, 139, 0.05)" strokeWidth={0.6} />
          <Line x1={0} y1={0} x2={0} y2={28} stroke="rgba(100, 116, 139, 0.05)" strokeWidth={0.6} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#veilFrontGrid)" />
    </>
  );
}

/** Connected tactical scan board — shared borders, selected sector highlighted. */
export default function VeilFrontMap({
  sectors,
  activeSectorId,
  onSectorPress,
  unlockedSectorIds,
  sectorLockLabels,
}: VeilFrontMapProps): React.JSX.Element {
  const { isDesktop } = useHubLayout();
  const mapDefinitions = SECTOR_MAP_DEFINITIONS;
  const sectorById = useMemo(
    () => new Map(sectors.map((sector) => [sector.id, sector])),
    [sectors],
  );
  const unlockedSet = useMemo(() => {
    if (!unlockedSectorIds) return null;
    return unlockedSectorIds instanceof Set
      ? unlockedSectorIds
      : new Set(unlockedSectorIds);
  }, [unlockedSectorIds]);
  const isSectorUnlocked = useCallback((id: SectorId) => {
    if (!unlockedSet) return true;
    return unlockedSet.has(id);
  }, [unlockedSet]);
  const [hostSize, setHostSize] = useState({ width: 320, height: 240 });

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const { canvasWidth, canvasHeight } = useMemo(() => {
    const availableWidth = Math.max(1, hostSize.width);
    const availableHeight = Math.max(1, hostSize.height);
    const widthFromHeight = availableHeight / MAP_ASPECT;
    if (widthFromHeight <= availableWidth) {
      return { canvasWidth: widthFromHeight, canvasHeight: availableHeight };
    }
    return { canvasWidth: availableWidth, canvasHeight: availableWidth * MAP_ASPECT };
  }, [hostSize.height, hostSize.width]);

  const drawMetrics = useMemo(
    () => resolveMapDrawMetrics(
      canvasWidth,
      canvasHeight,
      SECTOR_MAP_VIEWBOX.width,
      SECTOR_MAP_VIEWBOX.height,
      'contain',
    ),
    [canvasHeight, canvasWidth],
  );

  const labelFontSize = useMemo(
    () => Math.max(5, Math.min(isDesktop ? 11 : 7, drawMetrics.scale * (isDesktop ? 6.8 : 5))),
    [drawMetrics.scale, isDesktop],
  );
  const labelLineHeight = labelFontSize + (isDesktop ? 2.5 : 1.5);
  const strokeWidth = isDesktop ? 1.6 : 1.2;
  const activeStrokeWidth = isDesktop ? 3 : 2.4;

  const handleHostLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setHostSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const macroLikeSectors = useMemo(
    () => mapDefinitions.map((sector) => ({
      id: sector.id as unknown as import('../../types/regional').MacroSectorId,
      label: sector.label,
      continent: 'NA' as const,
      metropolitanNode: sector.label,
      baseTrafficDensity: 50,
      defaultFaction: 'TERRAN_GRID' as const,
      influence: { TERRAN_GRID: 0, LEGION: 0, SOLARIS: 0 },
      mapGeometry: sector.mapGeometry,
    })),
    [mapDefinitions],
  );

  const handleSectorSelect = useCallback((id: SectorId) => {
    Vibration.vibrate(SECTOR_SELECT_HAPTIC_MS);
    onSectorPress(id);
  }, [onSectorPress]);

  const handleMapPress = useCallback(
    (screenX: number, screenY: number) => {
      const viewBoxPoint = screenPointToViewBoxExpanded(screenX, screenY, 1, 0, 0, drawMetrics);
      const hit = hitTestSectorAtPoint(viewBoxPoint, macroLikeSectors);
      if (!hit) return;
      handleSectorSelect(hit.id as unknown as SectorId);
    },
    [drawMetrics, handleSectorSelect, macroLikeSectors],
  );

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .maxDistance(12)
    .onEnd((event) => {
      runOnJS(handleMapPress)(event.x, event.y);
    });

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.mapMeasure} onLayout={handleHostLayout}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={hostSize.width} height={hostSize.height}>
            <VeilFrontBlueprintGrid width={hostSize.width} height={hostSize.height} />
          </Svg>
        </View>
        <GestureDetector gesture={tapGesture}>
          <View style={[styles.mapFrame, { width: canvasWidth, height: canvasHeight }]}>
            <Svg width={canvasWidth} height={canvasHeight}>
              {mapDefinitions.map((sector) => {
                const sectorState = sectorById.get(sector.id);
                const veilBiome = sectorState?.veilBiome ?? 'NULL_ZONE';
                const biomeVisual = VEIL_BIOME_VISUALS[veilBiome];
                const isActive = sector.id === activeSectorId;
                const unlocked = isSectorUnlocked(sector.id);

                const canvasPoly = sector.mapGeometry.polygon.map((pt) => viewBoxPointToCanvas(pt, drawMetrics));
                const pathD = canvasPoly.length ? `M ${canvasPoly.map((p) => `${p.x} ${p.y}`).join(' L ')} Z` : '';

                const fill = !unlocked
                  ? 'rgba(15, 23, 42, 0.72)'
                  : isActive
                    ? hexToRgba(biomeVisual.fill, 0.4)
                    : 'transparent';
                const stroke = !unlocked
                  ? 'rgba(71, 85, 105, 0.55)'
                  : isActive
                    ? biomeVisual.glow
                    : 'rgba(148, 163, 184, 0.5)';

                return isActive ? null : (
                  <Path
                    key={sector.id}
                    d={pathD}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                  />
                );
              })}

              {/* Selected sector drawn last so its highlight sits above shared borders. */}
              {mapDefinitions.map((sector) => {
                if (sector.id !== activeSectorId) return null;
                const sectorState = sectorById.get(sector.id);
                const veilBiome = sectorState?.veilBiome ?? 'NULL_ZONE';
                const biomeVisual = VEIL_BIOME_VISUALS[veilBiome];
                const unlocked = isSectorUnlocked(sector.id);
                const canvasPoly = sector.mapGeometry.polygon.map((pt) => viewBoxPointToCanvas(pt, drawMetrics));
                const pathD = canvasPoly.length ? `M ${canvasPoly.map((p) => `${p.x} ${p.y}`).join(' L ')} Z` : '';
                const activeFill = unlocked
                  ? hexToRgba(biomeVisual.fill, 0.4)
                  : 'rgba(15, 23, 42, 0.85)';
                const activeStroke = unlocked ? biomeVisual.glow : 'rgba(148, 163, 184, 0.7)';
                return (
                  <React.Fragment key={`active-${sector.id}`}>
                    <AnimatedG opacity={glowOpacity}>
                      <Path d={pathD} fill="none" stroke={activeStroke} strokeWidth={activeStrokeWidth + 5} strokeLinejoin="round" />
                    </AnimatedG>
                    <Path d={pathD} fill={activeFill} stroke={activeStroke} strokeWidth={activeStrokeWidth} strokeLinejoin="round" />
                  </React.Fragment>
                );
              })}

              {/* Sector names */}
              {mapDefinitions.map((sector) => {
                const sectorState = sectorById.get(sector.id);
                const isActive = sector.id === activeSectorId;
                const unlocked = isSectorUnlocked(sector.id);
                const nodeAnchor = viewBoxPointToCanvas(
                  sector.mapGeometry.labelAnchor ?? polygonCentroid(sector.mapGeometry.polygon),
                  drawMetrics,
                );
                const displayName = sectorState?.displayName ?? sector.label;
                const labelLines = isActive
                  ? [sectorAbbreviation(displayName)]
                  : splitSectorLabelLines(sectorAbbreviation(displayName));
                const labelStartY = nodeAnchor.y - ((labelLines.length - 1) * labelLineHeight) / 2 + labelFontSize * 0.35;
                const fill = !unlocked
                  ? 'rgba(100, 116, 139, 0.85)'
                  : isActive
                    ? '#f8fafc'
                    : 'rgba(226, 232, 240, 0.6)';

                return (
                  <React.Fragment key={`label-${sector.id}`}>
                    {labelLines.map((line, lineIndex) => (
                      <SvgText
                        key={`${sector.id}-label-${lineIndex}`}
                        x={nodeAnchor.x}
                        y={labelStartY + lineIndex * labelLineHeight}
                        fill={fill}
                        fontSize={isActive ? labelFontSize * 1.08 : labelFontSize}
                        fontFamily="monospace"
                        fontWeight={isActive ? '800' : '500'}
                        letterSpacing={isDesktop ? 1.2 : 0.8}
                        textAnchor="middle"
                      >
                        {line}
                      </SvgText>
                    ))}
                    {!unlocked ? (
                      <SvgText
                        x={nodeAnchor.x}
                        y={labelStartY + labelLines.length * labelLineHeight}
                        fill="rgba(148, 163, 184, 0.75)"
                        fontSize={Math.max(4, labelFontSize * 0.72)}
                        fontFamily="monospace"
                        fontWeight="700"
                        letterSpacing={0.6}
                        textAnchor="middle"
                      >
                        {sectorLockLabels?.[sector.id] ?? 'LOCKED'}
                      </SvgText>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  mapMeasure: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFrame: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    position: 'relative',
  },
});
