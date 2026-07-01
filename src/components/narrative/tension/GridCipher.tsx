import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, Vibration, View } from 'react-native';
import {
  NARRATIVE_UNIFIED_PANEL_BG,
  NARRATIVE_UNIFIED_PANEL_BORDER,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../../../constants/narrativeLayout';
import { USE_NATIVE_DRIVER } from '../../../utils/platformMotion';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import HapticPressable from '../../HapticPressable';
import type { TensionMechanicProps } from './tensionMechanicTypes';

const GRID_SIZE = 3;
const NODE_COUNT = GRID_SIZE * GRID_SIZE;
const GRID_GAP = 12;
const CELL_DESKTOP = 80;
const CELL_MOBILE = 64;

const PREVIEW_STEP_MS = 400;
const NODE_FLASH_MS = 320;
const TAP_FLASH_MS = 180;
const SEQUENCE_MIN = 4;
const SEQUENCE_MAX = 6;

const NODE_IDLE_BG = '#0F172A';
const NODE_IDLE_BORDER = '#334155';
const NODE_IDLE_LABEL = '#475569';
const NODE_LIT = '#22d3ee';
const NODE_TAPPED = '#065f46';
const FAIL_FLASH = '#ef4444';
const BODY_MUTED = '#94A3B8';
const COLLAPSE_RED = '#EF4444';

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
  cellSize,
  labelSize,
}: {
  nodeId: number;
  lit: boolean;
  tapped: boolean;
  disabled: boolean;
  onPress: (id: number) => void;
  cellSize: number;
  labelSize: number;
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
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [lit, scale, tapped]);

  const isIdle = !lit && !tapped;
  let backgroundColor = NODE_IDLE_BG;
  let borderColor = NODE_IDLE_BORDER;
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
        {
          width: cellSize,
          height: cellSize,
          opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.node,
          {
            width: cellSize,
            height: cellSize,
            backgroundColor,
            borderColor,
            borderWidth: isIdle ? 1 : 2,
            borderRadius: 2,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={[styles.nodeCore, lit || tapped ? styles.nodeCoreLit : null]} />
        <Text
          style={[
            styles.nodeId,
            {
              fontSize: labelSize,
              color: isIdle ? NODE_IDLE_LABEL : '#ecfeff',
            },
          ]}
        >
          {String(nodeId + 1).padStart(2, '0')}
        </Text>
      </Animated.View>
    </HapticPressable>
  );
}

/** Terran Grid sequential cipher keypad — structural shell matches sibling tension panels. */
export default function GridCipher({
  onSuccess,
  onFailure,
  defaultPenalty,
}: TensionMechanicProps): React.JSX.Element {
  const { isDesktop, fontScale, scaleSize, scaleSpacing, scaleFont } = useResponsiveLayout();
  const cellSize = scaleSize(isDesktop ? CELL_DESKTOP : CELL_MOBILE);
  const gridGap = scaleSpacing(GRID_GAP);
  const gridWidth = GRID_SIZE * cellSize + (GRID_SIZE - 1) * gridGap;
  const panelPad = scaleSpacing(NARRATIVE_UNIFIED_PANEL_PADDING);

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
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(failOverlay, {
        toValue: 0,
        duration: 220,
        useNativeDriver: USE_NATIVE_DRIVER,
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

  const scales = useMemo(
    () => ({
      header: 9 * fontScale,
      headerLine: 12 * fontScale,
      cipherMeta: 11 * fontScale,
      cipherMetaLine: 15 * fontScale,
      nodeLabel: 10 * fontScale,
      penalty: scaleFont(11),
      penaltyLine: scaleFont(14),
    }),
    [fontScale, scaleFont],
  );

  const instructionText = (() => {
    if (phase === 'preview') return 'Observe the cipher sequence — input locked.';
    if (phase === 'input') {
      return `Re-enter cipher — step ${playerInputIndex + 1} of ${targetSequence.length}.`;
    }
    return failFlash ? 'Cipher rejected — breach detected.' : 'Cipher accepted — access granted.';
  })();

  const confirmedText = phase === 'input'
    ? `${playerInputIndex}/${targetSequence.length} symbols confirmed`
    : phase === 'preview'
      ? `0/${targetSequence.length} symbols confirmed`
      : ' ';

  return (
    <View
      style={[
        styles.panel,
        { padding: panelPad },
      ]}
    >
      <Text
        style={[
          styles.header,
          { fontSize: scales.header, lineHeight: scales.headerLine },
        ]}
      >
        GRID CIPHER // SEQUENTIAL BYPASS
      </Text>

      <Text
        style={[
          styles.cipherMeta,
          {
            fontSize: scales.cipherMeta,
            lineHeight: scales.cipherMetaLine,
            marginBottom: scaleSpacing(32),
            marginTop: scaleSpacing(12),
          },
        ]}
      >
        {instructionText}
      </Text>

      <View
        style={[
          styles.gridWrap,
          {
            width: gridWidth,
            gap: gridGap,
          },
        ]}
      >
        <View
          style={[
            styles.grid,
            {
              width: gridWidth,
              gap: gridGap,
            },
          ]}
        >
          {Array.from({ length: NODE_COUNT }, (_, nodeId) => (
            <CipherNode
              key={nodeId}
              nodeId={nodeId}
              lit={previewLitNode === nodeId || tapLitNode === nodeId}
              tapped={confirmedNodes.includes(nodeId)}
              disabled={inputLocked || phase !== 'input'}
              onPress={handleNodePress}
              cellSize={cellSize}
              labelSize={scales.nodeLabel}
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

      <Text
        style={[
          styles.cipherMeta,
          {
            fontSize: scales.cipherMeta,
            lineHeight: scales.cipherMetaLine,
            marginTop: scaleSpacing(12),
            minHeight: scales.cipherMetaLine,
          },
        ]}
      >
        {confirmedText}
      </Text>

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
  cipherMeta: {
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    color: BODY_MUTED,
    textAlign: 'center',
    alignSelf: 'center',
  },
  gridWrap: {
    alignSelf: 'center',
    position: 'relative',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  nodePressable: {},
  node: {
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
    letterSpacing: 0.4,
  },
  failOverlay: {
    ...StyleSheet.absoluteFillObject,
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
