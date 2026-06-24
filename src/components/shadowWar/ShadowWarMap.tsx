import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { calculateSectorControl } from '../../data/shadowWarEngine';
import { SHADOW_WAR_SECTORS, SHADOW_WAR_VIEWBOX } from '../../data/shadowWarSectors';
import type { CabalIpPool, ShadowWarSectorId } from '../../types/shadowWar';
import { TerminalTheme } from '../../types/theme';
import {
  getSectorCabalStrokeColor,
  getSectorTintColor,
  hitTestSectorAtPoint,
  resolveMapDrawMetrics,
  screenPointToViewBoxExpanded,
  SECTOR_SELECT_HAPTIC_MS,
  splitSectorLabelLines,
  viewBoxPointToCanvas,
} from '../../utils/sectorInfluenceVisual';

const MAP_BACKDROP = '#06080d';
const CONTESTED_COLOR = '#ef4444';
const CONTESTED_FILL = 'rgba(239, 68, 68, 0.42)';
const SECTOR_LABEL_COLOR = '#ffffff';

interface ShadowWarMapProps {
  theme: TerminalTheme;
  activeSectorId: ShadowWarSectorId;
  sectorIp: Record<ShadowWarSectorId, CabalIpPool>;
  onSectorPress: (id: ShadowWarSectorId) => void;
}

export default function ShadowWarMap({
  theme,
  activeSectorId,
  sectorIp,
  onSectorPress,
}: ShadowWarMapProps): React.JSX.Element {
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
    () => Math.max(5, Math.min(8, drawMetrics.scale * 5.5)),
    [drawMetrics.scale],
  );
  const labelLineHeight = labelFontSize + 1.5;

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
          <View style={[styles.mapFrame, { borderColor: theme.borderColor, height: canvasHeight }]}>
            <Svg width={hostWidth} height={canvasHeight}>
              {sectors.map((sector) => {
                const control = calculateSectorControl(sectorIp[sector.id]);
                const isActive = sector.id === activeSectorId;
                const isContested = control.status === 'CONTESTED';
                const fill = isContested
                  ? CONTESTED_FILL
                  : getSectorTintColor(control.displayInfluence, isActive);
                const stroke = isContested
                  ? CONTESTED_COLOR
                  : getSectorCabalStrokeColor(control.displayInfluence, isActive);
                const canvasPoly = sector.mapGeometry.polygon.map((pt) =>
                  viewBoxPointToCanvas(pt, drawMetrics),
                );
                const pathD = canvasPoly.length
                  ? `M ${canvasPoly.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`
                  : '';
                const labelAnchor = viewBoxPointToCanvas(sector.mapGeometry.labelAnchor, drawMetrics);
                const labelLines = splitSectorLabelLines(sector.label);
                const labelBlockHeight = labelLines.length * labelLineHeight;
                const labelStartY = labelAnchor.y - labelBlockHeight / 2 + labelFontSize * 0.35;
                return (
                  <React.Fragment key={sector.id}>
                    <Path d={pathD} fill={fill} stroke={stroke} strokeWidth={isActive ? 2.5 : 1.5} />
                    {labelLines.map((line, lineIndex) => (
                      <SvgText
                        key={`${sector.id}-label-${lineIndex}`}
                        x={labelAnchor.x}
                        y={labelStartY + lineIndex * labelLineHeight}
                        fill={SECTOR_LABEL_COLOR}
                        fontSize={labelFontSize}
                        fontFamily="monospace"
                        fontWeight={isActive ? '700' : '400'}
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

      <Text style={[styles.hint, { color: theme.mutedColor }]}>
        TAP SECTOR TO SELECT
      </Text>
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.3,
    marginTop: 4,
    textAlign: 'center',
    flexShrink: 0,
  },
});
