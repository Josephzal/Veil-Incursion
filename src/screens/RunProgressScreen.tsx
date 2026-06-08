import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DescentPipelineHUD from '../components/DescentPipelineHUD';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { getFactionDefinition } from '../data/factions';

export default function RunProgressScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, activeIncursion, runLog } = useRun();
  const { account } = usePlayerAccount();
  const { continueOperation } = useDescentNavigator();

  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : '#00ff33';

  const staminaPct = Math.round((runState.currentStamina / runState.maxStamina) * 100);
  const soulPct = Math.round((runState.soulAnchorIntegrity / runState.maxSoulAnchor) * 100);
  const shieldIntegrity = Math.max(0, Math.min(100, soulPct + 8));

  const recentLogs = runLog.slice(-6);

  return (
    <IncursionShell hidePipeline>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.body}>
          <View style={[styles.header, { borderColor: theme.borderColor }]}>
            <Text style={[styles.headerTitle, { color: accent }]}>SECTOR CHECKPOINT // PERFORMANCE REVIEW</Text>
            <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
              DEPTH {activeIncursion.currentDepth} // VECTOR CLEARED — OPERATIVE STATUS NOMINAL
            </Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.pipelineFrame}>
              <DescentPipelineHUD
                depth={activeIncursion.currentDepth}
                currentEncounterIndex={activeIncursion.currentEncounterIndex}
                encounterPath={activeIncursion.encounterPath}
                accentColor={accent}
                borderColor={theme.borderColor}
                mutedColor={theme.mutedColor}
                compact={false}
              />
            </View>

            {activeIncursion.lastCheckpointMessage && (
              <View style={[styles.panel, { borderColor: theme.borderColor }]}>
                <Text style={[styles.panelLabel, { color: theme.mutedColor }]}>LAST VECTOR RESOLUTION</Text>
                <Text style={[styles.panelBody, { color: theme.primaryColor }]}>
                  {activeIncursion.lastCheckpointMessage}
                </Text>
              </View>
            )}

            <View style={[styles.panel, { borderColor: theme.borderColor }]}>
              <Text style={[styles.panelLabel, { color: theme.mutedColor }]}>OPERATIVE RESOURCE POOLS</Text>
              <Text style={[styles.statLine, { color: theme.primaryColor }]}>
                SOUL ANCHOR: {runState.soulAnchorIntegrity}/{runState.maxSoulAnchor} ({soulPct}%)
              </Text>
              <View style={[styles.meterTrack, { borderColor: accent }]}>
                <View style={[styles.meterFill, { width: `${soulPct}%`, backgroundColor: accent }]} />
              </View>
              <Text style={[styles.statLine, { color: theme.primaryColor }]}>
                STAMINA CORE: {runState.currentStamina}/{runState.maxStamina} ({staminaPct}%)
              </Text>
              <View style={[styles.meterTrack, { borderColor: theme.borderColor }]}>
                <View
                  style={[
                    styles.meterFill,
                    { width: `${staminaPct}%`, backgroundColor: staminaPct < 35 ? '#ef4444' : accent },
                  ]}
                />
              </View>
              <Text style={[styles.statLine, { color: theme.mutedColor }]}>
                SHIELD INTEGRITY: {shieldIntegrity}% // DECAY NOMINAL
              </Text>
            </View>

            <View style={[styles.panel, { borderColor: theme.borderColor }]}>
              <Text style={[styles.panelLabel, { color: theme.mutedColor }]}>COMPLETED VECTOR LOG</Text>
              <ScrollView
                style={styles.vectorLogScroll}
                contentContainerStyle={styles.vectorLogScrollContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {recentLogs.map((line, idx) => (
                  <View key={`${idx}-${line.slice(0, 16)}`} style={styles.logRow}>
                    <Text style={[styles.logLine, { color: accent }]}>{line}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          <Pressable
            onPress={continueOperation}
            style={({ pressed }) => [
              styles.continueBtn,
              { borderColor: accent, opacity: pressed ? 0.75 : 1, backgroundColor: pressed ? '#0d1a12' : '#0a0b0f' },
            ]}
          >
            <Text style={[styles.continueBtnText, { color: accent }]}>[ CONTINUE OPERATION ]</Text>
          </Pressable>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  header: { borderBottomWidth: 1, paddingVertical: 12, paddingHorizontal: 16, flexShrink: 0 },
  headerTitle: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textAlign: 'center' },
  headerSub: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.9, textAlign: 'center', marginTop: 6 },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 8 },
  pipelineFrame: { width: '100%', alignSelf: 'stretch', overflow: 'hidden' },
  panel: { borderWidth: 1, padding: 12, backgroundColor: '#050608' },
  panelLabel: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 1.2, marginBottom: 8 },
  panelBody: { fontFamily: 'monospace', fontSize: 9, lineHeight: 14 },
  statLine: {
    fontFamily: 'monospace',
    fontSize: 9,
    marginBottom: 4,
    letterSpacing: 0.4,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  meterTrack: { height: 6, borderWidth: 1, marginBottom: 10, backgroundColor: '#0a0b0f', overflow: 'hidden' },
  meterFill: { height: '100%' },
  logLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
    flexShrink: 1,
    flexWrap: 'wrap',
    width: '100%',
  },
  logRow: { flexDirection: 'row', width: '100%' },
  vectorLogScroll: { height: 96, marginTop: 4 },
  vectorLogScrollContent: { paddingBottom: 4 },
  continueBtn: {
    borderWidth: 2,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 14,
    alignItems: 'center',
    flexShrink: 0,
  },
  continueBtnText: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
});
