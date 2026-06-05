import React, { useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import NarrativeStepperModule from '../components/NarrativeStepperModule';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import OperativeTelemetryBar from '../components/OperativeTelemetryBar';
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
        <MacroLogAnchoredLayout
          showMacroLog={runState.runActive}
          style={{ backgroundColor: theme.backgroundColor }}
        >
          <View style={[styles.body, { backgroundColor: theme.backgroundColor }]}>
            <Text style={[styles.fallback, { color: theme.mutedColor }]}>
              NO ACTIVE NARRATIVE VECTOR — AWAITING MAP COORDINATOR.
            </Text>
          </View>
        </MacroLogAnchoredLayout>
      </IncursionShell>
    );
  }

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.body}>
          <OperativeTelemetryBar />
          <View style={styles.content}>
            <NarrativeStepperModule
              node={node}
              onComplete={handleComplete}
              borderColor={theme.borderColor}
              mutedColor={theme.mutedColor}
              primaryColor={theme.primaryColor}
            />
          </View>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0 },
  content: { flex: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 8, justifyContent: 'center' },
  fallback: {
    fontFamily: 'monospace',
    fontSize: 10,
    textAlign: 'center',
    padding: 24,
    letterSpacing: 0.8,
  },
});
