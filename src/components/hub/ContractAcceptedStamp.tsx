import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';

export const CONTRACT_LOGGED_MESSAGE = 'CONTRACT LOGGED';
export const CONTRACT_AVAILABLE_MESSAGE = 'AVAILABLE';
const CHAR_MS = 48;
/** Terminal phosphor green — greener than mint, secondary to dossier title. */
const TERMINAL = '#4FA87A';
const TERMINAL_SOFT = '#6EBF92';

/** Fixed dossier status slot — available/logged share the same footprint. */
export const DOSSIER_STATUS_SLOT_HEIGHT = 30;

export type ContractAcceptTarget =
  | { kind: 'SPONSOR'; contractId: string }
  | { kind: 'INDEPENDENT' };

export interface ContractAcceptStampState {
  stampId: string;
  target: ContractAcceptTarget;
}

export function matchesAcceptTarget(
  stamp: ContractAcceptStampState | null,
  target: ContractAcceptTarget,
): boolean {
  if (!stamp) return false;
  if (stamp.target.kind === 'INDEPENDENT') return target.kind === 'INDEPENDENT';
  return target.kind === 'SPONSOR' && stamp.target.contractId === target.contractId;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

/** Classic terminal caret blink. */
function useIdleCursor(enabled: boolean, reducedMotion: boolean): boolean {
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    if (!enabled || reducedMotion) {
      setCursorOn(true);
      return undefined;
    }
    setCursorOn(true);
    const id = setInterval(() => {
      setCursorOn((prev) => !prev);
    }, 530);
    return () => clearInterval(id);
  }, [enabled, reducedMotion]);

  if (!enabled) return false;
  if (reducedMotion) return true;
  return cursorOn;
}

/** Blink only while typing is active — no continuous animation after completion. */
function useTypingCursor(typing: boolean, reducedMotion: boolean): boolean {
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    if (!typing || reducedMotion) {
      setCursorOn(false);
      return undefined;
    }
    setCursorOn(true);
    const id = setInterval(() => {
      setCursorOn((prev) => !prev);
    }, 420);
    return () => clearInterval(id);
  }, [typing, reducedMotion]);

  return typing && !reducedMotion && cursorOn;
}

/**
 * Typewriter clock for `>> CONTRACT LOGGED`.
 * Completes in place; cursor stops when typing finishes.
 * Under reduced motion, reveals the completed line immediately.
 */
export function useContractAcceptTypewriter(
  stamp: ContractAcceptStampState | null,
  reducedMotion: boolean,
): { typed: string; cursorOn: boolean; typing: boolean } {
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const cursorOn = useTypingCursor(Boolean(stamp) && typing, reducedMotion);

  useEffect(() => {
    if (!stamp) {
      setTyping(false);
      setTyped('');
      return undefined;
    }

    const clearTimers = () => {
      timers.current.forEach((id) => clearTimeout(id));
      timers.current = [];
    };

    clearTimers();
    setTyping(true);
    setTyped(reducedMotion ? CONTRACT_LOGGED_MESSAGE : '');

    const schedule = (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, ms));
    };

    if (reducedMotion) {
      setTyping(false);
    } else {
      for (let i = 1; i <= CONTRACT_LOGGED_MESSAGE.length; i += 1) {
        schedule(i * CHAR_MS, () => {
          setTyped(CONTRACT_LOGGED_MESSAGE.slice(0, i));
        });
      }
      schedule(CONTRACT_LOGGED_MESSAGE.length * CHAR_MS + 40, () => {
        setTyping(false);
      });
    }

    return clearTimers;
  }, [reducedMotion, stamp]);

  return {
    typed: stamp ? (typing ? typed : CONTRACT_LOGGED_MESSAGE) : '',
    cursorOn,
    typing: Boolean(stamp) && typing,
  };
}

interface TerminalPromptLineProps {
  text: string;
  cursorOn?: boolean;
  live?: boolean;
  accessibilityLabel?: string;
  muted?: boolean;
}

