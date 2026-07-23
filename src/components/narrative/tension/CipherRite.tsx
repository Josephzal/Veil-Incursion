import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  NARRATIVE_UNIFIED_PANEL_BG,
  NARRATIVE_UNIFIED_PANEL_BORDER,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { USE_NATIVE_DRIVER } from '../../../utils/platformMotion';
import { hashSeed } from '../../../data/narrative/narrativeAssemblyCore';
import type { TensionMechanicProps } from './tensionMechanicTypes';
import {
  corruptionLevelForAttempts,
  formatCipherAlignmentFeedback,
  generateCipherRitePuzzle,
  scoreCipherGuess,
  type CipherRitePuzzle,
} from './cipherRiteEngine';
import { logNarrativeMinigameCompleted } from '../../../data/narrative/narrativeMinigameTelemetry';
import { VEIL } from '../../../theme/veilTerminalTokens';

const TERMINAL_GREEN = VEIL.mint;
const DIM_GREEN = '#1f7a33';
const ADDR_GREEN = '#0f5a22';
const BODY_MUTED = VEIL.textMuted;
const WARN_AMBER = '#FBBF24';
const COLLAPSE_RED = '#EF4444';
const PANEL_INNER = '#03060a';
const FILLER_CHARS = '!@#$%^&*()_+-=[]{};:<>?/\\|░▒▓█¦╪╬╳·•°¬~«»†‡§';
const DUD_CLUSTERS = ['‡╪╬', '«§»', '†¬†', '╳░╳', '¦°¦', '§‡§'] as const;
const GLITCH_CHARS = '░▒▓█¦╪╬╳·';

type ResolveState = 'playing' | 'success' | 'failure';

interface DumpSegment {
  text: string;
  candidateIndex?: number;
  dud?: string;
}

interface DumpRow {
  address: string;
  segments: DumpSegment[];
}

interface AttemptLogEntry {
  token: string;
  line: string;
  tone: 'ok' | 'warn' | 'fail' | 'dud';
}

function fillerString(len: number, seed: string, salt: string): string {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += FILLER_CHARS[hashSeed(`${seed}:${salt}:${i}`) % FILLER_CHARS.length]!;
  }
  return out;
}

function glitchText(text: string, intensity: number, salt: number): string {
  if (intensity < 0.06) return text;
  const chance = Math.min(0.4, intensity * 0.5);
  return text
    .split('')
    .map((ch, i) => {
      const roll = ((salt * 17 + i * 31) % 100) / 100;
      return roll < chance ? GLITCH_CHARS[(salt + i) % GLITCH_CHARS.length]! : ch;
    })
    .join('');
}

/** Build a deterministic "memory dump" of hex-addressed junk with the cipher
 *  candidates (and a few inert glyph clusters) embedded as selectable tokens. */
function buildMemoryDump(candidates: readonly string[], seed: string): DumpRow[] {
  const rows: DumpRow[] = [];
  const rowWidth = 15;
  const addrBase = 0x1000 + (hashSeed(`${seed}:addr`) % 0xa000);
  let addrStep = 0;
  const nextAddress = (): string => {
    const value = (addrBase + addrStep * 0x0c) & 0xffff;
    addrStep += 1;
    return `0x${value.toString(16).toUpperCase().padStart(4, '0')}`;
  };

  candidates.forEach((candidate, i) => {
    const trimmed = candidate.trim();
    const lead = 1 + (hashSeed(`${seed}:lead:${i}`) % 4);
    const leadStr = fillerString(lead, seed, `lf:${i}`);
    const tailLen = Math.max(1, rowWidth - lead - trimmed.length);
    const tailStr = fillerString(tailLen, seed, `tf:${i}`);
    rows.push({
      address: nextAddress(),
      segments: [{ text: leadStr }, { text: trimmed, candidateIndex: i }, { text: tailStr }],
    });

    // Interleave a junk row, occasionally embedding an inert dud cluster.
    const hasDud = hashSeed(`${seed}:dudrow:${i}`) % 3 === 0;
    if (hasDud) {
      const dud = DUD_CLUSTERS[hashSeed(`${seed}:dud:${i}`) % DUD_CLUSTERS.length]!;
      const lead2 = 1 + (hashSeed(`${seed}:dlead:${i}`) % 5);
      const l2 = fillerString(lead2, seed, `dl:${i}`);
      const t2 = fillerString(Math.max(1, rowWidth - lead2 - dud.length), seed, `dt:${i}`);
      rows.push({
        address: nextAddress(),
        segments: [{ text: l2 }, { text: dud, dud }, { text: t2 }],
      });
    } else {
      rows.push({ address: nextAddress(), segments: [{ text: fillerString(rowWidth, seed, `jr:${i}`) }] });
    }
  });

  return rows;
}

