import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import TerminalResultsLayout from '../components/layout/TerminalResultsLayout';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { formatTimeAliveMmSs } from '../types/runDeathSummary';

const TERMINAL_ACCENT = '#ef4444';

export default function GameOverScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { deathSummary } = useRun();
  const { goToHub } = useGameFlow();

  const timeAlive = deathSummary
    ? formatTimeAliveMmSs(deathSummary.timeAliveMs)
    : '--:--';
  const causeOfDeath = deathSummary?.causeOfDeath ?? 'UNKNOWN TERMINATION';
  const sectorNode = deathSummary ? `Level ${deathSummary.sectorLevel}` : 'Level —';
  const depthLabel = deathSummary ? `Depth ${deathSummary.depthLayer}` : 'Depth —';

  return (
    <TerminalSafeArea>
      <TerminalResultsLayout
        accentBorderColor={`${TERMINAL_ACCENT}55`}
        narrative={(
          <>
            <Text style={styles.title}>INCURSION FAILED</Text>
            <Text style={[styles.subtitle, { color: TERMINAL_ACCENT }]}>
              GAME OVER // SOUL ANCHOR SEVERED
            </Text>
            <Text style={[styles.body, { color: theme.mutedColor }]}>
              Operative link to the urban ley-grid has collapsed. All run progress has been purged from the terminal matrix.
            </Text>
          </>
        )}
        summary={(
          <View style={[styles.statsPanel, { borderColor: theme.borderColor }]}>
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: theme.mutedColor }]}>TIME ALIVE</Text>
              <Text style={[styles.statValue, { color: theme.primaryColor }]}>{timeAlive}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: theme.mutedColor }]}>CAUSE OF DEATH</Text>
              <Text style={[styles.statValue, { color: TERMINAL_ACCENT }]} numberOfLines={3}>
                {causeOfDeath.toUpperCase()}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: theme.mutedColor }]}>SECTOR NODE</Text>
              <Text style={[styles.statValue, { color: theme.primaryColor }]}>{sectorNode}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: theme.mutedColor }]}>DEPTH</Text>
              <Text style={[styles.statValue, { color: theme.primaryColor }]}>{depthLabel}</Text>
            </View>
          </View>
        )}
        footer={(
          <Pressable
            onPress={goToHub}
            style={({ pressed }) => [
              styles.button,
              { borderColor: TERMINAL_ACCENT, backgroundColor: pressed ? '#1a0a0a' : '#0e1624' },
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
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    color: TERMINAL_ACCENT,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  statsPanel: {
    borderWidth: 1,
    padding: 14,
    gap: 10,
    backgroundColor: 'rgba(10, 11, 15, 0.88)',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  statLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  statValue: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'right',
    flex: 1,
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
