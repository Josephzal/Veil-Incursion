import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import HapticPressable from '../HapticPressable';
import type { ActiveReloadResult } from '../../types/classCombatResources';
import { HEX_RELOAD_JAM_STAMINA_PENALTY } from '../../types/hexShotState';
import {
  ACTIVE_RELOAD_PASS_MS,
  buildReloadZoneConfig,
  resolveActiveReloadZone,
} from '../../data/activeReloadEngine';

export type ActiveReloadMode = 'flow' | 'tactical';

interface ActiveReloadOverlayProps {
  visible: boolean;
  mode?: ActiveReloadMode;
  perfectWindowScale?: number;
  onResolve: (result: ActiveReloadResult, cursorRatio: number) => void;
}

const CURSOR_WIDTH = 8;
const MIN_BAR_WIDTH = 120;

function ActiveReloadOverlay({
  visible,
  mode = 'tactical',
  perfectWindowScale = 1,
  onResolve,
}: ActiveReloadOverlayProps): React.JSX.Element | null {
  const [barWidth, setBarWidth] = useState(0);
  const cursorRatio = useSharedValue(0);
  const startMsRef = useRef(0);
  const resolvingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const onResolveRef = useRef(onResolve);
  onResolveRef.current = onResolve;
  const zoneConfig = useMemo(
    () => buildReloadZoneConfig(perfectWindowScale),
    [perfectWindowScale],
  );
  const zoneConfigRef = useRef(zoneConfig);
  zoneConfigRef.current = zoneConfig;

  const handleBarLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setBarWidth((prev) => (prev === width ? prev : width));
  }, []);

  useEffect(() => {
    if (!visible) {
      resolvingRef.current = false;
      cursorRatio.value = 0;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    startMsRef.current = Date.now();
    resolvingRef.current = false;
    cursorRatio.value = 0;

    const tick = () => {
      const elapsed = Date.now() - startMsRef.current;
      const ratio = Math.min(1, elapsed / ACTIVE_RELOAD_PASS_MS);
      cursorRatio.value = ratio;
      if (ratio >= 1 && !resolvingRef.current) {
        resolvingRef.current = true;
        onResolveRef.current(resolveActiveReloadZone(1, zoneConfigRef.current), 1);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, cursorRatio]);

  const cursorStyle = useAnimatedStyle(() => {
    const track = Math.max(MIN_BAR_WIDTH, barWidth) - CURSOR_WIDTH;
    const left = Math.max(0, Math.min(track, cursorRatio.value * track));
    return { transform: [{ translateX: left }] };
  }, [barWidth]);

  if (!visible) return null;

  const handleTap = () => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    onResolveRef.current(
      resolveActiveReloadZone(cursorRatio.value, zoneConfig),
      cursorRatio.value,
    );
  };

  const goldLeftPct = zoneConfig.perfectMin * 100;
  const goldWidthPct = (zoneConfig.perfectMax - zoneConfig.perfectMin) * 100;
  const redWidthPct = zoneConfig.perfectMin * 100;
  const redEndLeftPct = zoneConfig.perfectMax * 100;
  const redEndWidthPct = Math.max(0, (1 - zoneConfig.perfectMax) * 100);
  const perfectLabel = `${Math.round(zoneConfig.perfectMin * 100)}–${Math.round(zoneConfig.perfectMax * 100)}%`;
  const isFlow = mode === 'flow';

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <HapticPressable onPress={handleTap} style={styles.panel}>
        <Text style={styles.title}>
          {isFlow ? '[ FLOW-STATE RELOAD // 1 AP ]' : '[ PHASE-SHIFT RELOAD // 1 AP ]'}
        </Text>
        <Text style={styles.subtitle}>
          {isFlow
            ? 'Magazine dry — tap the gold band to re-enter the flow.'
            : 'Tactical reload — tap the gold band before the cursor passes.'}
        </Text>
        <View style={styles.barTrack} onLayout={handleBarLayout}>
          <View style={[styles.zone, styles.redZone, { left: '0%', width: `${redWidthPct}%` }]} />
          <View style={[styles.zone, styles.goldZone, { left: `${goldLeftPct}%`, width: `${goldWidthPct}%` }]} />
          <View style={[styles.zone, styles.redZone, { left: `${redEndLeftPct}%`, width: `${redEndWidthPct}%` }]} />
          {barWidth > 0 ? (
            <Animated.View style={[styles.cursor, { width: CURSOR_WIDTH }, cursorStyle]} />
          ) : null}
        </View>
        <View style={styles.legendRow}>
          <Text style={styles.legendGold}>{`GOLD ${perfectLabel} — full mag + overcharge buff`}</Text>
          <Text style={styles.legendRed}>{`MISS — full mag, −${HEX_RELOAD_JAM_STAMINA_PENALTY} STM void-feed jam`}</Text>
        </View>
        <Text style={styles.tapHint}>[ TAP ANYWHERE TO STOP ]</Text>
      </HapticPressable>
    </View>
  );
}

export default memo(ActiveReloadOverlay);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.55)',
    backgroundColor: 'rgba(8, 10, 16, 0.96)',
    padding: 14,
    gap: 10,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#fbbf24',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 11,
  },
  barTrack: {
    width: '100%',
    minWidth: MIN_BAR_WIDTH,
    height: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    position: 'relative',
    overflow: 'hidden',
  },
  zone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  redZone: {
    backgroundColor: 'rgba(248, 113, 113, 0.3)',
  },
  goldZone: {
    backgroundColor: 'rgba(251, 191, 36, 0.55)',
  },
  cursor: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    left: 0,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  legendRow: {
    gap: 2,
    alignItems: 'center',
  },
  legendGold: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: '#fbbf24',
  },
  legendRed: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: '#f87171',
  },
  tapHint: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: 0.8,
    marginTop: 4,
  },
});
