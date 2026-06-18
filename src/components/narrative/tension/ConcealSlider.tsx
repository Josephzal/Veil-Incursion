import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { TensionMechanicProps } from './tensionMechanicTypes';

const PANEL_BG = '#141418';
const ACCENT_MUTED = '#9ca3af';
const DANGER_MUTED = '#7f1d1d';
const TRACK_HEIGHT = 240;
const HANDLE_HEIGHT = 18;
const ZONE_HEIGHT = 56;
const DURATION_MS = 8000;
const MAX_OUTSIDE_MS = 2500;
const GRACE_PERIOD_MS = 100;
const TICK_MS = 50;
const ZONE_MOVE_MS = 320;
const ZONE_HEIGHT_NORM = ZONE_HEIGHT / TRACK_HEIGHT;
const HALF_HANDLE_NORM = HANDLE_HEIGHT / 2 / TRACK_HEIGHT;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomZoneTop(): number {
  return Math.random() * (1 - ZONE_HEIGHT_NORM);
}

function handleInsideZone(handleCenter: number, zoneTop: number): boolean {
  const handleTop = handleCenter - HALF_HANDLE_NORM;
  const handleBottom = handleCenter + HALF_HANDLE_NORM;
  const zoneBottom = zoneTop + ZONE_HEIGHT_NORM;
  return handleTop >= zoneTop && handleBottom <= zoneBottom;
}

export default function ConcealSlider({
  onSuccess,
  onFailure,
  defaultPenalty,
}: TensionMechanicProps): React.JSX.Element {
  const initialZone = randomZoneTop();
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
      animateZoneTo(randomZoneTop());
    }, 850);
    return () => clearInterval(zoneTimer);
  }, [animateZoneTo, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return undefined;

    const tick = setInterval(() => {
      if (resolvedRef.current) return;

      elapsedRef.current += TICK_MS;
      const inside = handleInsideZone(handleCenterRef.current, zoneTopRef.current);
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
        const nextCenter = clamp(
          dragStartHandleRef.current + gesture.dy / TRACK_HEIGHT,
          HALF_HANDLE_NORM,
          1 - HALF_HANDLE_NORM,
        );
        setHandleCenter(nextCenter);
      },
      onPanResponderRelease: () => setIsDragging(false),
      onPanResponderTerminate: () => setIsDragging(false),
    }),
  ).current;

  const progressPct = Math.min(100, Math.round((elapsedMs / DURATION_MS) * 100));
  const exposurePct = Math.min(100, Math.round((outsideMs / MAX_OUTSIDE_MS) * 100));
  const handleTopPx = handleCenter * TRACK_HEIGHT - HANDLE_HEIGHT / 2;
  const zoneTopPx = Animated.multiply(zoneTopAnim, TRACK_HEIGHT);

  const penaltyHint = defaultPenalty
    ? defaultPenalty.type === 'HP'
      ? `DETECTION COST: -${defaultPenalty.amount} HP`
      : `DETECTION COST: +${defaultPenalty.amount} RESONANCE`
    : null;

  return (
    <View style={styles.root}>
      <Text style={styles.header}>CONCEAL SLIDER // STEALTH HOLD</Text>
      <View style={styles.panel}>
        <Text style={styles.instructions}>
          {hasStarted
            ? 'Keep the handle inside the safe zone for 8 seconds. The zone drifts — stay with it.'
            : 'Press and hold the bar to begin concealment.'}
        </Text>

        <View style={styles.statsRow}>
          <Text style={styles.stat}>
            {hasStarted ? `HOLD ${progressPct}%` : 'AWAITING HOLD'}
          </Text>
          <Text style={[styles.stat, hasStarted && outsideMs > MAX_OUTSIDE_MS * 0.6 && styles.statWarn]}>
            {hasStarted ? `EXPOSURE ${exposurePct}%` : 'STANDBY'}
          </Text>
        </View>

        <View style={styles.track} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.safeZone,
              {
                top: zoneTopPx,
                height: ZONE_HEIGHT,
              },
            ]}
          />
          <View
            style={[
              styles.handle,
              {
                top: handleTopPx,
                opacity: isDragging ? 1 : 0.92,
              },
            ]}
          />
        </View>

        <Text style={styles.hint}>
          {hasStarted
            ? 'Drag the handle vertically to match the safe zone.'
            : 'Touch the bar and hold to engage stealth tracking.'}
        </Text>

        {penaltyHint ? (
          <Text style={styles.penalty}>{penaltyHint}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  header: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
    color: ACCENT_MUTED,
  },
  panel: {
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: PANEL_BG,
    padding: 14,
    gap: 12,
  },
  instructions: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
    color: ACCENT_MUTED,
    letterSpacing: 0.4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.8,
    color: '#d1d5db',
  },
  statWarn: {
    color: '#fca5a5',
  },
  track: {
    alignSelf: 'center',
    width: 72,
    height: TRACK_HEIGHT,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#111827',
    position: 'relative',
    overflow: 'hidden',
  },
  safeZone: {
    position: 'absolute',
    left: 4,
    right: 4,
    backgroundColor: 'rgba(55, 65, 81, 0.55)',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  handle: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: HANDLE_HEIGHT,
    backgroundColor: '#9ca3af',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  standbyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 11, 15, 0.55)',
    zIndex: 2,
  },
  standbyText: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1,
    color: '#d1d5db',
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  penalty: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.5,
    color: DANGER_MUTED,
    textAlign: 'center',
  },
});
