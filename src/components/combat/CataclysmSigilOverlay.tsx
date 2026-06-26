import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { CATACLYSM_SIGIL_DURATION_MS } from '../../data/combatMasteryEngine';

type SigilPattern = 'triangle' | 'line' | 'zigzag';

const PATTERNS: Record<SigilPattern, { id: SigilPattern; points: { x: number; y: number }[]; order: number[] }> = {
  triangle: {
    id: 'triangle',
    points: [{ x: 150, y: 40 }, { x: 60, y: 200 }, { x: 240, y: 200 }],
    order: [0, 1, 2],
  },
  line: {
    id: 'line',
    points: [{ x: 50, y: 120 }, { x: 150, y: 120 }, { x: 250, y: 120 }],
    order: [0, 1, 2],
  },
  zigzag: {
    id: 'zigzag',
    points: [{ x: 50, y: 60 }, { x: 150, y: 180 }, { x: 250, y: 60 }],
    order: [0, 1, 2],
  },
};

interface CataclysmSigilOverlayProps {
  visible: boolean;
  onResolve: (traceAccuracy: number) => void;
}

const HIT_RADIUS = 28;

function resolveTraceAccuracy(completedSteps: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  return Math.max(0, Math.min(1, completedSteps / totalSteps));
}

export default function CataclysmSigilOverlay({
  visible,
  onResolve,
}: CataclysmSigilOverlayProps): React.JSX.Element | null {
  const pattern = useMemo(
    () => PATTERNS[(['triangle', 'line', 'zigzag'] as SigilPattern[])[Math.floor(Math.random() * 3)]],
    [visible],
  );
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const resolvedRef = useRef(false);
  const liftedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      resolvedRef.current = false;
      liftedRef.current = false;
      progressRef.current = 0;
      setProgress(0);
      return;
    }
    resolvedRef.current = false;
    liftedRef.current = false;
    progressRef.current = 0;
    setProgress(0);
    const timer = setTimeout(() => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      onResolve(resolveTraceAccuracy(progressRef.current, pattern.order.length));
    }, CATACLYSM_SIGIL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [visible, onResolve, pattern.order.length]);

  const finish = (accuracy: number) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onResolve(accuracy);
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      liftedRef.current = false;
      const { locationX, locationY } = evt.nativeEvent;
      tryHit(locationX, locationY);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      tryHit(locationX, locationY);
    },
    onPanResponderRelease: () => {
      if (!resolvedRef.current && progressRef.current < pattern.order.length) {
        liftedRef.current = true;
        finish(resolveTraceAccuracy(progressRef.current, pattern.order.length));
      }
    },
  }), [pattern, visible]);

  const tryHit = (x: number, y: number) => {
    if (resolvedRef.current || liftedRef.current) return;
    const targetIdx = pattern.order[progressRef.current];
    if (targetIdx == null) return;
    const pt = pattern.points[targetIdx];
    const dist = Math.hypot(x - pt.x, y - pt.y);
    if (dist > HIT_RADIUS) return;
    const next = progressRef.current + 1;
    progressRef.current = next;
    setProgress(next);
    if (next >= pattern.order.length) {
      finish(1);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay} {...panResponder.panHandlers}>
      <Text style={styles.title}>[ CATACLYSM SIGIL // TRACE PATTERN ]</Text>
      <Text style={styles.sub}>Connect dots in sequence — do not lift finger.</Text>
      <Svg width={300} height={240} style={styles.svg}>
        {pattern.points.map((pt, i) => (
          <Circle
            key={`dot-${i}`}
            cx={pt.x}
            cy={pt.y}
            r={i < progress ? 10 : 8}
            fill={i < progress ? '#c4b5fd' : 'rgba(167, 139, 250, 0.35)'}
            stroke="#a78bfa"
            strokeWidth={2}
          />
        ))}
        {progress > 1 && pattern.order.slice(0, progress).map((idx, i) => {
          if (i === 0) return null;
          const a = pattern.points[pattern.order[i - 1]];
          const b = pattern.points[idx];
          return (
            <Line
              key={`seg-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#a78bfa"
              strokeWidth={3}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: '#c4b5fd',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sub: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: '#94a3b8',
    marginBottom: 16,
  },
  svg: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.4)',
  },
});
