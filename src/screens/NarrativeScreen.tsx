import React, { useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import NarrativeStepperModule from '../components/NarrativeStepperModule';
import PersistentTerminalLog from '../components/PersistentTerminalLog';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { CheckStatus } from '../types/game';

export default function NarrativeScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { getCurrentNarrativeNode, resolveNarrativeCheck, appendRunLog, runState } = useRun();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const resolvingRef = useRef(false);

  const node = getCurrentNarrativeNode();

  const handleComplete = (result: { choice: 'A' | 'B'; status: CheckStatus }) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;

    const logLine = resolveNarrativeCheck(result.choice, result.status);
    appendRunLog(logLine);
    appendRunLog('>> NARRATIVE NODE RESOLVED — RETURNING TO LEY-LINE GRID.');
    finalizeIncursionAdvance('Narrative event cleared.');
  };

  if (!node) {
    return (
      <IncursionShell>
        <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
          <Text style={[styles.fallback, { color: theme.mutedColor }]}>
            NO ACTIVE NARRATIVE VECTOR — AWAITING MAP COORDINATOR.
          </Text>
        </View>
      </IncursionShell>
    );
  }

  return (
    <IncursionShell>
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.content}>
          <NarrativeStepperModule
            node={node}
            onComplete={handleComplete}
            borderColor={theme.borderColor}
            mutedColor={theme.mutedColor}
            primaryColor={theme.primaryColor}
          />
        </View>
        <PersistentTerminalLog visible={runState.runActive} expanded />
      </View>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8, justifyContent: 'center' },
  fallback: {
    fontFamily: 'monospace',
    fontSize: 10,
    textAlign: 'center',
    padding: 24,
    letterSpacing: 0.8,
  },
});
