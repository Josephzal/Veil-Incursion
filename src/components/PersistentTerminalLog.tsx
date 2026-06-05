import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminalNav } from '../context/TerminalNavContext';
import { useTerminal } from '../context/TerminalContext';

const TERMINAL_ACCENT = '#00ff33';
const LOG_SURFACE = '#0a0b0f';

/** Fixed macro log footprint shared across combat, checkpoint, and scanner screens. */
export const MACRO_LOG_BLOCK_HEIGHT = 110;
const SCROLL_CONTENT_PADDING_BOTTOM = 16;

interface PersistentTerminalLogProps {
  visible?: boolean;
  docked?: boolean;
  /** Occupies remaining flex space in parent (combat stack) instead of fixed block height. */
  fillRemaining?: boolean;
  /** Upper-right control — ends run and returns to identity badge (incursion screens). */
  showEndRun?: boolean;
}

function resolveBottomInset(insetsBottom: number): number {
  return Math.max(insetsBottom, Platform.OS === 'android' ? 4 : 0);
}

function LogLine({ line, color }: { line: string; color: string }) {
  return (
    <View style={styles.lineRow}>
      <Text style={[styles.line, { color }]}>{line}</Text>
    </View>
  );
}

export default function PersistentTerminalLog({
  visible = true,
  docked = false,
  fillRemaining = false,
  showEndRun = false,
}: PersistentTerminalLogProps): React.JSX.Element | null {
  const { runLog, exitCombatToBadge } = useRun();
  const { goToHub } = useGameFlow();
  const { setTerminalView } = useTerminalNav();
  const { theme } = useTerminal();
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const handleEndRun = useCallback(() => {
    exitCombatToBadge();
    goToHub();
    setTerminalView('BADGE');
  }, [exitCombatToBadge, goToHub, setTerminalView]);

  useEffect(() => {
    if (runLog.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [runLog]);

  if (!visible) return null;
  if (!showEndRun && runLog.length === 0) return null;

  const bottomInset = docked ? resolveBottomInset(insets.bottom) : 0;

  const logBlock = (
    <View
      style={[
        styles.container,
        fillRemaining ? styles.containerFill : null,
        {
          borderColor: theme.borderColor,
          backgroundColor: LOG_SURFACE,
          ...(fillRemaining ? {} : { height: MACRO_LOG_BLOCK_HEIGHT }),
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: theme.mutedColor }]}>RUN TERMINAL // MACRO LOG</Text>
        {showEndRun ? (
          <Pressable
            onPress={handleEndRun}
            style={[styles.endRunBtn, { borderColor: theme.borderColor }]}
            accessibilityRole="button"
            accessibilityLabel="End run and return to identity badge"
          >
            <Text style={[styles.endRunBtnText, { color: theme.mutedColor }]}>[ EXTRACT ]</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, fillRemaining ? styles.scrollContentFill : null]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {runLog.map((line, idx) => (
          <LogLine key={`${idx}-${line.slice(0, 12)}`} line={line} color={TERMINAL_ACCENT} />
        ))}
      </ScrollView>
    </View>
  );

  if (!docked) {
    return logBlock;
  }

  return (
    <View
      style={[
        styles.dockShell,
        fillRemaining ? styles.dockShellFill : null,
        {
          paddingBottom: bottomInset,
          backgroundColor: LOG_SURFACE,
        },
      ]}
    >
      {logBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  dockShell: {
    width: '100%',
    flexShrink: 0,
    flexGrow: 0,
  },
  dockShellFill: {
    flex: 1,
    minHeight: 0,
    flexShrink: 1,
  },
  container: {
    width: '100%',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    flexShrink: 0,
    flexGrow: 0,
    overflow: 'hidden',
  },
  containerFill: {
    flex: 1,
    minHeight: 0,
    flexShrink: 1,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
    flexShrink: 0,
  },
  header: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1,
    flex: 1,
    minWidth: 0,
  },
  endRunBtn: {
    flexShrink: 0,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  endRunBtnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SCROLL_CONTENT_PADDING_BOTTOM,
    paddingHorizontal: 2,
  },
  scrollContentFill: {
    flexGrow: 1,
  },
  lineRow: {
    flexDirection: 'row',
    width: '100%',
  },
  line: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 13,
    marginBottom: 2,
    flexShrink: 1,
    flexWrap: 'wrap',
    width: '100%',
  },
});
