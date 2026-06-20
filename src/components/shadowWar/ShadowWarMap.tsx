import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { calculateSectorControl } from '../../data/shadowWarEngine';
import { SHADOW_WAR_SECTORS, SHADOW_WAR_VIEWBOX } from '../../data/shadowWarSectors';
import type { CabalIpPool, ShadowWarSectorId } from '../../types/shadowWar';
import { TerminalTheme } from '../../types/theme';
import {
  clampPreviewMapTranslation,
  focalPinchTranslationPreview,
  getSectorCabalStrokeColor,
  getSectorTintColor,
  hitTestSectorAtPoint,
  resolveMapDrawMetrics,
  SECTOR_SELECT_HAPTIC_MS,
  screenPointToViewBoxPreview,
  viewBoxPointToCanvas,
} from '../../utils/sectorInfluenceVisual';

const MAP_BACKDROP = '#06080d';
const CONTESTED_COLOR = '#ef4444';
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

interface ShadowWarMapProps {
  theme: TerminalTheme;
  activeSectorId: ShadowWarSectorId;
  sectorIp: Record<ShadowWarSectorId, CabalIpPool>;
  onSectorPress: (id: ShadowWarSectorId) => void;
  expandedDetailPanel?: React.ReactNode;
}

function MapViewport({
  theme,
  activeSectorId,
  sectorIp,
  onSectorPress,
  fillContainer = false,
  onOpen,
  hint,
}: ShadowWarMapProps & { fillContainer?: boolean; onOpen?: () => void; hint: string }) {
  const sectors = SHADOW_WAR_SECTORS;
  const [hostWidth, setHostWidth] = useState(320);
  const [contestedPulse, setContestedPulse] = useState(0);
  const canvasHeight = hostWidth * (SHADOW_WAR_VIEWBOX.height / SHADOW_WAR_VIEWBOX.width);

  useEffect(() => {
    const timer = setInterval(() => {
      setContestedPulse((tick) => tick + 1);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  const contestedFillAlpha = 0.32 + 0.18 * (0.5 + 0.5 * Math.sin(contestedPulse * 0.12));

  const zoomScale = useSharedValue(1);
  const savedZoomScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const drawMetrics = useMemo(
    () => resolveMapDrawMetrics(hostWidth, canvasHeight, SHADOW_WAR_VIEWBOX.width, SHADOW_WAR_VIEWBOX.height, 'contain'),
    [canvasHeight, hostWidth],
  );

  const handleHostLayout = useCallback((event: LayoutChangeEvent) => {
    setHostWidth(event.nativeEvent.layout.width);
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
    (screenX: number, screenY: number, zoom: number, offsetX: number, offsetY: number) => {
      const viewBoxPoint = screenPointToViewBoxPreview(
        screenX,
        screenY,
        hostWidth,
        canvasHeight,
        SHADOW_WAR_VIEWBOX.width,
        SHADOW_WAR_VIEWBOX.height,
        zoom,
        offsetX,
        offsetY,
      );
      const hit = hitTestSectorAtPoint(viewBoxPoint, macroLikeSectors);
      if (!hit) return;
      handleSectorSelect(hit.id as unknown as ShadowWarSectorId);
    },
    [canvasHeight, handleSectorSelect, hostWidth, macroLikeSectors],
  );

  const resetViewport = useCallback(() => {
    zoomScale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedZoomScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [savedTranslateX, savedTranslateY, savedZoomScale, translateX, translateY, zoomScale]);

  const tapGesture = Gesture.Tap()
    .maxDuration(450)
    .onEnd((event) => {
      runOnJS(handleMapPress)(event.x, event.y, zoomScale.value, translateX.value, translateY.value);
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(380)
    .onEnd(() => {
      runOnJS(resetViewport)();
    });

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      focalX.value = event.focalX;
      focalY.value = event.focalY;
      savedZoomScale.value = zoomScale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, savedZoomScale.value * event.scale));
      zoomScale.value = nextScale;
      translateX.value = focalPinchTranslationPreview(
        focalX.value,
        savedTranslateX.value,
        savedZoomScale.value,
        nextScale,
      );
      translateY.value = focalPinchTranslationPreview(
        focalY.value,
        savedTranslateY.value,
        savedZoomScale.value,
        nextScale,
      );
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (zoomScale.value <= 1) return;
      const clamped = clampPreviewMapTranslation(
        savedTranslateX.value + event.translationX,
        savedTranslateY.value + event.translationY,
        zoomScale.value,
        hostWidth,
        canvasHeight,
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const mapGesture = Gesture.Simultaneous(
    Gesture.Exclusive(doubleTapGesture, tapGesture),
    pinchGesture,
    panGesture,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: zoomScale.value },
    ],
  }));

  return (
    <View style={[styles.viewportRoot, fillContainer && styles.viewportFill]} onLayout={handleHostLayout}>
      <GestureDetector gesture={mapGesture}>
        <Animated.View style={[styles.mapFrame, { height: canvasHeight, borderColor: theme.borderColor }, animatedStyle]}>
          <Svg width={hostWidth} height={canvasHeight}>
            {sectors.map((sector) => {
              const control = calculateSectorControl(sectorIp[sector.id]);
              const isActive = sector.id === activeSectorId;
              const isContested = control.status === 'CONTESTED';
              const fill = isContested
                ? `rgba(239, 68, 68, ${contestedFillAlpha.toFixed(2)})`
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
              const label = viewBoxPointToCanvas(sector.mapGeometry.labelAnchor, drawMetrics);
              return (
                <React.Fragment key={sector.id}>
                  <Path d={pathD} fill={fill} stroke={stroke} strokeWidth={isActive ? 2.5 : 1.5} />
                  <SvgText
                    x={label.x}
                    y={label.y}
                    fill={isContested ? CONTESTED_COLOR : theme.textColor}
                    fontSize={8}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {sector.label.split(' ').slice(-1)[0]?.toUpperCase()}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </Animated.View>
      </GestureDetector>

      {!fillContainer && onOpen ? (
        <Pressable onPress={onOpen} style={[styles.expandBtn, { borderColor: theme.statusColor }]}>
          <Text style={[styles.expandBtnText, { color: theme.statusColor }]}>[ EXPAND MAP ]</Text>
        </Pressable>
      ) : null}

      <Text style={[styles.hint, { color: theme.mutedColor }]}>{hint}</Text>
    </View>
  );
}

export default function ShadowWarMap({
  expandedDetailPanel,
  ...props
}: ShadowWarMapProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const { theme } = props;

  return (
    <View style={styles.root}>
      <GestureHandlerRootView>
        <MapViewport
          {...props}
          onOpen={() => setExpanded(true)}
          hint="TAP SECTOR // PINCH ZOOM // DOUBLE-TAP RESET // [ EXPAND MAP ]"
        />
      </GestureHandlerRootView>

      <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <GestureHandlerRootView style={styles.expandedRoot}>
          <View style={styles.expandedBackdrop}>
            <View style={styles.expandedHeader}>
              <Text style={[styles.expandedTitle, { color: theme.primaryColor }]}>
                SHADOW WAR // VEIL CONTROL
              </Text>
              <Pressable onPress={() => setExpanded(false)} style={[styles.closeBtn, { borderColor: theme.borderColor }]}>
                <Text style={[styles.closeBtnText, { color: theme.mutedColor }]}>[ CLOSE ]</Text>
              </Pressable>
            </View>
            <MapViewport {...props} fillContainer hint="TAP SECTOR // PINCH ZOOM // DOUBLE-TAP RESET" />
            {expandedDetailPanel ? <View style={styles.expandedDetail}>{expandedDetailPanel}</View> : null}
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 4 },
  viewportRoot: { width: '100%' },
  viewportFill: { flex: 1 },
  mapFrame: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: MAP_BACKDROP,
    borderWidth: StyleSheet.hairlineWidth,
  },
  expandBtn: {
    marginTop: 8,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  expandBtnText: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  hint: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.4, marginTop: 6, textAlign: 'center' },
  expandedRoot: { flex: 1 },
  expandedBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', padding: 12 },
  expandedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  expandedTitle: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  closeBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  closeBtnText: { fontFamily: 'monospace', fontSize: 8 },
  expandedDetail: { marginTop: 8, maxHeight: 180 },
});
