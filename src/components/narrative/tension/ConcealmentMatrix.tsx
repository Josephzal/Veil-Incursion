import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';
import {
  NARRATIVE_UNIFIED_PANEL_BG,
  NARRATIVE_UNIFIED_PANEL_BORDER,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import type { TensionMechanicProps } from './tensionMechanicTypes';

const MUTED_WHITE = '#F8FAFC';
const BODY_MUTED = '#94A3B8';
const TELEMETRY_MUTED = '#94A3B8';
const TERMINAL_GREEN = '#00ff33';
const THUMB_COLOR = '#F8FAFC';
const TRACK_BORDER = '#334155';
const ZONE_BORDER = '#06B6D4';
const ZONE_FILL = 'rgba(6, 182, 212, 0.15)';
const COLLAPSE_RED = '#EF4444';
const EXPOSURE_WARN = '#FCA5A5';

const DURATION_MS = 8000;
const MAX_OUTSIDE_MS = 2500;
const GRACE_PERIOD_MS = 100;
const TICK_MS = 50;
const ZONE_MOVE_MS = 320;

const INSTRUMENT_COLUMN_WIDTH = 160;
const TRACK_WIDTH = 64;
const TRACK_HEIGHT = 300;
const HANDLE_HEIGHT = 12;
const ZONE_HEIGHT_BASE = 70;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomZoneTop(zoneHeightNorm: number): number {
  return Math.random() * (1 - zoneHeightNorm);
}

function handleInsideZone(
  handleCenter: number,
  zoneTop: number,
  halfHandleNorm: number,
  zoneHeightNorm: number,
): boolean {
  const handleTop = handleCenter - halfHandleNorm;
  const handleBottom = handleCenter + halfHandleNorm;
  const zoneBottom = zoneTop + zoneHeightNorm;
  return handleTop >= zoneTop && handleBottom <= zoneBottom;
}

/** Terran Grid concealment hold mini-game — centered instrument column. */
export default function ConcealmentMatrix({
  onSuccess,
  onFailure,
  defaultPenalty,
}: TensionMechanicProps): React.JSX.Element {
  const { fontScale, scaleSize, scaleSpacing, scaleFont } = useResponsiveLayout();

  const instrumentWidth = scaleSize(INSTRUMENT_COLUMN_WIDTH);
  const trackHeight = scaleSize(TRACK_HEIGHT);
  const trackWidth = scaleSize(TRACK_WIDTH);
  const handleHeight = scaleSize(HANDLE_HEIGHT);
  const zoneHeight = scaleSize(ZONE_HEIGHT_BASE);

  const zoneHeightNorm = zoneHeight / trackHeight;
  const halfHandleNorm = handleHeight / 2 / trackHeight;

  const trackHeightRef = useRef(trackHeight);
  trackHeightRef.current = trackHeight;
  const halfHandleNormRef = useRef(halfHandleNorm);
  halfHandleNormRef.current = halfHandleNorm;
  const zoneHeightNormRef = useRef(zoneHeightNorm);
  zoneHeightNormRef.current = zoneHeightNorm;

  const initialZone = randomZoneTop(zoneHeightNorm);
  const zoneTopAnim = useRef(new Animated.Value(initialZone)).current;
  const [handleCenter, setHandleCenter] = useState(0.5);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [outsideMs, setOutsideMs] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const handleCenterRef = useRef(handleCenter);
  const zoneTopRef = useRef(initialZone);
  const dragStartHandleRef = useRef(handleCenter);
  const elapsedRef = useRef(0);
  const outsideRef = useRef(0);
  const graceElapsedRef = useRef(0);
  const resolvedRef = useRef(false);
  const hasStartedRef = useRef(false);

  handleCenterRef.current = handleCenter;

  const resolveSuccess = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onSuccess();
  }, [onSuccess]);

  const resolveFailure = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onFailure();
  }, [onFailure]);

  const animateZoneTo = useCallback((nextTop: number) => {
    Animated.timing(zoneTopAnim, {
      toValue: nextTop,
      duration: ZONE_MOVE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [zoneTopAnim]);

  useEffect(() => {
    const listenerId = zoneTopAnim.addListener(({ value }) => {
      zoneTopRef.current = value;
    });
    return () => zoneTopAnim.removeListener(listenerId);
  }, [zoneTopAnim]);

  useEffect(() => {
    if (!hasStarted) return undefined;

    const zoneTimer = setInterval(() => {
      if (resolvedRef.current) return;
      animateZoneTo(randomZoneTop(zoneHeightNormRef.current));
    }, 850);
    return () => clearInterval(zoneTimer);
  }, [animateZoneTo, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return undefined;

    const tick = setInterval(() => {
      if (resolvedRef.current) return;

      elapsedRef.current += TICK_MS;
      const inside = handleInsideZone(
        handleCenterRef.current,
        zoneTopRef.current,
        halfHandleNormRef.current,
        zoneHeightNormRef.current,
      );
      if (inside) {
        graceElapsedRef.current = 0;
      } else {
        graceElapsedRef.current += TICK_MS;
        if (graceElapsedRef.current > GRACE_PERIOD_MS) {
          outsideRef.current += TICK_MS;
        }
      }

      setElapsedMs(elapsedRef.current);
      setOutsideMs(outsideRef.current);

      if (outsideRef.current > MAX_OUTSIDE_MS) {
        resolveFailure();
        return;
      }
      if (elapsedRef.current >= DURATION_MS) {
        resolveSuccess();
      }
    }, TICK_MS);

    return () => clearInterval(tick);
  }, [hasStarted, resolveFailure, resolveSuccess]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !resolvedRef.current,
      onMoveShouldSetPanResponder: () => !resolvedRef.current,
      onPanResponderGrant: () => {
        if (resolvedRef.current) return;
        if (!hasStartedRef.current) {
          hasStartedRef.current = true;
          setHasStarted(true);
        }
        dragStartHandleRef.current = handleCenterRef.current;
        setIsDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        if (resolvedRef.current) return;
        const height = trackHeightRef.current;
        const halfNorm = halfHandleNormRef.current;
        const nextCenter = clamp(
          dragStartHandleRef.current + gesture.dy / height,
          halfNorm,
          1 - halfNorm,
        );
        setHandleCenter(nextCenter);
      },
      onPanResponderRelease: () => setIsDragging(false),
      onPanResponderTerminate: () => setIsDragging(false),
    }),
  ).current;

  const progressPct = Math.min(100, Math.round((elapsedMs / DURATION_MS) * 100));
  const exposurePct = Math.min(100, Math.round((outsideMs / MAX_OUTSIDE_MS) * 100));
  const handleTopPx = handleCenter * trackHeight - handleHeight / 2;
  const zoneTopPx = Animated.multiply(zoneTopAnim, trackHeight);

  const penaltyHint = defaultPenalty
    ? defaultPenalty.type === 'HP'
      ? `DETECTION COST: -${defaultPenalty.amount} HP`
      : `DETECTION COST: +${defaultPenalty.amount} RESONANCE`
    : null;

  const panelPad = scaleSpacing(NARRATIVE_UNIFIED_PANEL_PADDING);

  const scales = useMemo(
    () => ({
      header: 9 * fontScale,
      headerLine: 12 * fontScale,
      body: 10 * fontScale,
      bodyLine: 15 * fontScale,
      telemetry: 10 * fontScale,
      telemetryLine: 12 * fontScale,
      hint: 9 * fontScale,
      hintLine: 13 * fontScale,
      penalty: scaleFont(11),
      penaltyLine: scaleFont(14),
    }),
    [fontScale, scaleFont],
  );

  const leftStat = hasStarted ? `HOLD ${progressPct}%` : '';
  const rightStat = hasStarted ? `EXPOSURE ${exposurePct}%` : 'HOLD SLIDER TO BEGIN';
  const exposureWarn = hasStarted && outsideMs > MAX_OUTSIDE_MS * 0.6;
  const telemetryIdle = !hasStarted;

  const hintText = hasStarted
    ? 'Drag the handle vertically to match the safe zone.'
    : '';

  return (
    <View
      style={[
        styles.panel,
        {
          padding: panelPad,
        },
      ]}
    >
      <Text
        style={[
          styles.header,
          { fontSize: scales.header, lineHeight: scales.headerLine },
        ]}
      >
        CONCEALMENT MATRIX // EVASION PROTOCOL
      </Text>

      <Text
        style={[
          styles.instructions,
          {
            fontSize: scales.body,
            lineHeight: scales.bodyLine,
            marginBottom: scaleSpacing(32),
          },
        ]}
      >
        Maintain active concealment. Hold the operative signature within the safe band.
      </Text>

      <View
        style={[
          styles.instrumentColumn,
          {
            width: instrumentWidth,
            marginTop: scaleSpacing(24),
          },
        ]}
      >
        <View style={[styles.statsRow, { marginBottom: scaleSpacing(12) }]}>
          <Text
            style={[
              styles.telemetry,
              telemetryIdle && styles.telemetryIdle,
              {
                fontSize: scales.telemetry,
                lineHeight: scales.telemetryLine,
              },
            ]}
          >
            {leftStat}
          </Text>
          <Text
            style={[
              styles.telemetry,
              telemetryIdle && styles.telemetryIdle,
              exposureWarn && styles.telemetryWarn,
              {
                fontSize: scales.telemetry,
                lineHeight: scales.telemetryLine,
              },
            ]}
          >
            {rightStat}
          </Text>
        </View>

        <View
          style={[
            styles.track,
            {
              width: trackWidth,
              height: trackHeight,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.safeZone,
              {
                top: zoneTopPx,
                height: zoneHeight,
              },
            ]}
          />
          <View
            style={[
              styles.handle,
              {
                top: handleTopPx,
                height: handleHeight,
                opacity: isDragging ? 1 : 0.95,
              },
            ]}
          />
        </View>
      </View>

      <View style={[styles.hintSlot, { minHeight: scales.hintLine, marginTop: scaleSpacing(16) }]}>
        <Text
          style={[
            styles.hint,
            {
              fontSize: scales.hint,
              lineHeight: scales.hintLine,
              opacity: 0.6,
            },
          ]}
        >
          {hintText}
        </Text>
      </View>

      {penaltyHint ? (
        <Text
          style={[
            styles.penalty,
            {
              fontSize: scales.penalty,
              lineHeight: scales.penaltyLine,
              marginTop: scaleSpacing(32),
            },
          ]}
        >
          {penaltyHint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    backgroundColor: NARRATIVE_UNIFIED_PANEL_BG,
    borderWidth: 1,
    borderColor: NARRATIVE_UNIFIED_PANEL_BORDER,
    justifyContent: 'flex-start',
  },
  header: {
    fontFamily: 'monospace',
    letterSpacing: 1,
    color: BODY_MUTED,
    fontWeight: '700',
  },
  instructions: {
    fontFamily: 'monospace',
    color: MUTED_WHITE,
    letterSpacing: 0.4,
    marginTop: 12,
  },
  instrumentColumn: {
    alignSelf: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  telemetry: {
    fontFamily: 'monospace',
    letterSpacing: 1,
    color: TELEMETRY_MUTED,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  telemetryWarn: {
    color: EXPOSURE_WARN,
  },
  telemetryIdle: {
    color: TERMINAL_GREEN,
  },
  track: {
    alignSelf: 'center',
    backgroundColor: '#020617',
    borderWidth: 2,
    borderColor: TRACK_BORDER,
    overflow: 'hidden',
    position: 'relative',
  },
  safeZone: {
    position: 'absolute',
    left: 0,
    width: '100%',
    backgroundColor: ZONE_FILL,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: ZONE_BORDER,
  },
  handle: {
    position: 'absolute',
    alignSelf: 'center',
    left: '15%',
    width: '70%',
    backgroundColor: THUMB_COLOR,
    borderRadius: 2,
  },
  hintSlot: {
    alignSelf: 'center',
    alignItems: 'center',
    maxWidth: 280,
  },
  hint: {
    fontFamily: 'monospace',
    letterSpacing: 0.4,
    color: MUTED_WHITE,
    textAlign: 'center',
  },
  penalty: {
    fontFamily: 'monospace',
    letterSpacing: 1.2,
    color: COLLAPSE_RED,
    textAlign: 'center',
    fontWeight: '800',
    alignSelf: 'center',
  },
});
