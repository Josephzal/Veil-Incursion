import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, Vibration, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import type { TensionMechanicProps } from './tensionMechanicTypes';

const GRID_SIZE = 3;
const NODE_COUNT = GRID_SIZE * GRID_SIZE;
const CELL = 64;
const GAP = 10;
const GRID_WIDTH = GRID_SIZE * CELL + (GRID_SIZE - 1) * GAP;

const PREVIEW_STEP_MS = 400;
const NODE_FLASH_MS = 320;
const TAP_FLASH_MS = 180;
const SEQUENCE_MIN = 4;
const SEQUENCE_MAX = 6;

const PANEL_BG = '#141418';
const NODE_IDLE = '#1f2937';
const NODE_LIT = '#22d3ee';
const NODE_TAPPED = '#065f46';
const ACCENT_MUTED = '#9ca3af';
const DANGER_MUTED = '#7f1d1d';
const FAIL_FLASH = '#ef4444';

type CipherPhase = 'preview' | 'input' | 'resolved';

function generateTargetSequence(): number[] {
  const length = SEQUENCE_MIN + Math.floor(Math.random() * (SEQUENCE_MAX - SEQUENCE_MIN + 1));
  return Array.from({ length }, () => Math.floor(Math.random() * NODE_COUNT));
}

function CipherNode({
  nodeId,
  lit,
  tapped,
  disabled,
  onPress,
}: {
  nodeId: number;
  lit: boolean;
  tapped: boolean;
  disabled: boolean;
  onPress: (id: number) => void;
}): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!lit && !tapped) return;
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.12,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [lit, scale, tapped]);

  let backgroundColor = NODE_IDLE;
  let borderColor = '#374151';
  if (tapped) {
    backgroundColor = NODE_TAPPED;
    borderColor = '#34d399';
  } else if (lit) {
    backgroundColor = NODE_LIT;
    borderColor = '#67e8f9';
  }

  return (
    <HapticPressable
      onPress={() => onPress(nodeId)}
      disabled={disabled}
      style={({ pressed }) => [
        styles.nodePressable,
        { opacity: disabled ? 0.55 : pressed ? 0.88 : 1 },
      ]}
    >
      <Animated.View
        style={[
          styles.node,
          {
            backgroundColor,
            borderColor,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={[styles.nodeCore, lit || tapped ? styles.nodeCoreLit : null]} />
        <Text style={styles.nodeId}>{String(nodeId + 1).padStart(2, '0')}</Text>
      </Animated.View>
    </HapticPressable>
  );
}

export default function GridCipher({
  onSuccess,
  onFailure,
  defaultPenalty,
}: TensionMechanicProps): React.JSX.Element {
  const targetSequence = useMemo(() => generateTargetSequence(), []);
  const [phase, setPhase] = useState<CipherPhase>('preview');
  const [playerInputIndex, setPlayerInputIndex] = useState(0);
  const [inputLocked, setInputLocked] = useState(true);
  const [previewLitNode, setPreviewLitNode] = useState<number | null>(null);
  const [tapLitNode, setTapLitNode] = useState<number | null>(null);
  const [confirmedNodes, setConfirmedNodes] = useState<number[]>([]);
  const [failFlash, setFailFlash] = useState(false);

  const resolvedRef = useRef(false);
  const previewGenRef = useRef(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const failOverlay = useRef(new Animated.Value(0)).current;

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((timer) => clearTimeout(timer));
    timeoutsRef.current = [];
  }, []);

  const queueTimeout = useCallback((fn: () => void, delay: number) => {
    const timer = setTimeout(fn, delay);
    timeoutsRef.current.push(timer);
    return timer;
  }, []);

  const resolveSuccess = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    clearTimeouts();
    previewGenRef.current += 1;
    setPhase('resolved');
    setInputLocked(true);
    onSuccess();
  }, [clearTimeouts, onSuccess]);

  const resolveFailure = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    clearTimeouts();
    previewGenRef.current += 1;
    setPhase('resolved');
    setInputLocked(true);
    setFailFlash(true);
    Vibration.vibrate([0, 40, 60, 80]);
    failOverlay.setValue(0);
    Animated.sequence([
      Animated.timing(failOverlay, {
        toValue: 0.45,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(failOverlay, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
    queueTimeout(() => onFailure(), 260);
  }, [clearTimeouts, failOverlay, onFailure, queueTimeout]);

  const runPreview = useCallback(() => {
    clearTimeouts();
    const gen = previewGenRef.current + 1;
    previewGenRef.current = gen;

    setPhase('preview');
    setPlayerInputIndex(0);
    setConfirmedNodes([]);
    setPreviewLitNode(null);
    setTapLitNode(null);
    setInputLocked(true);

    targetSequence.forEach((nodeId, stepIndex) => {
      queueTimeout(() => {
        if (previewGenRef.current !== gen || resolvedRef.current) return;
        setPreviewLitNode(nodeId);
        Vibration.vibrate(8);

        queueTimeout(() => {
          if (previewGenRef.current !== gen || resolvedRef.current) return;
          setPreviewLitNode(null);

          if (stepIndex === targetSequence.length - 1) {
            queueTimeout(() => {
              if (previewGenRef.current !== gen || resolvedRef.current) return;
              setPhase('input');
              setInputLocked(false);
            }, PREVIEW_STEP_MS);
          }
        }, NODE_FLASH_MS);
      }, stepIndex * PREVIEW_STEP_MS);
    });
  }, [clearTimeouts, queueTimeout, targetSequence]);

  useEffect(() => {
    runPreview();
    return () => {
      previewGenRef.current += 1;
      clearTimeouts();
    };
  }, [clearTimeouts, runPreview]);

  const handleNodePress = useCallback((nodeId: number) => {
    if (inputLocked || phase !== 'input' || resolvedRef.current) return;

    const expected = targetSequence[playerInputIndex];
    if (nodeId !== expected) {
      resolveFailure();
      return;
    }

    Vibration.vibrate(10);
    setTapLitNode(nodeId);
    setConfirmedNodes((prev) => [...prev, nodeId]);
    queueTimeout(() => setTapLitNode(null), TAP_FLASH_MS);

    const nextIndex = playerInputIndex + 1;
    setPlayerInputIndex(nextIndex);
    if (nextIndex >= targetSequence.length) {
      queueTimeout(() => resolveSuccess(), TAP_FLASH_MS);
    }
  }, [
    inputLocked,
    phase,
    playerInputIndex,
    queueTimeout,
    resolveFailure,
    resolveSuccess,
    targetSequence,
  ]);

  const penaltyHint = defaultPenalty
    ? defaultPenalty.type === 'HP'
      ? `FAILURE COST: -${defaultPenalty.amount} HP`
      : `FAILURE COST: +${defaultPenalty.amount} RESONANCE`
    : null;

  const instructionText = (() => {
    if (phase === 'preview') return 'Observe the cipher sequence — input locked.';
    if (phase === 'input') {
      return `Re-enter cipher — step ${playerInputIndex + 1} of ${targetSequence.length}.`;
    }
    return failFlash ? 'Cipher rejected — breach detected.' : 'Cipher accepted — access granted.';
  })();

  return (
    <View style={styles.root}>
      <Text style={styles.header}>GRID CIPHER // SEQUENTIAL BYPASS</Text>
      <View style={styles.panel}>
        <Text style={styles.instructions}>{instructionText}</Text>

        <View style={styles.gridWrap}>
          <View style={styles.grid}>
            {Array.from({ length: NODE_COUNT }, (_, nodeId) => (
              <CipherNode
                key={nodeId}
                nodeId={nodeId}
                lit={previewLitNode === nodeId || tapLitNode === nodeId}
                tapped={confirmedNodes.includes(nodeId)}
                disabled={inputLocked || phase !== 'input'}
                onPress={handleNodePress}
              />
            ))}
          </View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.failOverlay,
              { backgroundColor: FAIL_FLASH, opacity: failOverlay },
            ]}
          />
        </View>

        {phase === 'input' ? (
          <Text style={styles.progress}>
            {`${playerInputIndex}/${targetSequence.length} symbols confirmed`}
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
  gridWrap: {
    alignSelf: 'center',
    width: GRID_WIDTH,
    position: 'relative',
  },
  grid: {
    width: GRID_WIDTH,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  nodePressable: {
    width: CELL,
    height: CELL,
  },
  node: {
    width: CELL,
    height: CELL,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  nodeCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#374151',
  },
  nodeCoreLit: {
    backgroundColor: '#ecfeff',
  },
  nodeId: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#6b7280',
    letterSpacing: 0.4,
  },
  failOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  progress: {
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
