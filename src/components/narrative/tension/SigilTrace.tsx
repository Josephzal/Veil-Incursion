import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import type { TensionMechanicProps } from './tensionMechanicTypes';

const GRID_SIZE = 3;
const CELL = 64;
const GAP = 10;
const FLASH_MS = 1500;
const TRACE_MS = 5000;
const PANEL_BG = '#141418';
const NODE_IDLE = '#1f2937';
const NODE_FLASH = '#4b5563';
const NODE_TRACED = '#065f46';
const LINE_FLASH = '#6b7280';
const ACCENT_MUTED = '#9ca3af';
const DANGER_MUTED = '#7f1d1d';

type SigilPhase = 'flash' | 'trace' | 'resolved';

function gridNeighbors(index: number): number[] {
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;
  const neighbors: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow < 0 || nextRow >= GRID_SIZE || nextCol < 0 || nextCol >= GRID_SIZE) continue;
      neighbors.push(nextRow * GRID_SIZE + nextCol);
    }
  }
  return neighbors;
}

function generateSigilPath(): number[] {
  const targetLength = Math.random() > 0.5 ? 5 : 4;
  let current = Math.floor(Math.random() * GRID_SIZE * GRID_SIZE);
  const path = [current];

  while (path.length < targetLength) {
    const candidates = gridNeighbors(current).filter((cell) => !path.includes(cell));
    if (candidates.length === 0) {
      return generateSigilPath();
    }
    current = candidates[Math.floor(Math.random() * candidates.length)] ?? current;
    path.push(current);
  }

  return path;
}

function cellCenter(index: number): { x: number; y: number } {
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;
  return {
    x: col * (CELL + GAP) + CELL / 2,
    y: row * (CELL + GAP) + CELL / 2,
  };
}

const GRID_WIDTH = GRID_SIZE * CELL + (GRID_SIZE - 1) * GAP;
const GRID_HEIGHT = GRID_WIDTH;

export default function SigilTrace({
  onSuccess,
  onFailure,
  defaultPenalty,
}: TensionMechanicProps): React.JSX.Element {
  const targetPath = useMemo(() => generateSigilPath(), []);
  const [phase, setPhase] = useState<SigilPhase>('flash');
  const [tracePath, setTracePath] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(TRACE_MS / 1000);
  const resolvedRef = useRef(false);

  const resolveSuccess = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setPhase('resolved');
    onSuccess();
  }, [onSuccess]);

  const resolveFailure = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setPhase('resolved');
    onFailure();
  }, [onFailure]);

  useEffect(() => {
    const flashTimer = setTimeout(() => {
      setPhase('trace');
    }, FLASH_MS);
    return () => clearTimeout(flashTimer);
  }, []);

  useEffect(() => {
    if (phase !== 'trace') return undefined;

    const deadline = Date.now() + TRACE_MS;
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        resolveFailure();
      }
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(tick);
      resolveFailure();
    }, TRACE_MS);

    return () => {
      clearInterval(tick);
      clearTimeout(timeout);
    };
  }, [phase, resolveFailure]);

  const handleNodePress = (index: number) => {
    if (phase !== 'trace' || resolvedRef.current) return;

    const step = tracePath.length;
    if (targetPath[step] !== index) {
      resolveFailure();
      return;
    }

    const nextPath = [...tracePath, index];
    setTracePath(nextPath);
    if (nextPath.length === targetPath.length) {
      resolveSuccess();
    }
  };

  const flashLines = targetPath.slice(0, -1).map((from, idx) => {
    const to = targetPath[idx + 1];
    if (to == null) return null;
    const start = cellCenter(from);
    const end = cellCenter(to);
    return (
      <Line
        key={`${from}-${to}`}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={LINE_FLASH}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    );
  });

  const penaltyHint = defaultPenalty
    ? defaultPenalty.type === 'HP'
      ? `FAILURE COST: -${defaultPenalty.amount} HP`
      : `FAILURE COST: +${defaultPenalty.amount} RESONANCE`
    : null;

  return (
    <View style={styles.root}>
      <Text style={styles.header}>SIGIL TRACE // MEMORY LOCK</Text>
      <View style={styles.panel}>
        <Text style={styles.instructions}>
          {phase === 'flash'
            ? 'Memorize the sigil path…'
            : phase === 'trace'
              ? 'Trace the pattern — tap nodes in order.'
              : 'Protocol resolved.'}
        </Text>

        <View style={styles.gridWrap}>
          {phase === 'flash' ? (
            <Svg width={GRID_WIDTH} height={GRID_HEIGHT} style={styles.gridSvg}>
              {flashLines}
            </Svg>
          ) : null}

          <View style={styles.grid}>
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
              const isFlashNode = phase === 'flash' && targetPath.includes(index);
              const traceIndex = tracePath.indexOf(index);
              const isTraced = traceIndex >= 0;

              let backgroundColor = NODE_IDLE;
              if (phase === 'flash' && isFlashNode) backgroundColor = NODE_FLASH;
              if (phase === 'trace' && isTraced) backgroundColor = NODE_TRACED;

              return (
                <Pressable
                  key={index}
                  onPress={() => handleNodePress(index)}
                  disabled={phase !== 'trace'}
                  style={({ pressed }) => [
                    styles.node,
                    {
                      backgroundColor,
                      borderColor: isFlashNode && phase === 'flash' ? ACCENT_MUTED : '#111827',
                      opacity: phase === 'flash' ? 1 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {isTraced ? (
                    <Text style={styles.nodeOrder}>{traceIndex + 1}</Text>
                  ) : (
                    <View style={styles.nodeCore} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {phase === 'trace' ? (
          <Text style={styles.timer}>
            {secondsLeft}s remaining — {tracePath.length}/{targetPath.length} nodes
          </Text>
        ) : null}

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
  gridWrap: {
    alignSelf: 'center',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    position: 'relative',
  },
  gridSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  grid: {
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  node: {
    width: CELL,
    height: CELL,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#374151',
  },
  nodeOrder: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: '#d1d5db',
  },
  timer: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.6,
    color: '#d1d5db',
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
