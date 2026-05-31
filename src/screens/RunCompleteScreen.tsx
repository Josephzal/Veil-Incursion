import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getClusterDefinition } from '../data/climateClusters';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import PersistentTerminalLog from '../components/PersistentTerminalLog';

const TERMINAL_ACCENT = '#00ff33';

export default function RunCompleteScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, endRun } = useRun();
  const { goToHub } = useGameFlow();

  const handleReturn = () => {
    endRun('OPERATOR RETURNED TO BASE');
    goToHub();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: TERMINAL_ACCENT }]}>INCURSION RUN COMPLETE</Text>
        <Text style={[styles.body, { color: theme.mutedColor }]}>
          All {runState.totalNodes} nodes secured. Your operative returns to the terminal grid intact.
        </Text>
        <View style={[styles.statsBox, { borderColor: theme.borderColor }]}>
          <Text style={[styles.stat, { color: theme.primaryColor }]}>
            FINAL SOUL ANCHOR: {runState.soulAnchorIntegrity}/{runState.maxSoulAnchor}
          </Text>
          <Text style={[styles.stat, { color: theme.primaryColor }]}>
            FINAL STAMINA: {runState.currentStamina}/{runState.maxStamina}
          </Text>
          {runState.climateCluster && (
            <Text style={[styles.stat, { color: theme.mutedColor }]}>
              CLIMATE CLUSTER: {getClusterDefinition(runState.climateCluster).name}
            </Text>
          )}
          {runState.activeTrinkets.length > 0 && (
            <Text style={[styles.stat, { color: theme.mutedColor }]}>
              TRINKETS: {runState.activeTrinkets.length}
            </Text>
          )}
        </View>

        <Pressable
          onPress={handleReturn}
          style={({ pressed }) => [
            styles.button,
            { borderColor: TERMINAL_ACCENT, backgroundColor: pressed ? '#0d1a12' : '#0e1624' },
          ]}
        >
          <Text style={styles.buttonLabel}>[ RETURN TO TERMINAL ]</Text>
        </Pressable>
      </View>

      <PersistentTerminalLog />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 24,
  },
  statsBox: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 28,
  },
  stat: {
    fontFamily: 'monospace',
    fontSize: 11,
    marginBottom: 6,
    textAlign: 'center',
  },
  button: {
    borderWidth: 2,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonLabel: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: TERMINAL_ACCENT,
    letterSpacing: 1.2,
  },
});