/** Live terminal prompt line (`>> MESSAGE`) in a recessed CRT strip. */
export function TerminalPromptLine({
  text,
  cursorOn = false,
  live = false,
  accessibilityLabel,
  muted = false,
}: TerminalPromptLineProps): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      style={styles.terminal}
      accessibilityRole="text"
      accessibilityLiveRegion={live ? 'polite' : 'none'}
      accessibilityLabel={accessibilityLabel ?? text}
      {...(Platform.OS === 'web' && live
        ? ({
            role: 'status',
            'aria-live': 'polite',
            'aria-atomic': 'true',
          } as object)
        : null)}
    >
      <View
        pointerEvents="none"
        accessible={false}
        {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
        style={styles.terminalScan}
      />
      <View style={styles.line}>
        <TerminalText size={7} letterSpacing={0.95} style={[styles.prompt, muted && styles.promptMuted]}>
          {'>> '}
        </TerminalText>
        <TerminalText size={8.5} letterSpacing={1.05} style={[styles.message, muted && styles.messageMuted]}>
          {text}
        </TerminalText>
        {cursorOn ? (
          <TerminalText size={8.5} letterSpacing={0} style={styles.cursor}>
            █
          </TerminalText>
        ) : (
          <View style={styles.cursorSpacer} />
        )}
      </View>
    </View>
  );
}

interface ContractLoggedLineProps {
  typed?: string;
  live?: boolean;
  /** While true, show the typing cursor. When false, idle terminal caret. */
  cursorOn?: boolean;
}

/** `>> CONTRACT LOGGED` — live terminal acknowledgement. */
export function ContractLoggedLine({
  typed = CONTRACT_LOGGED_MESSAGE,
  live = false,
  cursorOn = false,
}: ContractLoggedLineProps): React.JSX.Element {
  const reduceMotion = usePrefersReducedMotion();
  const idleCursor = useIdleCursor(!cursorOn, reduceMotion);

  return (
    <TerminalPromptLine
      text={typed}
      cursorOn={cursorOn || idleCursor}
      live={live}
      accessibilityLabel="Contract logged"
    />
  );
}

/** Pre-accept status: AVAILABLE — idle live terminal prompt. */
export function DossierAvailabilityLine(): React.JSX.Element {
  const reduceMotion = usePrefersReducedMotion();
  const idleCursor = useIdleCursor(true, reduceMotion);

  return (
    <TerminalPromptLine
      text={CONTRACT_AVAILABLE_MESSAGE}
      cursorOn={idleCursor}
      muted
      accessibilityLabel="Available"
    />
  );
}

const styles = StyleSheet.create({
  terminal: {
    position: 'relative',
    height: DOSSIER_STATUS_SLOT_HEIGHT,
    minHeight: DOSSIER_STATUS_SLOT_HEIGHT,
    maxHeight: DOSSIER_STATUS_SLOT_HEIGHT,
    paddingHorizontal: 8,
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(3, 5, 4, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79, 168, 122, 0.18)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 0 rgba(79, 168, 122, 0.07), inset 0 -10px 18px rgba(0, 0, 0, 0.45)',
      } as object,
      default: {},
    }),
  },
  terminalScan: {
    ...StyleSheet.absoluteFill,
    opacity: 0.09,
    ...Platform.select({
      web: {
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(110, 191, 146, 0.08) 0px, rgba(110, 191, 146, 0.08) 1px, transparent 1px, transparent 3px)',
      } as object,
      default: {
        backgroundColor: 'rgba(110, 191, 146, 0.03)',
      },
    }),
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    zIndex: 1,
  },
  prompt: {
    color: TERMINAL,
    fontWeight: '700',
  },
  promptMuted: {
    color: TERMINAL,
    opacity: 0.75,
  },
  message: {
    color: TERMINAL_SOFT,
    fontWeight: '700',
  },
  messageMuted: {
    opacity: 0.85,
  },
  cursor: {
    color: TERMINAL_SOFT,
    fontWeight: '700',
    marginLeft: 2,
  },
  cursorSpacer: {
    width: 7,
    marginLeft: 2,
  },
});
