import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';

const TERMINAL_ACCENT = '#00ff33';

interface PersistentTerminalLogProps {
  visible?: boolean;
  expanded?: boolean;
}

export default function PersistentTerminalLog({
  visible = true,
  expanded = false,
}: PersistentTerminalLogProps): React.JSX.Element | null {
  const { runLog } = useRun();
  const { theme } = useTerminal();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (runLog.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [runLog]);

  if (!visible || runLog.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        expanded ? styles.containerExpanded : null,
        { borderColor: theme.borderColor, backgroundColor: '#0a0b0f' },
      ]}
    >
      <Text style={[styles.header, { color: theme.mutedColor }]}>RUN TERMINAL // MACRO LOG</Text>
      <ScrollView
        ref={scrollRef}
        style={[styles.scroll, expanded ? styles.scrollExpanded : null]}
        contentContainerStyle={styles.scrollContent}
      >
        {runLog.map((line, idx) => (
          <Text
            key={`${idx}-${line.slice(0, 12)}`}
            style={[styles.line, expanded ? styles.lineExpanded : null, { color: TERMINAL_ACCENT }]}
          >
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  containerExpanded: {
    width: '100%',
    maxHeight: 200,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    marginTop: 4,
  },
  header: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1,
    marginBottom: 4,
  },
  scroll: {
    maxHeight: 88,
  },
  scrollExpanded: {
    maxHeight: 168,
    minHeight: 100,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  line: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 13,
    marginBottom: 2,
  },
  lineExpanded: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 3,
  },
});
