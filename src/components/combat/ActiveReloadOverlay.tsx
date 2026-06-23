import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ActiveReloadResult } from '../../types/classCombatResources';
import {
  ACTIVE_RELOAD_PASS_MS,
  buildReloadZoneConfig,
  resolveActiveReloadZone,
} from '../../data/activeReloadEngine';

interface ActiveReloadOverlayProps {
  visible: boolean;
  /** 1 = normal perfect band; 0.5 = Gunsmith's Curse (50% tighter). */
  perfectWindowScale?: number;
  onResolve: (result: ActiveReloadResult, cursorRatio: number) => void;
}

const BAR_WIDTH = 300;
const CURSOR_WIDTH = 8;

export default function ActiveReloadOverlay({
  visible,
  perfectWindowScale = 1,
  onResolve,
}: ActiveReloadOverlayProps): React.JSX.Element | null {
  const [cursorRatio, setCursorRatio] = useState(0);
  const startMsRef = useRef(0);
  const resolvingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const zoneConfig = useMemo(
    () => buildReloadZoneConfig(perfectWindowScale),
    [perfectWindowScale],
  );

  useEffect(() => {
    if (!visible) {
      resolvingRef.current = false;
      setCursorRatio(0);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    startMsRef.current = Date.now();
    resolvingRef.current = false;

    const tick = () => {
      const elapsed = Date.now() - startMsRef.current;
      const ratio = Math.min(1, elapsed / ACTIVE_RELOAD_PASS_MS);
      setCursorRatio(ratio);
      if (ratio >= 1 && !resolvingRef.current) {
        resolvingRef.current = true;
        onResolve(resolveActiveReloadZone(1, zoneConfig), 1);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, onResolve, zoneConfig]);

  if (!visible) return null;

  const handleTap = () => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    onResolve(resolveActiveReloadZone(cursorRatio, zoneConfig), cursorRatio);
  };

  const cursorLeft = Math.max(
    0,
    Math.min(BAR_WIDTH - CURSOR_WIDTH, cursorRatio * (BAR_WIDTH - CURSOR_WIDTH)),
  );
  const goldLeftPct = zoneConfig.perfectMin * 100;
  const goldWidthPct = (zoneConfig.perfectMax - zoneConfig.perfectMin) * 100;
  const grayWidthPct = zoneConfig.standardMax * 100;
  const redMidLeftPct = zoneConfig.standardMax * 100;
  const redMidWidthPct = Math.max(0, (zoneConfig.perfectMin - zoneConfig.standardMax) * 100);
  const redEndLeftPct = zoneConfig.perfectMax * 100;
  const redEndWidthPct = Math.max(0, (1 - zoneConfig.perfectMax) * 100);
  const perfectLabel = `${Math.round(zoneConfig.perfectMin * 100)}–${Math.round(zoneConfig.perfectMax * 100)}%`;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Pressable onPress={handleTap} style={styles.panel}>
        <Text style={styles.title}>[ COMBAT RELOAD // SINGLE PASS ]</Text>
        <Text style={styles.subtitle}>Tap once to stop the playhead — gold band is perfect.</Text>
        <View style={[styles.barTrack, { width: BAR_WIDTH }]}>
          <View style={[styles.zone, styles.grayZone, { width: `${grayWidthPct}%` }]} />
          <View style={[styles.zone, styles.redZoneMid, { left: `${redMidLeftPct}%`, width: `${redMidWidthPct}%` }]} />
          <View style={[styles.zone, styles.goldZone, { left: `${goldLeftPct}%`, width: `${goldWidthPct}%` }]} />
          <View style={[styles.zone, styles.redZoneEnd, { left: `${redEndLeftPct}%`, width: `${redEndWidthPct}%` }]} />
          <View style={[styles.cursor, { left: cursorLeft, width: CURSOR_WIDTH }]} />
        </View>
        <View style={styles.legendRow}>
          <Text style={styles.legendGray}>GRAY 0–60% — full mag, −1 AP</Text>
          <Text style={styles.legendGold}>{`GOLD ${perfectLabel} — full mag, 0 AP, OVERCHARGED`}</Text>
          <Text style={styles.legendRed}>RED — jam (weapon locked)</Text>
        </View>
        <Text style={styles.tapHint}>[ TAP ANYWHERE TO STOP ]</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 45,
    elevation: 45,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
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
  grayZone: {
    left: 0,
    backgroundColor: 'rgba(148, 163, 184, 0.28)',
  },
  redZoneMid: {
    backgroundColor: 'rgba(248, 113, 113, 0.25)',
  },
  goldZone: {
    backgroundColor: 'rgba(251, 191, 36, 0.55)',
  },
  redZoneEnd: {
    backgroundColor: 'rgba(248, 113, 113, 0.35)',
  },
  cursor: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  legendRow: {
    gap: 2,
    alignItems: 'center',
  },
  legendGray: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: '#94a3b8',
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
