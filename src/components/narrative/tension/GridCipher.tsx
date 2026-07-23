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
import {
  generateRitualEchoSequence,
  type RitualBeat,
} from './ritualEchoEngine';
import { logNarrativeMinigameCompleted } from '../../../data/narrative/narrativeMinigameTelemetry';
import { VEIL } from '../../../theme/veilTerminalTokens';

const GRID_SIZE = 3;
const NODE_COUNT = GRID_SIZE * GRID_SIZE;
const GRID_GAP = 12;
const CELL_DESKTOP = 80;
const CELL_MOBILE = 64;
const TAP_FLASH_MS = 180;

const NODE_IDLE_BG: string = VEIL.surface2;
const NODE_IDLE_BORDER: string = VEIL.line;
const NODE_IDLE_LABEL = VEIL.textDim;
const NODE_LIT: string = VEIL.occultPale;
const NODE_TAPPED: string = VEIL.surface3;
const FORBIDDEN_BG = 'rgba(163, 92, 102, 0.22)';
const FORBIDDEN_BORDER: string = VEIL.blood;
const FORBIDDEN_LABEL = '#fecaca';
const FAIL_FLASH = VEIL.blood;
const BODY_MUTED = VEIL.textMuted;
const COLLAPSE_RED = VEIL.blood;
const TERMINAL_GREEN: string = VEIL.mint;

type RitualPhase = 'preview' | 'input' | 'resolved';

const SUCCESS_LINES = [
  'The echo accepts your rhythm.',
  'The forbidden beats pass untouched. The rite stabilizes.',
  'The pattern resolves into a clean signal.',
] as const;

const FAILURE_LINES = [
  'The ritual fractures on the wrong beat.',
  'A forbidden pulse answers your touch.',
  'The echo rejects the sequence.',
] as const;

function RitualNode({
  nodeId,
  lit,
  tapped,
  forbiddenLit,
  disabled,
  onPress,
  cellSize,
  labelSize,
}: {
  nodeId: number;
  lit: boolean;
  tapped: boolean;
  forbiddenLit: boolean;
  disabled: boolean;
  onPress: (id: number) => void;
  cellSize: number;
  labelSize: number;
}): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!lit && !tapped && !forbiddenLit) return;
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
  }, [forbiddenLit, lit, scale, tapped]);

  const isIdle = !lit && !tapped && !forbiddenLit;
  let backgroundColor = NODE_IDLE_BG;
  let borderColor = NODE_IDLE_BORDER;
  if (forbiddenLit) {
    backgroundColor = FORBIDDEN_BG;
    borderColor = FORBIDDEN_BORDER;
  } else if (tapped) {
    backgroundColor = NODE_TAPPED;
    borderColor = VEIL.mint;
  } else if (lit) {
    backgroundColor = NODE_LIT;
    borderColor = VEIL.occultPale;
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
            borderStyle: forbiddenLit ? 'dashed' : 'solid',
            transform: [{ scale }],
          },
        ]}
      >
        <View
          style={[
            styles.nodeCore,
            lit || tapped ? styles.nodeCoreLit : null,
            forbiddenLit ? styles.nodeCoreForbidden : null,
          ]}
        />
        <Text
          style={[
            styles.nodeId,
            {
              fontSize: labelSize,
              color: forbiddenLit
                ? FORBIDDEN_LABEL
                : isIdle
                  ? NODE_IDLE_LABEL
                  : '#ecfeff',
            },
          ]}
        >
          {forbiddenLit ? 'VOID' : String(nodeId + 1).padStart(2, '0')}
        </Text>
        {forbiddenLit ? (
          <Text style={[styles.skipTag, { fontSize: Math.max(7, labelSize - 2) }]}>
            SKIP
          </Text>
        ) : null}
      </Animated.View>
    </HapticPressable>
  );
}

/**
 * Ritual Echo — Simon-style occult pattern for Mechanic_SigilTrace.
 * Forbidden beats appear in playback and must be skipped during input.
 * Does not mutate run state.
 */
