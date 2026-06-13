import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { TensionMechanicProps } from './tensionMechanicTypes';

const PANEL_BG = '#141418';
const ACCENT_MUTED = '#9ca3af';
const DANGER_MUTED = '#7f1d1d';
const TRACK_HEIGHT = 240;
const HANDLE_HEIGHT = 18;
const ZONE_HEIGHT = 56;
const DURATION_MS = 8000;
const MAX_OUTSIDE_MS = 1500;
const TICK_MS = 50;
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
  const [handleCenter, setHandleCenter] = useState(0.5);
  const [zoneTop, setZoneTop] = useState(randomZoneTop);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [outsideMs, setOutsideMs] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleCenterRef = useRef(handleCenter);
  const zoneTopRef = useRef(zoneTop);
  const dragStartHandleRef = useRef(handleCenter);
  const elapsedRef = useRef(0);
  const outsideRef = useRef(0);
  const resolvedRef = useRef(false);

  handleCenterRef.current = handleCenter;
  zoneTopRef.current = zoneTop;

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

  useEffect(() => {
    const zoneTimer = setInterval(() => {
      if (resolvedRef.current) return;
      setZoneTop(randomZoneTop());
    }, 850);
    return () => clearInterval(zoneTimer);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      if (resolvedRef.current) return;

      elapsedRef.current += TICK_MS;
      const inside = handleInsideZone(handleCenterRef.current, zoneTopRef.current);
      if (!inside) {
        outsideRef.current += TICK_MS;
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
  }, [resolveFailure, resolveSuccess]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !resolvedRef.current,
      onMoveShouldSetPanResponder: () => !resolvedRef.current,
      onPanResponderGrant: () => {
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
  const zoneTopPx = zoneTop * TRACK_HEIGHT;

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
          Keep the handle inside the safe zone for 8 seconds. The zone drifts — stay with it.
        </Text>

        <View style={styles.statsRow}>
          <Text style={styles.stat}>HOLD {progressPct}%</Text>
          <Text style={[styles.stat, outsideMs > MAX_OUTSIDE_MS * 0.6 && styles.statWarn]}>
            EXPOSURE {exposurePct}%
          </Text>
        </View>

        <View style={styles.track} {...panResponder.panHandlers}>
          <View
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

        <Text style={styles.hint}>Drag the handle vertically to match the safe zone.</Text>

        {penaltyHint ? (
          <Text style={styles.penalty}>{penaltyHint}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
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
