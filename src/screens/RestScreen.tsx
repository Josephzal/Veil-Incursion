import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import OperativeTelemetryBar from '../components/OperativeTelemetryBar';

const TERMINAL_ACCENT = '#00ff33';

export default function RestScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, applyRestChoice } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const [chosen, setChosen] = useState<'REST' | 'REPAIR' | null>(null);

  const handleChoice = (type: 'REST' | 'REPAIR') => {
    if (chosen) return;
    setChosen(type);
    applyRestChoice(type);
    const msg = type === 'REST' ? 'Stamina reserves replenished.' : 'Soul anchor repaired.';
    setTimeout(() => completeCurrentNode(msg), 1200);
  };

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.screenBody}>
          <OperativeTelemetryBar />
        
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.primaryColor }]}>REST / SANCTUARY NODE</Text>
            <Text style={[styles.bodyText, { color: theme.mutedColor }]}>
              A quiet anchor chapel hums with stabilizing ley-energy. Choose how to recover before the next incursion vector.
            </Text>

            <View style={[styles.statsBox, { borderColor: theme.borderColor }]}>
              <Text style={[styles.statLine, { color: theme.mutedColor }]}>
                SOUL ANCHOR: {runState.soulAnchorIntegrity}/{runState.maxSoulAnchor}
              </Text>
              <Text style={[styles.statLine, { color: theme.mutedColor }]}>
                STAMINA: {runState.currentStamina}/{runState.maxStamina}
              </Text>
            </View>

            <Pressable
              onPress={() => handleChoice('REST')}
              disabled={!!chosen}
              style={({ pressed }) => [
                styles.choiceButton,
                { borderColor: TERMINAL_ACCENT, opacity: chosen && chosen !== 'REST' ? 0.4 : 1, backgroundColor: pressed ? '#0d1a12' : '#0e1624' },
              ]}
            >
              <Text style={styles.choiceLabel}>[ REST ]</Text>
              <Text style={[styles.choiceDesc, { color: theme.mutedColor }]}>Restore 40% Stamina</Text>
            </Pressable>

            <Pressable
              onPress={() => handleChoice('REPAIR')}
              disabled={!!chosen}
              style={({ pressed }) => [
                styles.choiceButton,
                { borderColor: TERMINAL_ACCENT, opacity: chosen && chosen !== 'REPAIR' ? 0.4 : 1, backgroundColor: pressed ? '#0d1a12' : '#0e1624' },
              ]}
            >
              <Text style={styles.choiceLabel}>[ ATTUNE ]</Text>
              <Text style={[styles.choiceDesc, { color: theme.mutedColor }]}>Restore 25% Soul Anchor HP</Text>
            </Pressable>
          </View>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  headerText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  bodyText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 20,
  },
  statsBox: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 24,
  },
  statLine: {
    fontFamily: 'monospace',
    fontSize: 10,
    marginBottom: 4,
  },
  choiceButton: {
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
  },
  choiceLabel: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: TERMINAL_ACCENT,
    marginBottom: 4,
  },
  choiceDesc: {
    fontFamily: 'monospace',
    fontSize: 10,
  },
});
