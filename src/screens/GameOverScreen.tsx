import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import PersistentTerminalLog from '../components/PersistentTerminalLog';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { formatTimeAliveMmSs } from '../types/runDeathSummary';

const TERMINAL_ACCENT = '#ef4444';

export default function GameOverScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runLog, deathSummary } = useRun();
  const { goToHub } = useGameFlow();

  const handleReturn = () => {
    goToHub();
  };

  const timeAlive = deathSummary
    ? formatTimeAliveMmSs(deathSummary.timeAliveMs)
    : '--:--';
  const causeOfDeath = deathSummary?.causeOfDeath ?? 'UNKNOWN TERMINATION';
  const sectorNode = deathSummary ? `Level ${deathSummary.sectorLevel}` : 'Level —';
  const depthLabel = deathSummary ? `Depth ${deathSummary.depthLayer}` : 'Depth —';

  return (
    <TerminalSafeArea>
      <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>INCURSION FAILED</Text>
        <Text style={[styles.subtitle, { color: TERMINAL_ACCENT }]}>GAME OVER // SOUL ANCHOR SEVERED</Text>
        <Text style={[styles.body, { color: theme.mutedColor }]}>
          Operative link to the urban ley-grid has collapsed. All run progress has been purged from the terminal matrix.
        </Text>

        <View style={[styles.statsPanel, { borderColor: theme.borderColor }]}>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.mutedColor }]}>TIME ALIVE</Text>
            <Text style={[styles.statValue, { color: theme.primaryColor }]}>{timeAlive}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.mutedColor }]}>CAUSE OF DEATH</Text>
            <Text style={[styles.statValue, { color: TERMINAL_ACCENT }]} numberOfLines={2}>
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

        <View style={[styles.logPreview, { borderColor: theme.borderColor }]}>
          {runLog.slice(-4).map((line, idx) => (
            <Text key={`${idx}-${line.slice(0, 8)}`} style={[styles.logLine, { color: theme.mutedColor }]}>
              {line}
            </Text>
          ))}
        </View>

        <Pressable
          onPress={handleReturn}
          style={({ pressed }) => [
            styles.button,
            { borderColor: TERMINAL_ACCENT, backgroundColor: pressed ? '#1a0a0a' : '#0e1624' },
          ]}
        >
          <Text style={styles.buttonLabel}>[ RETURN TO TERMINAL ]</Text>
        </Pressable>
      </View>

      <PersistentTerminalLog />
      </View>
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: {
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    color: '#ef4444',
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
    marginBottom: 20,
  },
  statsPanel: {
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    backgroundColor: 'rgba(5, 6, 8, 0.92)',
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
  logPreview: { borderWidth: 1, padding: 12, marginBottom: 28 },
  logLine: { fontFamily: 'monospace', fontSize: 9, lineHeight: 14, marginBottom: 4 },
  button: { borderWidth: 2, paddingVertical: 16, alignItems: 'center' },
  buttonLabel: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
    letterSpacing: 1.2,
  },
});
