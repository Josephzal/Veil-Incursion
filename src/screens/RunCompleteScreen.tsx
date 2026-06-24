import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getClusterDefinition } from '../data/climateClusters';
import TerminalResultsLayout from '../components/layout/TerminalResultsLayout';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import TerminalSafeArea from '../components/TerminalSafeArea';

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
    <TerminalSafeArea>
      <TerminalResultsLayout
        accentBorderColor={`${TERMINAL_ACCENT}44`}
        narrative={(
          <>
            <Text style={[styles.title, { color: TERMINAL_ACCENT }]}>INCURSION RUN COMPLETE</Text>
            <Text style={[styles.body, { color: theme.mutedColor }]}>
              All {runState.totalNodes} nodes secured. Your operative returns to the terminal grid intact.
            </Text>
          </>
        )}
        summary={(
          <View style={[styles.statsBox, { borderColor: theme.borderColor }]}>
            <Text style={[styles.stat, { color: theme.primaryColor }]}>
              FINAL SOUL ANCHOR: {runState.soulAnchorIntegrity}/{runState.maxSoulAnchor}
            </Text>
            <Text style={[styles.stat, { color: theme.primaryColor }]}>
              FINAL STAMINA: {runState.currentStamina}/{runState.maxStamina}
            </Text>
            {runState.climateCluster ? (
              <Text style={[styles.stat, { color: theme.mutedColor }]}>
                CLIMATE CLUSTER: {getClusterDefinition(runState.climateCluster).name}
              </Text>
            ) : null}
            {runState.activeTrinkets.length > 0 ? (
              <Text style={[styles.stat, { color: theme.mutedColor }]}>
                TRINKETS: {runState.activeTrinkets.length}
              </Text>
            ) : null}
          </View>
        )}
        footer={(
          <Pressable
            onPress={handleReturn}
            style={({ pressed }) => [
              styles.button,
              { borderColor: TERMINAL_ACCENT, backgroundColor: pressed ? '#0d1a12' : '#0e1624' },
            ]}
          >
            <Text style={styles.buttonLabel}>[ RETURN TO TERMINAL ]</Text>
          </Pressable>
        )}
      />
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
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
  },
  statsBox: {
    borderWidth: 1,
    padding: 16,
    gap: 6,
    backgroundColor: 'rgba(10, 11, 15, 0.88)',
  },
  stat: {
    fontFamily: 'monospace',
    fontSize: 11,
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
