import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';

export const CONTRACT_LOGGED_MESSAGE = 'CONTRACT LOGGED';
const CHAR_MS = 48;
const TERMINAL = '#69c8ad';
const TERMINAL_BRIGHT = '#8ee0c6';

/** Fixed dossier status slot height — logged/typewriter/idle share the same footprint. */
export const DOSSIER_STATUS_SLOT_HEIGHT = 28;

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

/** Typewriter clock — completes in place and stays; never auto-dismisses. */
export function useContractAcceptTypewriter(
  stamp: ContractAcceptStampState | null,
  reducedMotion: boolean,
): { typed: string; cursorOn: boolean; typing: boolean } {
  const [typed, setTyped] = useState('');
  const [cursorOn, setCursorOn] = useState(true);
  const [typing, setTyping] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const cursorInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!stamp) {
      setTyping(false);
      setTyped('');
      setCursorOn(false);
      return undefined;
    }

    const clearTimers = () => {
      timers.current.forEach((id) => clearTimeout(id));
      timers.current = [];
      if (cursorInterval.current) {
        clearInterval(cursorInterval.current);
        cursorInterval.current = null;
      }
    };

    clearTimers();
    setTyping(true);
    setTyped(reducedMotion ? CONTRACT_LOGGED_MESSAGE : '');
    setCursorOn(true);

    const schedule = (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, ms));
    };

    if (reducedMotion) {
      setTyping(false);
      setCursorOn(false);
    } else {
      for (let i = 1; i <= CONTRACT_LOGGED_MESSAGE.length; i += 1) {
        schedule(i * CHAR_MS, () => {
          setTyped(CONTRACT_LOGGED_MESSAGE.slice(0, i));
        });
      }
      schedule(CONTRACT_LOGGED_MESSAGE.length * CHAR_MS + 40, () => {
        setTyping(false);
        setCursorOn(false);
      });
      cursorInterval.current = setInterval(() => {
        setCursorOn((prev) => !prev);
      }, 420);
    }

    return clearTimers;
  }, [reducedMotion, stamp]);

  return {
    typed: stamp ? (typing ? typed : CONTRACT_LOGGED_MESSAGE) : '',
    cursorOn: Boolean(stamp) && typing && cursorOn,
    typing: Boolean(stamp) && typing,
  };
}

interface ContractLoggedLineProps {
  typed?: string;
  cursorOn?: boolean;
  /** Announce only while characters are still arriving. */
  live?: boolean;
}

/** Inline terminal line for the dossier status slot. */
export function ContractLoggedLine({
  typed = CONTRACT_LOGGED_MESSAGE,
  cursorOn = false,
  live = false,
}: ContractLoggedLineProps): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      style={styles.line}
      accessibilityRole="text"
      accessibilityLiveRegion={live ? 'polite' : 'none'}
      accessibilityLabel="Contract logged"
      {...(Platform.OS === 'web' && live
        ? ({
            role: 'status',
            'aria-live': 'polite',
            'aria-atomic': 'true',
          } as object)
        : null)}
    >
      <TerminalText size={8} letterSpacing={1.05} style={styles.prompt}>
        {'>> '}
      </TerminalText>
      <TerminalText size={10} letterSpacing={1.2} style={styles.message}>
        {typed}
      </TerminalText>
      {cursorOn ? (
        <TerminalText size={10} letterSpacing={0} style={styles.cursor}>
          █
        </TerminalText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    height: DOSSIER_STATUS_SLOT_HEIGHT,
    minHeight: DOSSIER_STATUS_SLOT_HEIGHT,
  },
  prompt: {
    color: TERMINAL,
    fontWeight: '700',
  },
  message: {
    color: TERMINAL_BRIGHT,
    fontWeight: '800',
  },
  cursor: {
    color: TERMINAL_BRIGHT,
    fontWeight: '700',
    marginLeft: 1,
  },
});
