import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import SectorOverworldMap from '../components/SectorOverworldMap';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame, { RunEventScreenHeader } from '../components/layout/RunEventScreenFrame';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { getFactionDefinition } from '../data/factions';

export default function RunProgressScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, activeIncursion, getCurrentVectorCluster } = useRun();
  const vectorCluster = getCurrentVectorCluster();
  const { account } = usePlayerAccount();
  const { continueOperation } = useDescentNavigator();

  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : '#00ff33';

  const staminaPct = Math.round((runState.currentStamina / runState.maxStamina) * 100);
  const soulPct = Math.round((runState.soulAnchorIntegrity / runState.maxSoulAnchor) * 100);
  const shieldIntegrity = Math.max(0, Math.min(100, soulPct + 8));

  return (
    <IncursionShell>
      <IncursionRunLayout style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventScreenFrame
          scrollable
          header={(
            <RunEventScreenHeader
              title="SECTOR CHECKPOINT // PERFORMANCE REVIEW"
              subtitle={`SECTOR T${activeIncursion.sectorTier} // NODE ${activeIncursion.nodesCleared} CLEARED — OPERATIVE STATUS NOMINAL`}
              borderColor={theme.borderColor}
              titleColor={accent}
              subtitleColor={theme.mutedColor}
            />
          )}
          footer={(
            <HapticPressable
              onPress={continueOperation}
              style={({ pressed }) => [
                styles.continueBtn,
                { borderColor: accent, opacity: pressed ? 0.75 : 1, backgroundColor: pressed ? '#0d1a12' : '#0a0b0f' },
              ]}
            >
              <Text style={[styles.continueBtnText, { color: accent }]}>[ CONTINUE OPERATION ]</Text>
            </HapticPressable>
          )}
        >
          <View style={styles.pipelineFrame}>
            <SectorOverworldMap
              graph={activeIncursion.sectorGraph}
              currentNodeId={activeIncursion.currentNodeId}
              encounterPath={activeIncursion.encounterPath}
              focusedNodeIds={activeIncursion.focusedNodeIds}
              cluster={vectorCluster}
              accentColor={accent}
              compact
              interactive={false}
            />
          </View>

          {activeIncursion.lastCheckpointMessage ? (
            <View style={[styles.panel, { borderColor: theme.borderColor }]}>
              <Text style={[styles.panelLabel, { color: theme.mutedColor }]}>LAST VECTOR RESOLUTION</Text>
              <Text style={[styles.panelBody, { color: theme.primaryColor }]}>
                {activeIncursion.lastCheckpointMessage}
              </Text>
            </View>
          ) : null}

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
        </RunEventScreenFrame>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
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
  continueBtn: {
    borderWidth: 2,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueBtnText: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
});
