import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ActiveReloadResult } from '../../types/classCombatResources';
import { resolveActiveReloadZone } from '../../data/activeReloadEngine';

interface ActiveReloadOverlayProps {
  visible: boolean;
  perfectWindowScale?: number;
  onResolve: (result: ActiveReloadResult, cursorRatio: number) => void;
}

const BAR_WIDTH = 280;
const CURSOR_WIDTH = 10;
const TICK_MS = 16;
const CURSOR_SPEED = 0.022;

export default function ActiveReloadOverlay({
  visible,
  perfectWindowScale = 1,
  onResolve,
}: ActiveReloadOverlayProps): React.JSX.Element | null {
  const [cursorRatio, setCursorRatio] = useState(0.5);
  const directionRef = useRef(1);
  const resolvingRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      resolvingRef.current = false;
      setCursorRatio(0.5);
      directionRef.current = 1;
      return;
    }
    const timer = setInterval(() => {
      setCursorRatio((prev) => {
        let next = prev + directionRef.current * CURSOR_SPEED;
        if (next >= 1) {
          next = 1;
          directionRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          directionRef.current = 1;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  const handleStop = () => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    onResolve(resolveActiveReloadZone(cursorRatio, perfectWindowScale), cursorRatio);
  };

  const cursorLeft = Math.max(
    0,
    Math.min(BAR_WIDTH - CURSOR_WIDTH, cursorRatio * (BAR_WIDTH - CURSOR_WIDTH)),
  );

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.panel}>
        <Text style={styles.title}>[ ACTIVE RELOAD // TIMING WINDOW ]</Text>
        <Text style={styles.subtitle}>Tap STOP inside the white band for a perfect feed.</Text>
        <View style={[styles.barTrack, { width: BAR_WIDTH }]}>
          <View style={[styles.zone, styles.perfectZone]} />
          <View style={[styles.zone, styles.goodZone]} />
          <View style={[styles.cursor, { left: cursorLeft, width: CURSOR_WIDTH }]} />
        </View>
        <View style={styles.legendRow}>
          <Text style={styles.legendPerfect}>WHITE — 0 AP + OVERCHARGED</Text>
          <Text style={styles.legendGood}>GRAY — 1 AP FULL MAG</Text>
          <Text style={styles.legendFail}>RED — 2 RNDS / END TURN</Text>
        </View>
        <Pressable onPress={handleStop} style={styles.stopBtn}>
          <Text style={styles.stopLabel}>[ STOP ]</Text>
        </Pressable>
      </View>
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
    maxWidth: 340,
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
    height: 22,
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
  goodZone: {
    left: '35%',
    width: '30%',
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
  },
  perfectZone: {
    left: '44%',
    width: '12%',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  cursor: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    backgroundColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#fff7ed',
  },
  legendRow: {
    gap: 2,
    alignItems: 'center',
  },
  legendPerfect: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: '#f8fafc',
    letterSpacing: 0.3,
  },
  legendGood: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  legendFail: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: '#f87171',
    letterSpacing: 0.3,
  },
  stopBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#fbbf24',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  stopLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#fbbf24',
  },
});
