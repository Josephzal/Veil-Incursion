import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import {
  NARRATIVE_UNIFIED_PANEL_BG,
  NARRATIVE_UNIFIED_PANEL_BORDER,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import HapticPressable from '../../HapticPressable';
import type { TensionMechanicProps } from './tensionMechanicTypes';
import {
  evaluateKeyFit,
  fitReasonLabel,
  generateVeilLockPuzzle,
  insertKey,
  isDeadEnd,
  isPuzzleComplete,
  keyOccupiedSockets,
  resetActiveRing,
  rotateKey,
  type VeilGlyphKey,
  type VeilLockPuzzle,
  type VeilLockRing,
} from './signalAlignmentEngine';
import { logNarrativeMinigameCompleted } from '../../../data/narrative/narrativeMinigameTelemetry';

const TERMINAL_GREEN = '#00ff33';
const BODY_MUTED = '#94A3B8';
const MUTED_WHITE = '#F8FAFC';
const WARN_AMBER = '#FBBF24';
const COLLAPSE_RED = '#EF4444';
const RING_STROKE = 'rgba(148, 163, 184, 0.35)';
const REQUIRED_STROKE = 'rgba(103, 232, 249, 0.9)';
const FILLED_FILL = '#00ff33';
const WALL_FILL = 'rgba(148, 163, 184, 0.25)';
const CORE_IDLE = '#0B0F14';

const SUCCESS_LINES = [
  'The final ring accepts the signal. The core opens.',
  'The lock blooms inward, one conduit at a time.',
] as const;

const FAILURE_LINES = [
  'The remaining glyphs cannot complete the route.',
  'The lock rejects the pattern and folds shut.',
] as const;

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function socketArcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  socket: number,
  socketCount: number,
): string {
  const per = 360 / socketCount;
  const pad = per * 0.16;
  const a0 = socket * per - per / 2 + pad;
  const a1 = socket * per + per / 2 - pad;
  const p0o = polar(cx, cy, rOuter, a0);
  const p1o = polar(cx, cy, rOuter, a1);
  const p1i = polar(cx, cy, rInner, a1);
  const p0i = polar(cx, cy, rInner, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return [
    `M ${p0o.x} ${p0o.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p1o.x} ${p1o.y}`,
    `L ${p1i.x} ${p1i.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p0i.x} ${p0i.y}`,
    'Z',
  ].join(' ');
}

/**
 * Veil Lock — glyph-key insertion puzzle for Mechanic_SignalAlignment.
 * Slot limited, rotatable keys into rings (outer → inner) to route to the core.
 * Does not mutate run state.
 */
export default function SignalAlignment({
  onSuccess,
  onFailure,
  defaultPenalty,
  difficulty = 'MEDIUM',
  narrativeEventId,
}: TensionMechanicProps): React.JSX.Element {
  const { scaleSize, scaleSpacing, scaleFont } = useResponsiveLayout();
  const [reduceMotion, setReduceMotion] = useState(false);
  const startedAtRef = useRef(Date.now());
  const attemptsUsedRef = useRef(0);

  const [puzzle, setPuzzle] = useState<VeilLockPuzzle>(() =>
    generateVeilLockPuzzle({
      difficulty,
      seed: `veil-lock:${difficulty}:${narrativeEventId ?? 'live'}`,
    }),
  );
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resolveState, setResolveState] = useState<'playing' | 'success' | 'failure'>('playing');
  const resolvedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const size = scaleSize(176);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - scaleSize(6);

  const selectedKey = useMemo(
    () => puzzle.keys.find((k) => k.keyId === selectedKeyId) ?? null,
    [puzzle.keys, selectedKeyId],
  );

  const fit = useMemo(
    () => (selectedKey ? evaluateKeyFit(puzzle, selectedKey) : null),
    [puzzle, selectedKey],
  );

  const finishSuccess = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolveState('success');
    setFeedback('CORE ROUTE OPEN');
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_SignalAlignment',
      difficulty,
      success: true,
      attemptsUsed: attemptsUsedRef.current,
      timeElapsedMs: Date.now() - startedAtRef.current,
      narrativeEventId,
    });
    onSuccess();
  }, [difficulty, narrativeEventId, onSuccess]);

  const finishFailure = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolveState('failure');
    setFeedback(FAILURE_LINES[0]!);
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_SignalAlignment',
      difficulty,
      success: false,
      attemptsUsed: attemptsUsedRef.current,
      timeElapsedMs: Date.now() - startedAtRef.current,
      narrativeEventId,
    });
    onFailure();
  }, [difficulty, narrativeEventId, onFailure]);

  const handleRotate = useCallback((delta: number) => {
    if (resolveState !== 'playing' || !selectedKeyId) return;
    setPuzzle((prev) => ({
      ...prev,
      keys: prev.keys.map((k) =>
        k.keyId === selectedKeyId ? rotateKey(k, delta, prev.socketCount) : k,
      ),
    }));
    setFeedback(null);
  }, [resolveState, selectedKeyId]);

  const handleInsert = useCallback(() => {
    if (resolveState !== 'playing' || !selectedKey) return;
    const currentFit = evaluateKeyFit(puzzle, selectedKey);
    if (!currentFit.fits) {
      attemptsUsedRef.current += 1;
      setFeedback(fitReasonLabel(currentFit.reason));
      return;
    }
    const next = insertKey(puzzle, selectedKey.keyId);
    if (!next) {
      setFeedback(fitReasonLabel(currentFit.reason));
      return;
    }
    attemptsUsedRef.current += 1;
    setSelectedKeyId(null);

    if (isPuzzleComplete(next)) {
      setPuzzle(next);
      finishSuccess();
      return;
    }

    const ringJustCompleted =
      next.currentRingIndex !== puzzle.currentRingIndex
      || next.rings[puzzle.currentRingIndex]?.complete;
    setFeedback(ringJustCompleted ? 'RING COMPLETE' : 'KEY FITS');
    setPuzzle(next);

    if (isDeadEnd(next) && next.resetsUsed >= next.maxResets) {
      finishFailure();
    }
  }, [finishFailure, finishSuccess, puzzle, resolveState, selectedKey]);

  const handleResetRing = useCallback(() => {
    if (resolveState !== 'playing') return;
    const next = resetActiveRing(puzzle);
    if (!next) {
      setFeedback('NO RESETS REMAINING');
      return;
    }
    setSelectedKeyId(null);
    setFeedback('RING RESET');
    setPuzzle(next);
  }, [puzzle, resolveState]);

  // Detect dead-end with no resets (e.g. after decoy mistakes).
  useEffect(() => {
    if (resolveState !== 'playing' || resolvedRef.current) return;
    if (isPuzzleComplete(puzzle)) return;
    if (isDeadEnd(puzzle) && puzzle.resetsUsed >= puzzle.maxResets) {
      finishFailure();
    }
  }, [finishFailure, puzzle, resolveState]);

  const penaltyLine = useMemo(() => {
    if (!defaultPenalty) return null;
    return defaultPenalty.type === 'HP'
      ? `COLLAPSE RISK — ${defaultPenalty.amount} HP (applied on fail by narrative)`
      : `COLLAPSE RISK — +${defaultPenalty.amount} RESONANCE (applied on fail by narrative)`;
  }, [defaultPenalty]);

  const banner =
    resolveState === 'success'
      ? SUCCESS_LINES[1]!
      : resolveState === 'failure'
        ? FAILURE_LINES[1]!
        : null;

  const ringCount = puzzle.rings.length;
  const previewOccupied = selectedKey
    ? keyOccupiedSockets(selectedKey, selectedKey.currentRotation, puzzle.socketCount)
    : [];

  const unusedKeys = puzzle.keys.filter((k) => !k.used);
  const usedCount = puzzle.keys.length - unusedKeys.length;

  return (
    <View style={[styles.root, { padding: scaleSpacing(NARRATIVE_UNIFIED_PANEL_PADDING) }]}>
      <View
        style={[
          styles.panel,
          {
            borderColor: NARRATIVE_UNIFIED_PANEL_BORDER,
            backgroundColor: NARRATIVE_UNIFIED_PANEL_BG,
            padding: 0,
          },
        ]}
      >
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={{ padding: scaleSpacing(12) }}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
        <Text style={[styles.title, { fontSize: scaleFont(11) }]}>VEIL LOCK</Text>
        <Text style={[styles.subtitle, { fontSize: scaleFont(10), lineHeight: scaleFont(14) }]}>
          Slot glyph keys to route the signal into the core.
        </Text>

        <View style={[styles.metaRow, { marginTop: scaleSpacing(8), gap: scaleSpacing(10) }]}>
          <Text style={[styles.meta, { fontSize: scaleFont(9), color: TERMINAL_GREEN }]}>
            RING {Math.min(puzzle.currentRingIndex + 1, ringCount)}/{ringCount}
          </Text>
          <Text style={[styles.meta, { fontSize: scaleFont(9), color: BODY_MUTED }]}>
            KEYS {unusedKeys.length} LEFT
          </Text>
          <Text
            style={[
              styles.meta,
              {
                fontSize: scaleFont(9),
                color: puzzle.maxResets - puzzle.resetsUsed <= 0 ? COLLAPSE_RED : WARN_AMBER,
              },
            ]}
          >
            RESETS {puzzle.maxResets - puzzle.resetsUsed}
          </Text>
        </View>

        <View style={[styles.diagramWrap, { marginTop: scaleSpacing(8), borderColor: '#1f2937' }]}>
          <Svg width={size} height={size}>
            {puzzle.rings.map((ring, index) => {
              const outerR = maxR * (1 - index * (0.62 / Math.max(1, ringCount)));
              const innerR = maxR * (1 - (index + 1) * (0.62 / Math.max(1, ringCount))) + scaleSize(3);
              const isActive = index === puzzle.currentRingIndex && resolveState === 'playing';
              return (
                <RingVisual
                  key={`ring-${ring.ringIndex}`}
                  ring={ring}
                  cx={cx}
                  cy={cy}
                  outerR={outerR}
                  innerR={innerR}
                  isActive={isActive}
                  previewOccupied={isActive ? previewOccupied : []}
                  previewFits={fit?.fits ?? false}
                />
              );
            })}
            <Circle
              cx={cx}
              cy={cy}
              r={scaleSize(14)}
              fill={resolveState === 'success' ? 'rgba(0,255,51,0.35)' : CORE_IDLE}
              stroke={resolveState === 'success' ? TERMINAL_GREEN : RING_STROKE}
              strokeWidth={2}
            />
            <SvgText
              x={cx}
              y={cy + scaleSize(3)}
              fill={resolveState === 'success' ? TERMINAL_GREEN : BODY_MUTED}
              fontSize={scaleFont(6)}
              fontFamily="monospace"
              textAnchor="middle"
            >
              CORE
            </SvgText>
          </Svg>
        </View>

        <Text style={[styles.instruction, { fontSize: scaleFont(8), marginTop: scaleSpacing(6) }]}>
          Select a glyph key. Rotate until the teeth match open sockets. Insert to complete each ring.
        </Text>

        {/* Glyph key tray */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: scaleSpacing(8) }}
          contentContainerStyle={{ gap: scaleSpacing(6), paddingVertical: scaleSpacing(2) }}
        >
          {puzzle.keys.map((key) => (
            <GlyphKeyChip
              key={key.keyId}
              glyphKey={key}
              socketCount={puzzle.socketCount}
              selected={key.keyId === selectedKeyId}
              disabled={key.used || resolveState !== 'playing'}
              onSelect={() => {
                if (key.used || resolveState !== 'playing') return;
                setSelectedKeyId(key.keyId);
                setFeedback(null);
              }}
              scaleSize={scaleSize}
              scaleFont={scaleFont}
            />
          ))}
        </ScrollView>

        {/* Rotate + fit preview */}
        <View style={[styles.rotateRow, { marginTop: scaleSpacing(8), gap: scaleSpacing(8) }]}>
          <HapticPressable
            disabled={!selectedKeyId || resolveState !== 'playing'}
            onPress={() => handleRotate(-1)}
            style={({ pressed }) => [
              styles.rotateBtn,
              { opacity: !selectedKeyId || resolveState !== 'playing' ? 0.4 : pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.rotateText, { fontSize: scaleFont(12) }]}>↺</Text>
          </HapticPressable>
          <View style={styles.fitBadge}>
            <Text
              style={[
                styles.fitText,
                {
                  fontSize: scaleFont(9),
                  color: !selectedKey
                    ? BODY_MUTED
                    : fit?.fits
                      ? TERMINAL_GREEN
                      : COLLAPSE_RED,
                },
              ]}
            >
              {selectedKey ? (fit?.fits ? 'KEY FITS' : fitReasonLabel(fit?.reason ?? 'BLOCKED')) : 'SELECT A KEY'}
            </Text>
          </View>
          <HapticPressable
            disabled={!selectedKeyId || resolveState !== 'playing'}
            onPress={() => handleRotate(1)}
            style={({ pressed }) => [
              styles.rotateBtn,
              { opacity: !selectedKeyId || resolveState !== 'playing' ? 0.4 : pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.rotateText, { fontSize: scaleFont(12) }]}>↻</Text>
          </HapticPressable>
        </View>

        <View style={[styles.actionRow, { marginTop: scaleSpacing(8), gap: scaleSpacing(8) }]}>
          <HapticPressable
            disabled={resolveState !== 'playing' || puzzle.maxResets - puzzle.resetsUsed <= 0}
            onPress={handleResetRing}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                opacity: resolveState !== 'playing' || puzzle.maxResets - puzzle.resetsUsed <= 0
                  ? 0.4
                  : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.secondaryLabel, { fontSize: scaleFont(10) }]}>[ RESET RING ]</Text>
          </HapticPressable>
          <HapticPressable
            disabled={!selectedKeyId || resolveState !== 'playing'}
            onPress={handleInsert}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                borderColor: fit?.fits ? TERMINAL_GREEN : '#334155',
                backgroundColor: fit?.fits ? 'rgba(0, 255, 51, 0.1)' : 'rgba(15, 23, 42, 0.7)',
                opacity: !selectedKeyId || resolveState !== 'playing' ? 0.4 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.primaryLabel, { fontSize: scaleFont(11), color: fit?.fits ? TERMINAL_GREEN : MUTED_WHITE }]}>
              [ INSERT KEY ]
            </Text>
          </HapticPressable>
        </View>

        <View style={[styles.feedbackSlot, { minHeight: scaleSize(24), marginTop: scaleSpacing(8) }]}>
          {feedback ? (
            <Text
              style={[
                styles.feedback,
                {
                  fontSize: scaleFont(10),
                  color: resolveState === 'success'
                    ? TERMINAL_GREEN
                    : resolveState === 'failure'
                      ? COLLAPSE_RED
                      : WARN_AMBER,
                },
              ]}
            >
              {feedback}
            </Text>
          ) : (
            <Text style={[styles.feedbackMuted, { fontSize: scaleFont(9) }]}>
              {usedCount > 0 ? `${usedCount} glyph key(s) spent.` : 'Some keys fit more than one ring — each is used once.'}
            </Text>
          )}
        </View>

        {penaltyLine ? (
          <Text style={[styles.penalty, { fontSize: scaleFont(8), marginTop: scaleSpacing(4) }]}>
            {penaltyLine}
          </Text>
        ) : null}

        {banner ? (
          <Text
            style={[
              styles.banner,
              {
                fontSize: scaleFont(10),
                lineHeight: scaleFont(14),
                color: resolveState === 'success' ? TERMINAL_GREEN : COLLAPSE_RED,
                marginTop: scaleSpacing(6),
              },
            ]}
          >
            {banner}
          </Text>
        ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function RingVisual({
  ring,
  cx,
  cy,
  outerR,
  innerR,
  isActive,
  previewOccupied,
  previewFits,
}: {
  ring: VeilLockRing;
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
  isActive: boolean;
  previewOccupied: number[];
  previewFits: boolean;
}): React.JSX.Element {
  return (
    <G>
      <Circle
        cx={cx}
        cy={cy}
        r={outerR}
        fill="none"
        stroke={ring.complete ? 'rgba(0,255,51,0.6)' : isActive ? REQUIRED_STROKE : RING_STROKE}
        strokeWidth={isActive ? 2 : 1}
      />
      {Array.from({ length: ring.socketCount }, (_, socket) => {
        const required = ring.requiredSockets.includes(socket);
        const filled = ring.filledSockets.includes(socket);
        const previewed = isActive && previewOccupied.includes(socket);
        let fillColor = WALL_FILL;
        if (filled) fillColor = FILLED_FILL;
        else if (previewed) fillColor = previewFits ? 'rgba(0,255,51,0.45)' : 'rgba(239,68,68,0.5)';
        else if (required) fillColor = 'rgba(103, 232, 249, 0.18)';
        const stroke = required ? REQUIRED_STROKE : 'rgba(148,163,184,0.4)';
        return (
          <Path
            key={`sock-${ring.ringIndex}-${socket}`}
            d={socketArcPath(cx, cy, outerR, innerR, socket, ring.socketCount)}
            fill={fillColor}
            stroke={stroke}
            strokeWidth={required ? 1.2 : 0.6}
            opacity={ring.complete && !filled ? 0.4 : 1}
          />
        );
      })}
    </G>
  );
}

function GlyphKeyChip({
  glyphKey,
  socketCount,
  selected,
  disabled,
  onSelect,
  scaleSize,
  scaleFont,
}: {
  glyphKey: VeilGlyphKey;
  socketCount: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  scaleSize: (n: number) => number;
  scaleFont: (n: number) => number;
}): React.JSX.Element {
  const chip = scaleSize(52);
  const r = chip / 2 - scaleSize(4);
  const cxy = chip / 2;
  const occupied = keyOccupiedSockets(glyphKey, glyphKey.currentRotation, socketCount);
  return (
    <HapticPressable
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.keyChip,
        {
          width: chip,
          height: chip + scaleSize(12),
          borderColor: glyphKey.used
            ? '#334155'
            : selected
              ? TERMINAL_GREEN
              : glyphKey.decoy
                ? 'rgba(148,163,184,0.5)'
                : 'rgba(103, 232, 249, 0.6)',
          opacity: glyphKey.used ? 0.35 : pressed ? 0.8 : 1,
          backgroundColor: selected ? 'rgba(0,255,51,0.08)' : 'rgba(15,23,42,0.85)',
        },
      ]}
    >
      <Svg width={chip} height={chip}>
        <Circle cx={cxy} cy={cxy} r={r} fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth={1} />
        {Array.from({ length: socketCount }, (_, socket) => {
          const on = occupied.includes(socket);
          const p = polar(cxy, cxy, r, (360 / socketCount) * socket);
          return (
            <Circle
              key={`tooth-${glyphKey.keyId}-${socket}`}
              cx={p.x}
              cy={p.y}
              r={on ? scaleSize(3) : scaleSize(1.1)}
              fill={on ? (selected ? TERMINAL_GREEN : '#67e8f9') : 'rgba(148,163,184,0.35)'}
            />
          );
        })}
      </Svg>
      <Text style={[styles.keyLabel, { fontSize: scaleFont(6), color: glyphKey.used ? '#475569' : MUTED_WHITE }]}>
        {glyphKey.used ? 'SPENT' : glyphKey.family}
      </Text>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  panel: { flex: 1, minHeight: 0, borderWidth: 1, padding: 12 },
  scrollBody: { flex: 1, minHeight: 0 },
  title: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.5,
    color: TERMINAL_GREEN,
  },
  subtitle: {
    fontFamily: 'monospace',
    color: BODY_MUTED,
    marginTop: 4,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  meta: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.8 },
  diagramWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: CORE_IDLE,
    paddingVertical: 8,
  },
  instruction: {
    fontFamily: 'monospace',
    color: '#6b7280',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  keyChip: {
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  keyLabel: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  rotateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rotateBtn: {
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  rotateText: { fontFamily: 'monospace', color: MUTED_WHITE, fontWeight: '700' },
  fitBadge: { flex: 1, alignItems: 'center' },
  fitText: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.8 },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryLabel: { fontFamily: 'monospace', color: BODY_MUTED, fontWeight: '700' },
  primaryBtn: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryLabel: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1,
  },
  feedbackSlot: { justifyContent: 'center' },
  feedback: { fontFamily: 'monospace', letterSpacing: 0.3 },
  feedbackMuted: { fontFamily: 'monospace', color: '#6b7280', letterSpacing: 0.3 },
  penalty: { fontFamily: 'monospace', color: '#7f1d1d', letterSpacing: 0.4 },
  banner: { fontFamily: 'monospace', letterSpacing: 0.3 },
});
