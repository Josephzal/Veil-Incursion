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
import TerminalText from '../TerminalText';
import ContestedSectorPath from './ContestedSectorPath';
import { calculateSectorControl } from '../../data/shadowWarEngine';
import { SHADOW_WAR_SECTORS, SHADOW_WAR_VIEWBOX } from '../../data/shadowWarSectors';
import type { CabalIpPool, ShadowWarSectorId } from '../../types/shadowWar';
import { TerminalTheme } from '../../types/theme';
import {
  getHolographicSectorFill,
  getHolographicSectorStroke,
  hitTestSectorAtPoint,
  isNeutralSector,
  polygonCentroid,
  resolveMapDrawMetrics,
  screenPointToViewBoxExpanded,
  SECTOR_SELECT_HAPTIC_MS,
  splitSectorLabelLines,
  viewBoxPointToCanvas,
} from '../../utils/sectorInfluenceVisual';

const MAP_BACKDROP = '#04060a';

interface ShadowWarMapProps {
  theme: TerminalTheme;
  activeSectorId: ShadowWarSectorId;
  sectorIp: Record<ShadowWarSectorId, CabalIpPool>;
  onSectorPress: (id: ShadowWarSectorId) => void;
}

function ShadowWarBlueprintGrid({
  width,
  height,
}: {
  width: number;
  height: number;
}): React.JSX.Element {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.max(width, height) * 0.55;

  return (
    <>
      <Defs>
        <Pattern id="shadowWarGrid" width={28} height={28} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={28} y2={0} stroke="rgba(100, 116, 139, 0.05)" strokeWidth={0.6} />
          <Line x1={0} y1={0} x2={0} y2={28} stroke="rgba(100, 116, 139, 0.05)" strokeWidth={0.6} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#shadowWarGrid)" />
      {[0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
        <Circle
          key={ratio}
          cx={cx}
          cy={cy}
          r={maxRadius * ratio}
          fill="none"
          stroke="rgba(100, 116, 139, 0.04)"
          strokeWidth={0.8}
        />
      ))}
    </>
  );
}

export default function ShadowWarMap({
  theme,
  activeSectorId,
  sectorIp,
  onSectorPress,
}: ShadowWarMapProps): React.JSX.Element {
  const { isDesktop } = useHubLayout();
  const sectors = SHADOW_WAR_SECTORS;
  const [hostWidth, setHostWidth] = useState(320);
  const [hostHeight, setHostHeight] = useState(160);

  const canvasHeight = hostHeight > 0
    ? hostHeight
    : hostWidth * (SHADOW_WAR_VIEWBOX.height / SHADOW_WAR_VIEWBOX.width);

  const drawMetrics = useMemo(
    () => resolveMapDrawMetrics(
      hostWidth,
      canvasHeight,
      SHADOW_WAR_VIEWBOX.width,
      SHADOW_WAR_VIEWBOX.height,
      'contain',
    ),
    [canvasHeight, hostWidth],
  );

  const labelFontSize = useMemo(
    () => Math.max(4.5, Math.min(isDesktop ? 10 : 6, drawMetrics.scale * (isDesktop ? 6.2 : 4.2))),
    [drawMetrics.scale, isDesktop],
  );
  const labelLineHeight = labelFontSize + (isDesktop ? 2 : 1.2);
  const strokeWidth = isDesktop ? 3 : 2;
  const activeStrokeWidth = isDesktop ? 3.5 : 2.5;

  const handleHostLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setHostWidth(width);
    setHostHeight(height);
  }, []);

  const macroLikeSectors = useMemo(
    () => sectors.map((sector) => ({
      id: sector.id as unknown as import('../../types/regional').MacroSectorId,
      label: sector.label,
      continent: 'NA' as const,
      metropolitanNode: sector.label,
      baseTrafficDensity: 50,
      defaultFaction: 'TERRAN_GRID' as const,
      influence: sectorIp[sector.id],
      mapGeometry: sector.mapGeometry,
    })),
    [sectorIp, sectors],
  );

  const handleSectorSelect = useCallback((id: ShadowWarSectorId) => {
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
      handleSectorSelect(hit.id as unknown as ShadowWarSectorId);
    },
    [drawMetrics, handleSectorSelect, macroLikeSectors],
  );

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .maxDistance(12)
    .onEnd((event) => {
      runOnJS(handleMapPress)(event.x, event.y);
    });

  return (
    <View style={styles.root} onLayout={handleHostLayout}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <GestureDetector gesture={tapGesture}>
          <View style={[styles.mapFrame, { height: canvasHeight }]}>
            <Svg width={hostWidth} height={canvasHeight}>
              <ShadowWarBlueprintGrid width={hostWidth} height={canvasHeight} />

              {sectors.map((sector) => {
                const pool = sectorIp[sector.id];
                const control = calculateSectorControl(pool);
                const isActive = sector.id === activeSectorId;
                const isContested = control.status === 'CONTESTED';
                const neutral = isNeutralSector(control.totalIp);
                const fill = getHolographicSectorFill(
                  control.displayInfluence,
                  isContested,
                  control.controllingFaction,
                  control.totalIp,
                );
                const stroke = getHolographicSectorStroke(
                  control.displayInfluence,
                  isContested,
                  control.controllingFaction,
                  control.totalIp,
                );
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
                const labelLines = splitSectorLabelLines(sector.label);
                const labelStartY = nodeAnchor.y
                  - ((labelLines.length - 1) * labelLineHeight) / 2
                  + labelFontSize * 0.35;
                const pathStrokeWidth = isActive ? activeStrokeWidth : strokeWidth;
                const pathProps = {
                  d: pathD,
                  fill,
                  stroke,
                  strokeWidth: pathStrokeWidth,
                  strokeDasharray: neutral ? '6 4' : undefined,
                };

                return (
                  <React.Fragment key={sector.id}>
                    {isContested ? (
                      <ContestedSectorPath {...pathProps} />
                    ) : (
                      <Path {...pathProps} strokeOpacity={1} />
                    )}

                    {labelLines.map((line, lineIndex) => (
                      <SvgText
                        key={`${sector.id}-label-${lineIndex}`}
                        x={nodeAnchor.x}
                        y={labelStartY + lineIndex * labelLineHeight}
                        fill={isActive ? '#f8fafc' : 'rgba(226, 232, 240, 0.72)'}
                        fontSize={labelFontSize}
                        fontFamily="monospace"
                        fontWeight={isActive ? '700' : '500'}
                        letterSpacing={isDesktop ? 1.4 : 0.8}
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
      </GestureHandlerRootView>

      <TerminalText
        size={6}
        letterSpacing={0.4}
        style={[styles.hint, { color: theme.mutedColor }]}
      >
        SELECT SECTOR TO DISPLAY SHADOW WAR INFLUENCE
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  gestureRoot: {
    flex: 1,
    minHeight: 0,
  },
  mapFrame: {
    width: '100%',
    flex: 1,
    overflow: 'hidden',
    backgroundColor: MAP_BACKDROP,
  },
  hint: {
    marginTop: 4,
    textAlign: 'center',
    flexShrink: 0,
  },
});
