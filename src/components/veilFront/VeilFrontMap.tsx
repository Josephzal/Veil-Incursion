import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
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
import { type ContractSectorCompatibility } from '../../utils/contractUi';
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
const CONNECTION_IDS: Array<[SectorId, SectorId]> = [
  ['THE_NULL_ZONE', 'THE_SLAG_WORKS'],
  ['THE_NULL_ZONE', 'THE_BLACKLINE_TERMINUS'],
  ['THE_NULL_ZONE', 'THE_ASHEN_WASTES'],
  ['THE_SLAG_WORKS', 'THE_ABYSSAL_SINK'],
  ['THE_ASHEN_WASTES', 'THE_ABYSSAL_SINK'],
  ['THE_BLACKLINE_TERMINUS', 'THE_ASHEN_WASTES'],
];

interface VeilFrontMapProps {
  theme: TerminalTheme;
  sectors: SectorState[];
  activeSectorId: SectorId;
  onSectorPress: (id: SectorId) => void;
  sectorCompatibilityById?: Partial<Record<SectorId, ContractSectorCompatibility>>;
}

function contractMarkerColor(compatibility: ContractSectorCompatibility | undefined): string | null {
  switch (compatibility) {
    case 'RECOMMENDED':
      return '#34d399';
    case 'VALID':
      return '#fbbf24';
    case 'UNAVAILABLE':
      return '#f87171';
    default:
      return null;
  }
}

function VeilFrontBlueprintGrid({ width, height }: { width: number; height: number }): React.JSX.Element {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.max(width, height) * 0.55;

  return (
    <>
      <Defs>
        <Pattern id="veilFrontGrid" width={28} height={28} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={28} y2={0} stroke="rgba(100, 116, 139, 0.035)" strokeWidth={0.6} />
          <Line x1={0} y1={0} x2={0} y2={28} stroke="rgba(100, 116, 139, 0.035)" strokeWidth={0.6} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#veilFrontGrid)" />
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <Circle
          key={ratio}
          cx={cx}
          cy={cy}
          r={maxRadius * ratio}
          fill="none"
          stroke="rgba(100, 116, 139, 0.035)"
          strokeWidth={0.8}
        />
      ))}
    </>
  );
}