const SUCCESS_LINES = [
  'The hostile cipher collapses into a clean access pattern.',
  'The scanner catches the true phrase inside the static.',
  'The sealed system opens with a sound like glass cracking underwater.',
] as const;

const FAILURE_LINES = [
  'The interface blooms with black static. The lock seals itself.',
  'The final glyph fractures. The system refuses the breach.',
] as const;

/**
 * Cipher Rite — occult terminal breach. Presented as a hostile memory-dump
 * console: hex-addressed junk with cipher fragments embedded as selectable
 * glyph tokens. Selecting a fragment reports positional glyph resonance
 * (likeness) — hacking-flavored, not a copy of any single game's terminal.
 * Does not mutate run state; callers own success/failure resolution.
 */
export default function CipherRite({
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
  const seed = `cipher-rite:${difficulty}:${narrativeEventId ?? 'live'}`;
  const [puzzle] = useState<CipherRitePuzzle>(() =>
    generateCipherRitePuzzle({ difficulty, seed }),
  );
  const dumpRows = useMemo(() => buildMemoryDump(puzzle.candidates, `${seed}:dump`), [puzzle.candidates, seed]);

  const [attemptsLeft, setAttemptsLeft] = useState(puzzle.maxAttempts);
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [log, setLog] = useState<AttemptLogEntry[]>([]);
  const [lastGuess, setLastGuess] = useState<string | null>(null);
  const [guessed, setGuessed] = useState<ReadonlySet<string>>(() => new Set());
  const [resolveState, setResolveState] = useState<ResolveState>('playing');
  const [flickerTick, setFlickerTick] = useState(0);
  const resolvedRef = useRef(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const corruption = corruptionLevelForAttempts(
    wrongGuesses,
    puzzle.maxAttempts,
    puzzle.corruptionProfile,
  );

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || resolveState !== 'playing') return undefined;
    const id = setInterval(() => setFlickerTick((t) => t + 1), 700);
    return () => clearInterval(id);
  }, [reduceMotion, resolveState]);

  const penaltyLine = useMemo(() => {
    if (!defaultPenalty) return null;
    if (defaultPenalty.type === 'HP') {
      return `LOCK DENIAL RISK — ${defaultPenalty.amount} HP (applied on fail by narrative)`;
    }
    return `LOCK DENIAL RISK — +${defaultPenalty.amount} RESONANCE (applied on fail by narrative)`;
  }, [defaultPenalty]);

  const shakeFrame = useCallback(() => {
    if (reduceMotion) return;
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 40, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 40, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 0.6, duration: 40, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [reduceMotion, shakeAnim]);

  const pushLog = useCallback((entry: AttemptLogEntry) => {
    setLog((prev) => [entry, ...prev].slice(0, 6));
  }, []);

  const finishSuccess = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolveState('success');
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_CipherRite',
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
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_CipherRite',
      difficulty,
      success: false,
      attemptsUsed: attemptsUsedRef.current,
      timeElapsedMs: Date.now() - startedAtRef.current,
      narrativeEventId,
    });
    onFailure();
  }, [difficulty, narrativeEventId, onFailure]);

  const handleGuess = useCallback(
    (candidate: string) => {
      if (resolveState !== 'playing' || resolvedRef.current) return;
      if (guessed.has(candidate)) return;

      const score = scoreCipherGuess(candidate, puzzle.correctCipher);
      const token = candidate.trim();
      setLastGuess(candidate);
      setGuessed((prev) => new Set(prev).add(candidate));

      if (score.isCorrect) {
        pushLog({ token, line: 'RESONANCE LOCKED — ACCESS GRANTED', tone: 'ok' });
        finishSuccess();
        return;
      }

      const nextAttempts = attemptsLeft - 1;
      const nextWrong = wrongGuesses + 1;
      attemptsUsedRef.current += 1;
      setAttemptsLeft(nextAttempts);
      setWrongGuesses(nextWrong);
      pushLog({
        token,
        line: `RESONANCE ${score.alignedCount}/${score.totalCount} — ${formatCipherAlignmentFeedback(score)}`,
        tone: 'warn',
      });
      shakeFrame();

      if (nextAttempts <= 0) {
        pushLog({ token: 'SYSTEM', line: 'SIGNAL COLLAPSE — NO ATTEMPTS REMAINING', tone: 'fail' });
        finishFailure();
      }
    },
    [
      attemptsLeft,
      finishFailure,
      finishSuccess,
      guessed,
      puzzle.correctCipher,
      pushLog,
      resolveState,
      shakeFrame,
      wrongGuesses,
    ],
  );

  const handleDud = useCallback(
    (dud: string) => {
      if (resolveState !== 'playing') return;
      pushLog({ token: dud, line: 'INERT CLUSTER — NO RESONANCE (NO ATTEMPT SPENT)', tone: 'dud' });
    },
    [pushLog, resolveState],
  );

  const translateX = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-scaleSize(4), scaleSize(4)],
  });

  const warnLine =
    wrongGuesses <= 0 ? 'SIGNAL STABLE'
      : wrongGuesses === 1 ? 'INTERFACE CORRUPTION DETECTED'
        : wrongGuesses === 2 ? 'HOSTILE STATIC RISING'
          : wrongGuesses >= 3 ? 'CIPHER MATRIX CRITICAL'
            : 'SIGNAL DEGRADING';

  const resolveBanner =
    resolveState === 'success'
      ? SUCCESS_LINES[puzzle.puzzleId.length % SUCCESS_LINES.length]!
      : resolveState === 'failure'
        ? FAILURE_LINES[puzzle.puzzleId.length % FAILURE_LINES.length]!
        : null;

  const renderSegment = (seg: DumpSegment, rowKey: string, segIndex: number): React.JSX.Element => {
    const key = `${rowKey}:${segIndex}`;
    if (seg.candidateIndex != null) {
      const candidate = puzzle.candidates[seg.candidateIndex]!;
      const used = guessed.has(candidate);
      const disabled = resolveState !== 'playing' || used;
      return (
        <Text
          key={key}
          onPress={disabled ? undefined : () => handleGuess(candidate)}
          suppressHighlighting
          style={[
            styles.token,
            {
              fontSize: scaleFont(11),
              color: lastGuess === candidate ? WARN_AMBER : used ? '#3f5f46' : TERMINAL_GREEN,
              textDecorationLine: used ? 'line-through' : 'none',
            },
          ]}
        >
          {`[${seg.text}]`}
        </Text>
      );
    }
    if (seg.dud != null) {
      return (
        <Text
          key={key}
          onPress={resolveState !== 'playing' ? undefined : () => handleDud(seg.dud!)}
          suppressHighlighting
          style={[styles.dud, { fontSize: scaleFont(11) }]}
        >
          {`[${seg.text}]`}
        </Text>
      );
    }
    const shown = reduceMotion || resolveState !== 'playing'
      ? seg.text
      : glitchText(seg.text, corruption, flickerTick + segIndex * 7);
    return (
      <Text key={key} style={[styles.filler, { fontSize: scaleFont(11) }]}>
        {shown}
      </Text>
    );
  };

  return (
    <Animated.View
      style={[
        styles.root,
        { padding: scaleSpacing(NARRATIVE_UNIFIED_PANEL_PADDING), transform: [{ translateX }] },
      ]}
    >
      <View
        style={[
          styles.panel,
          { borderColor: NARRATIVE_UNIFIED_PANEL_BORDER, backgroundColor: NARRATIVE_UNIFIED_PANEL_BG },
        ]}
      >
        <Text style={[styles.title, { fontSize: scaleFont(11) }]}>
          {'VEIL-OS 7.3 // MNEMONIC BREACH'}
        </Text>
        <Text style={[styles.subtitle, { fontSize: scaleFont(9), lineHeight: scaleFont(13) }]}>
          Select the true cipher fragment. Wrong reads report glyph resonance only.
        </Text>

        <View style={[styles.metaRow, { marginTop: scaleSpacing(6), gap: scaleSpacing(10) }]}>
          <Text style={[styles.meta, { fontSize: scaleFont(9), color: TERMINAL_GREEN }]}>
            {`BREACH ATTEMPTS ${attemptsLeft}/${puzzle.maxAttempts}`}
          </Text>
          <Text
            style={[
              styles.meta,
              { fontSize: scaleFont(9), color: wrongGuesses >= 2 ? COLLAPSE_RED : WARN_AMBER },
            ]}
          >
            {warnLine}
          </Text>
        </View>

        {penaltyLine ? (
          <Text style={[styles.penalty, { fontSize: scaleFont(8), marginTop: scaleSpacing(3) }]}>
            {penaltyLine}
          </Text>
        ) : null}

        <View style={[styles.dumpWrap, { marginTop: scaleSpacing(6) }]}>
          <ScrollView
            style={styles.dumpScroll}
            contentContainerStyle={{ padding: scaleSpacing(6) }}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {dumpRows.map((row, rowIndex) => {
              const rowKey = `${row.address}:${rowIndex}`;
              return (
                <View key={rowKey} style={styles.dumpRow}>
                  <Text style={[styles.addr, { fontSize: scaleFont(10) }]}>{`${row.address} `}</Text>
                  <Text style={styles.dumpLine} numberOfLines={1}>
                    {row.segments.map((seg, segIndex) => renderSegment(seg, rowKey, segIndex))}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.logWrap, { marginTop: scaleSpacing(6) }]}>
          <Text style={[styles.logHeader, { fontSize: scaleFont(8) }]}>{'> BREACH LOG'}</Text>
          {log.length === 0 ? (
            <Text style={[styles.logMuted, { fontSize: scaleFont(9) }]}>
              {'> awaiting fragment select…'}
            </Text>
          ) : (
            log.map((entry, i) => (
              <Text
                key={`${entry.token}:${i}`}
                numberOfLines={1}
                style={[
                  styles.logLine,
                  {
                    fontSize: scaleFont(9),
                    color:
                      entry.tone === 'ok'
                        ? TERMINAL_GREEN
                        : entry.tone === 'fail'
                          ? COLLAPSE_RED
                          : entry.tone === 'dud'
                            ? BODY_MUTED
                            : WARN_AMBER,
                  },
                ]}
              >
                {`> ${entry.token.trim()} :: ${entry.line}`}
              </Text>
            ))
          )}
        </View>

        {resolveBanner ? (
          <Text
            style={[
              styles.resolveBanner,
              {
                fontSize: scaleFont(10),
                lineHeight: scaleFont(14),
                color: resolveState === 'success' ? TERMINAL_GREEN : COLLAPSE_RED,
                marginTop: scaleSpacing(6),
              },
            ]}
          >
            {resolveBanner}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  panel: { flex: 1, minHeight: 0, borderWidth: 1, padding: 12 },
  title: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.2,
    color: TERMINAL_GREEN,
  },
  subtitle: { fontFamily: 'monospace', color: BODY_MUTED, marginTop: 3 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  meta: { fontFamily: 'monospace', letterSpacing: 0.8, fontWeight: '700' },
  penalty: { fontFamily: 'monospace', color: '#7f1d1d', letterSpacing: 0.4 },
  dumpWrap: {
    flex: 1,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#0f2a16',
    backgroundColor: PANEL_INNER,
    overflow: 'hidden',
  },
  dumpScroll: { flex: 1 },
  dumpRow: { flexDirection: 'row', alignItems: 'center' },
  addr: {
    fontFamily: 'monospace',
    color: ADDR_GREEN,
    letterSpacing: 0.5,
  },
  dumpLine: {
    flex: 1,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  filler: {
    fontFamily: 'monospace',
    color: DIM_GREEN,
    letterSpacing: 1,
  },
  token: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  dud: {
    fontFamily: 'monospace',
    color: '#4b5563',
    letterSpacing: 1,
  },
  logWrap: {
    borderWidth: 1,
    borderColor: '#0f2a16',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 6,
    gap: 1,
  },
  logHeader: {
    fontFamily: 'monospace',
    color: ADDR_GREEN,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 2,
  },
  logMuted: { fontFamily: 'monospace', color: '#4b5563', letterSpacing: 0.3 },
  logLine: { fontFamily: 'monospace', letterSpacing: 0.3 },
  resolveBanner: { fontFamily: 'monospace', letterSpacing: 0.3 },
});
