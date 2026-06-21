import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveActiveReloadZone } from '../../data/activeReloadEngine';
import type { ActiveReloadResult } from '../../types/classCombatResources';

export type UltimateMinigameMode = 'ZERO_PROTOCOL' | 'CATACLYSM_SIGIL';

export interface UltimateMinigameResult {
  mode: UltimateMinigameMode;
  /** 0–1 performance score */
  score: number;
  timing?: ActiveReloadResult;
  taps?: number;
}

interface UltimateMinigameOverlayProps {
  visible: boolean;
  mode: UltimateMinigameMode;
  onResolve: (result: UltimateMinigameResult) => void;
  onAbort?: () => void;
}

const BAR_WIDTH = 280;
const CURSOR_WIDTH = 10;
const TICK_MS = 16;
const CURSOR_SPEED = 0.018;
const ZERO_PROTOCOL_TARGET_TAPS = 6;
const ZERO_PROTOCOL_TIME_MS = 2200;

export default function UltimateMinigameOverlay({
  visible,
  mode,
  onResolve,
  onAbort,
}: UltimateMinigameOverlayProps): React.JSX.Element | null {
  const [cursorRatio, setCursorRatio] = useState(0.5);
  const [tapCount, setTapCount] = useState(0);
  const directionRef = useRef(1);
  const resolvingRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);
  const tapCountRef = useRef(0);

  const resolveWithScore = (score: number, extras?: Partial<UltimateMinigameResult>) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    onResolve({
      mode,
      score: Math.max(0.15, Math.min(1, score)),
      taps: tapCountRef.current,
      ...extras,
    });
  };

  const abortChannel = () => {
    if (resolvingRef.current) return;
    onAbort?.();
    resolveWithScore(0.15);
  };

  useEffect(() => {
    if (!visible) {
      resolvingRef.current = false;
      setCursorRatio(0.5);
      setTapCount(0);
      tapCountRef.current = 0;
      directionRef.current = 1;
      deadlineRef.current = null;
      return;
    }

    if (mode === 'ZERO_PROTOCOL') {
      deadlineRef.current = Date.now() + ZERO_PROTOCOL_TIME_MS;
      const timer = setInterval(() => {
        if (resolvingRef.current || deadlineRef.current == null) return;
        if (Date.now() >= deadlineRef.current) {
          const score = Math.min(1, tapCountRef.current / ZERO_PROTOCOL_TARGET_TAPS);
          resolveWithScore(score);
        }
      }, 50);
      return () => clearInterval(timer);
    }

    const sigilDeadline = Date.now() + 8000;
    const timeout = setInterval(() => {
      if (resolvingRef.current) return;
      if (Date.now() >= sigilDeadline) {
        resolveWithScore(0.35, { timing: 'FAIL' });
      }
    }, 100);

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
    return () => {
      clearInterval(timer);
      clearInterval(timeout);
    };
  }, [mode, visible]);

  if (!visible) return null;

  if (mode === 'ZERO_PROTOCOL') {
    const progress = Math.min(1, tapCount / ZERO_PROTOCOL_TARGET_TAPS);
    return (
      <View style={styles.overlay} pointerEvents="auto">
        <View style={styles.panel}>
          <Text style={[styles.title, styles.zeroTitle]}>[ ZERO-PROTOCOL // RAPID EXECUTION ]</Text>
          <Text style={styles.subtitle}>
            Tap FIRE to dump the magazine before the channel collapses.
          </Text>
          <View style={[styles.barTrack, { width: BAR_WIDTH }]}>
            <View style={[styles.progressFill, { width: BAR_WIDTH * progress }]} />
          </View>
          <Text style={styles.counter}>{`${tapCount} / ${ZERO_PROTOCOL_TARGET_TAPS} PULSES`}</Text>
          <Pressable
            onPress={() => {
              if (resolvingRef.current) return;
              const next = tapCount + 1;
              tapCountRef.current = next;
              setTapCount(next);
              if (next >= ZERO_PROTOCOL_TARGET_TAPS) {
                resolveWithScore(1, { taps: next });
              }
            }}
            style={[styles.fireBtn, styles.zeroFireBtn]}
          >
            <Text style={[styles.fireLabel, styles.zeroFireLabel]}>[ FIRE ]</Text>
          </Pressable>
          <Pressable onPress={abortChannel} style={styles.abortBtn}>
            <Text style={styles.abortLabel}>[ ABORT // MINIMUM YIELD ]</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handleTrace = () => {
    if (resolvingRef.current) return;
    const timing = resolveActiveReloadZone(cursorRatio, 1);
    const score = timing === 'PERFECT' ? 1 : timing === 'GOOD' ? 0.75 : 0.35;
    resolveWithScore(score, { timing });
  };

  const cursorLeft = Math.max(
    0,
    Math.min(BAR_WIDTH - CURSOR_WIDTH, cursorRatio * (BAR_WIDTH - CURSOR_WIDTH)),
  );

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={[styles.panel, styles.sigilPanel]}>
        <Text style={[styles.title, styles.sigilTitle]}>[ CATACLYSM SIGIL // TRACE CHANNEL ]</Text>
        <Text style={styles.subtitle}>Stop the cursor inside the white sigil band.</Text>
        <View style={[styles.barTrack, { width: BAR_WIDTH }]}>
          <View style={[styles.zone, styles.goodZone]} />
          <View style={[styles.zone, styles.perfectZone]} />
          <View style={[styles.cursor, styles.sigilCursor, { left: cursorLeft, width: CURSOR_WIDTH }]} />
        </View>
        <Pressable onPress={handleTrace} style={[styles.fireBtn, styles.sigilFireBtn]}>
          <Text style={[styles.fireLabel, styles.sigilFireLabel]}>[ SEAL SIGIL ]</Text>
        </Pressable>
        <Pressable onPress={abortChannel} style={styles.abortBtn}>
          <Text style={styles.abortLabel}>[ ABORT // MINIMUM YIELD ]</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 46,
    elevation: 46,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    backgroundColor: 'rgba(8, 10, 16, 0.96)',
    padding: 14,
    gap: 10,
    alignItems: 'center',
  },
  sigilPanel: {
    borderColor: 'rgba(167, 139, 250, 0.55)',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  zeroTitle: { color: '#f87171' },
  sigilTitle: { color: '#c4b5fd' },
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
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 113, 113, 0.45)',
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
    borderWidth: 1,
    borderColor: '#fff7ed',
  },
  sigilCursor: {
    backgroundColor: '#a78bfa',
  },
  counter: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#fca5a5',
    letterSpacing: 0.5,
  },
  fireBtn: {
    marginTop: 4,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  zeroFireBtn: { borderColor: '#f87171' },
  sigilFireBtn: { borderColor: '#a78bfa' },
  fireLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  zeroFireLabel: { color: '#f87171' },
  sigilFireLabel: { color: '#c4b5fd' },
  abortBtn: {
    marginTop: 6,
    paddingVertical: 4,
  },
  abortLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
    color: '#64748b',
    textAlign: 'center',
  },
});