/** Sector map canvas — SVG viewBox scaling only; chrome lives in SectorMapPanel overlays. */
export default function VeilFrontMap({
  sectors,
  activeSectorId,
  onSectorPress,
  sectorCompatibilityById = {},
}: VeilFrontMapProps): React.JSX.Element {
  const { isDesktop } = useHubLayout();
  const mapDefinitions = SECTOR_MAP_DEFINITIONS;
  const sectorById = useMemo(
    () => new Map(sectors.map((sector) => [sector.id, sector])),
    [sectors],
  );
  const [hostSize, setHostSize] = useState({ width: 320, height: 240 });

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
  const strokeWidth = isDesktop ? 2.5 : 2;
  const activeStrokeWidth = isDesktop ? 4 : 3;

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
      const viewBoxPoint = screenPointToViewBoxExpanded(
        screenX,
        screenY,
        1,
        0,
        0,
        drawMetrics,
      );
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

  const connectionLines = useMemo(() => {
    return CONNECTION_IDS.map(([a, b]) => {
      const defA = mapDefinitions.find((s) => s.id === a);
      const defB = mapDefinitions.find((s) => s.id === b);
      if (!defA || !defB) return null;
      const ptA = viewBoxPointToCanvas(
        defA.mapGeometry.labelAnchor ?? polygonCentroid(defA.mapGeometry.polygon),
        drawMetrics,
      );
      const ptB = viewBoxPointToCanvas(
        defB.mapGeometry.labelAnchor ?? polygonCentroid(defB.mapGeometry.polygon),
        drawMetrics,
      );
      return { key: `${a}-${b}`, ptA, ptB };
    }).filter((line): line is NonNullable<typeof line> => line != null);
  }, [drawMetrics, mapDefinitions]);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.mapMeasure} onLayout={handleHostLayout}>
        <GestureDetector gesture={tapGesture}>
          <View style={[styles.mapFrame, { width: canvasWidth, height: canvasHeight }]}>
            <Svg width={canvasWidth} height={canvasHeight}>
              <VeilFrontBlueprintGrid width={canvasWidth} height={canvasHeight} />

              {connectionLines.map((line) => (
                <Line
                  key={line.key}
                  x1={line.ptA.x}
                  y1={line.ptA.y}
                  x2={line.ptB.x}
                  y2={line.ptB.y}
                  stroke="rgba(100, 116, 139, 0.18)"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
              ))}

              {mapDefinitions.map((sector) => {
                const sectorState = sectorById.get(sector.id);
                const veilBiome = sectorState?.veilBiome ?? 'NULL_ZONE';
                const biomeVisual = VEIL_BIOME_VISUALS[veilBiome];
                const isActive = sector.id === activeSectorId;
                const fill = hexToRgba(biomeVisual.fill, isActive ? 0.38 : 0.16);
                const stroke = isActive
                  ? biomeVisual.glow
                  : hexToRgba(biomeVisual.stroke, 0.65);
                const canvasPoly = sector.mapGeometry.polygon.map((pt) =>
                  viewBoxPointToCanvas(pt, drawMetrics),
                );
                const pathD = canvasPoly.length
                  ? `M ${canvasPoly.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`
                  : '';
                const nodeAnchor = viewBoxPointToCanvas(
                  sector.mapGeometry.labelAnchor ?? polygonCentroid(sector.mapGeometry.polygon),
                  drawMetrics,
                );
                const shortLabel = sectorAbbreviation(sector.label);
                const labelLines = splitSectorLabelLines(shortLabel);
                const labelStartY = nodeAnchor.y
                  - ((labelLines.length - 1) * labelLineHeight) / 2
                  + labelFontSize * 0.35;
                const hasAnchor = sectorState?.activeAnchor != null;
                const highEcho = sectorState?.echoActivity === 'ELEVATED'
                  || sectorState?.echoActivity === 'CRITICAL';
                const highReward = (sectorState?.rewardLevel ?? 0) >= 4;
                const markerY = nodeAnchor.y - labelLineHeight * labelLines.length - 8;
                const contractMarker = contractMarkerColor(sectorCompatibilityById[sector.id]);

                return (
                  <React.Fragment key={sector.id}>
                    {isActive ? (
                      <Path
                        d={pathD}
                        fill="none"
                        stroke={biomeVisual.glow}
                        strokeWidth={activeStrokeWidth + 3}
                        opacity={0.35}
                      />
                    ) : null}
                    <Path
                      d={pathD}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isActive ? activeStrokeWidth : strokeWidth}
                    />
                    {hasAnchor ? (
                      <Circle cx={nodeAnchor.x + 14} cy={markerY} r={3.5} fill="#a855f7" opacity={0.9} />
                    ) : null}
                    {highEcho ? (
                      <Circle cx={nodeAnchor.x - 14} cy={markerY} r={3} fill="#818cf8" opacity={0.85} />
                    ) : null}
                    {highReward ? (
                      <Circle cx={nodeAnchor.x} cy={markerY - 8} r={2.5} fill="#fbbf24" opacity={0.9} />
                    ) : null}
                    {contractMarker ? (
                      <Circle cx={nodeAnchor.x} cy={markerY - 16} r={3} fill={contractMarker} opacity={0.95} />
                    ) : null}
                    {labelLines.map((line, lineIndex) => (
                      <SvgText
                        key={`${sector.id}-label-${lineIndex}`}
                        x={nodeAnchor.x}
                        y={labelStartY + lineIndex * labelLineHeight}
                        fill={isActive ? '#f8fafc' : 'rgba(226, 232, 240, 0.78)'}
                        fontSize={labelFontSize}
                        fontFamily="monospace"
                        fontWeight={isActive ? '700' : '500'}
                        letterSpacing={isDesktop ? 1.2 : 0.8}
                        textAnchor="middle"
                      >
                        {line}
                      </SvgText>
                    ))}
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