export default function GridCipher({
  onSuccess,
  onFailure,
  defaultPenalty,
  difficulty = 'MEDIUM',
  narrativeEventId,
}: TensionMechanicProps): React.JSX.Element {
  const { isDesktop, fontScale, scaleSize, scaleSpacing, scaleFont } = useResponsiveLayout();
  const cellSize = scaleSize(isDesktop ? CELL_DESKTOP : CELL_MOBILE);
  const gridGap = scaleSpacing(GRID_GAP);
  const gridWidth = GRID_SIZE * cellSize + (GRID_SIZE - 1) * gridGap;
  const panelPad = scaleSpacing(NARRATIVE_UNIFIED_PANEL_PADDING);
  const startedAtRef = useRef(Date.now());

  const sequence = useMemo(
    () => generateRitualEchoSequence(
      difficulty,
      `ritual-echo:${difficulty}:${narrativeEventId ?? 'live'}`,
    ),
    [difficulty, narrativeEventId],
  );
  const playback = sequence.playback;
  const expectedInput = sequence.expectedInput;

  const [phase, setPhase] = useState<RitualPhase>('preview');
  const [playerInputIndex, setPlayerInputIndex] = useState(0);
  const [inputLocked, setInputLocked] = useState(true);
  const [previewBeat, setPreviewBeat] = useState<RitualBeat | null>(null);
  const [tapLitNode, setTapLitNode] = useState<number | null>(null);
  const [confirmedNodes, setConfirmedNodes] = useState<number[]>([]);
  const [failFlash, setFailFlash] = useState(false);
  const [failReason, setFailReason] = useState<'wrong' | 'forbidden' | null>(null);

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
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_SigilTrace',
      difficulty,
      success: true,
      timeElapsedMs: Date.now() - startedAtRef.current,
      narrativeEventId,
    });
    onSuccess();
  }, [clearTimeouts, difficulty, narrativeEventId, onSuccess]);

  const resolveFailure = useCallback((reason: 'wrong' | 'forbidden' = 'wrong') => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    clearTimeouts();
    previewGenRef.current += 1;
    setPhase('resolved');
    setInputLocked(true);
    setFailFlash(true);
    setFailReason(reason);
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
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_SigilTrace',
      difficulty,
      success: false,
      timeElapsedMs: Date.now() - startedAtRef.current,
      narrativeEventId,
    });
    queueTimeout(() => onFailure(), 260);
  }, [clearTimeouts, difficulty, failOverlay, narrativeEventId, onFailure, queueTimeout]);

  const runPreview = useCallback(() => {
    clearTimeouts();
    const gen = previewGenRef.current + 1;
    previewGenRef.current = gen;

    setPhase('preview');
    setPlayerInputIndex(0);
    setConfirmedNodes([]);
    setPreviewBeat(null);
    setTapLitNode(null);
    setInputLocked(true);
    setFailReason(null);

    playback.forEach((beat, stepIndex) => {
      queueTimeout(() => {
        if (previewGenRef.current !== gen || resolvedRef.current) return;
        setPreviewBeat(beat);
        Vibration.vibrate(beat.forbidden ? [0, 18, 30, 18] : 8);

        queueTimeout(() => {
          if (previewGenRef.current !== gen || resolvedRef.current) return;
          setPreviewBeat(null);

          if (stepIndex === playback.length - 1) {
            queueTimeout(() => {
              if (previewGenRef.current !== gen || resolvedRef.current) return;
              setPhase('input');
              setInputLocked(false);
            }, sequence.playbackStepMs);
          }
        }, sequence.nodeFlashMs);
      }, stepIndex * sequence.playbackStepMs);
    });
  }, [clearTimeouts, playback, queueTimeout, sequence.nodeFlashMs, sequence.playbackStepMs]);

  useEffect(() => {
    runPreview();
    return () => {
      previewGenRef.current += 1;
      clearTimeouts();
    };
  }, [clearTimeouts, runPreview]);

  const handleNodePress = useCallback((nodeId: number) => {
    if (inputLocked || phase !== 'input' || resolvedRef.current) return;

    // Any tap that matches a forbidden beat role is handled by expected sequence only.
    // Pressing a node that is not the next expected input fails — including pressing
    // a node that was shown as forbidden during playback when that node is not next.
    const expected = expectedInput[playerInputIndex];
    if (expected == null || nodeId !== expected) {
      // If this node appeared as forbidden in playback and is not expected, treat as forbidden miss.
      const wasForbiddenGlyph = playback.some((b) => b.forbidden && b.nodeId === nodeId);
      resolveFailure(wasForbiddenGlyph ? 'forbidden' : 'wrong');
      return;
    }

    Vibration.vibrate(10);
    setTapLitNode(nodeId);
    setConfirmedNodes((prev) => [...prev, nodeId]);
    queueTimeout(() => setTapLitNode(null), TAP_FLASH_MS);

    const nextIndex = playerInputIndex + 1;
    setPlayerInputIndex(nextIndex);
    if (nextIndex >= expectedInput.length) {
      queueTimeout(() => resolveSuccess(), TAP_FLASH_MS);
    }
  }, [
    expectedInput,
    inputLocked,
    phase,
    playback,
    playerInputIndex,
    queueTimeout,
    resolveFailure,
    resolveSuccess,
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

  const forbiddenCount = playback.filter((b) => b.forbidden).length;

  const instructionText = (() => {
    if (phase === 'preview') {
      return forbiddenCount > 0
        ? `Observe the living pattern — skip VOID / FORBIDDEN beats (${forbiddenCount}).`
        : 'Observe the living pattern — input locked.';
    }
    if (phase === 'input') {
      return `Repeat the echo — step ${playerInputIndex + 1} of ${expectedInput.length}. Skip forbidden beats.`;
    }
    if (failFlash) {
      return failReason === 'forbidden'
        ? FAILURE_LINES[1]!
        : FAILURE_LINES[0]!;
    }
    return SUCCESS_LINES[0]!;
  })();

  const confirmedText = phase === 'input'
    ? `${playerInputIndex}/${expectedInput.length} beats confirmed`
    : phase === 'preview'
      ? `0/${expectedInput.length} beats confirmed`
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
          { fontSize: scales.header, lineHeight: scales.headerLine, color: TERMINAL_GREEN },
        ]}
      >
        RITUAL ECHO
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            fontSize: scaleFont(10),
            lineHeight: scaleFont(14),
            marginTop: scaleSpacing(4),
          },
        ]}
      >
        Repeat the living pattern. Skip the forbidden beats.
      </Text>

      <Text
        style={[
          styles.cipherMeta,
          {
            fontSize: scales.cipherMeta,
            lineHeight: scales.cipherMetaLine,
            marginBottom: scaleSpacing(24),
            marginTop: scaleSpacing(10),
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
            <RitualNode
              key={nodeId}
              nodeId={nodeId}
              lit={
                (previewBeat != null && !previewBeat.forbidden && previewBeat.nodeId === nodeId)
                || tapLitNode === nodeId
              }
              forbiddenLit={
                previewBeat != null && previewBeat.forbidden && previewBeat.nodeId === nodeId
              }
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
              marginTop: scaleSpacing(24),
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
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: 'monospace',
    color: BODY_MUTED,
    letterSpacing: 0.3,
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
    gap: 2,
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
  nodeCoreForbidden: {
    backgroundColor: '#fca5a5',
    borderRadius: 1,
  },
  nodeId: {
    fontFamily: 'monospace',
    letterSpacing: 0.4,
    fontWeight: '700',
  },
  skipTag: {
    fontFamily: 'monospace',
    color: FORBIDDEN_LABEL,
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  failOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
