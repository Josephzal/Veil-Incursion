import React, { useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';

const TERMINAL_ACCENT = '#00ff33';
const LOG_SURFACE = '#0a0b0f';

/** Fixed macro log footprint shared across combat, checkpoint, and scanner screens. */
export const MACRO_LOG_BLOCK_HEIGHT = 110;
const SCROLL_CONTENT_PADDING_BOTTOM = 16;

interface PersistentTerminalLogProps {
  visible?: boolean;
  docked?: boolean;
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
}: PersistentTerminalLogProps): React.JSX.Element | null {
  const { runLog } = useRun();
  const { theme } = useTerminal();
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (runLog.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [runLog]);

  if (!visible || runLog.length === 0) return null;

  const bottomInset = docked ? resolveBottomInset(insets.bottom) : 0;

  const logBlock = (
    <View
      style={[
        styles.container,
        {
          borderColor: theme.borderColor,
          backgroundColor: LOG_SURFACE,
          height: MACRO_LOG_BLOCK_HEIGHT,
        },
      ]}
    >
      <Text style={[styles.header, { color: theme.mutedColor }]}>RUN TERMINAL // MACRO LOG</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
  container: {
    width: '100%',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    flexShrink: 0,
    flexGrow: 0,
    overflow: 'hidden',
  },
  header: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1,
    marginBottom: 4,
    flexShrink: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SCROLL_CONTENT_PADDING_BOTTOM,
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
