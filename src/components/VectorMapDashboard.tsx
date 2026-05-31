import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MetropolitanMagnetismMap from './MetropolitanMagnetismMap';
import { MacroSectorId } from '../types/regional';
import { TerminalTheme } from '../types/theme';

interface VectorMapDashboardProps {
  theme: TerminalTheme;
  homeSectorId: MacroSectorId;
  activeMagnetSector: MacroSectorId;
  isInfluenceFrozen: boolean;
  frozenInfluence: { TERRAN_GRID: number; LEGION: number; SOLARIS: number } | null;
  hubLog: string[];
  runDisabled: boolean;
  onSectorChange: (id: MacroSectorId) => void;
  onProxyReroute: (line: string) => void;
  onInitiateDeepDive: () => void;
}

export default function VectorMapDashboard({
  theme,
  homeSectorId,
  activeMagnetSector,
  isInfluenceFrozen,
  frozenInfluence,
  hubLog,
  runDisabled,
  onSectorChange,
  onProxyReroute,
  onInitiateDeepDive,
}: VectorMapDashboardProps): React.JSX.Element {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <MetropolitanMagnetismMap
        homeSectorId={homeSectorId}
        theme={theme}
        isInfluenceFrozen={isInfluenceFrozen}
        frozenInfluence={frozenInfluence}
        onProxyReroute={onProxyReroute}
        onSectorChange={onSectorChange}
      />

      <View
        style={[
          styles.logPanel,
          {
            borderColor: theme.borderColor,
            borderWidth: theme.borderWidth,
            borderStyle: theme.borderStyle,
          },
        ]}
      >
        <Text style={[styles.logHeader, { color: theme.primaryColor }]}>REGIONAL MAGNETISM LOG</Text>
        {hubLog.length === 0 ? (
          <Text style={[styles.logLine, { color: theme.mutedColor }]}>{'>> AWAITING SECTOR TELEMETRY...'}</Text>
        ) : (
          hubLog.slice(-8).map((line, idx) => (
            <Text key={`${line}-${idx}`} style={[styles.logLine, { color: theme.statusColor }]}>
              {line}
            </Text>
          ))
        )}
        <Text style={[styles.logLine, { color: theme.mutedColor }]}>
          {`>> ACTIVE SECTOR: ${activeMagnetSector} // SCAN DEPTH READY: 1/7`}
        </Text>
      </View>

      <Pressable
        onPress={onInitiateDeepDive}
        disabled={runDisabled}
        style={({ pressed }) => [
          styles.deepDiveBtn,
          {
            borderColor: theme.statusColor,
            borderWidth: theme.borderWidth + 1,
            opacity: runDisabled ? 0.4 : pressed ? 0.75 : 1,
            backgroundColor: pressed ? `${theme.primaryColor}18` : '#0a0b0f',
          },
        ]}
      >
        <Text style={[styles.deepDiveTitle, { color: theme.statusColor }]}>INITIATE DEEP-DIVE SCAN</Text>
        <Text style={[styles.deepDiveSub, { color: theme.mutedColor }]}>
          Deploy procedural vector cloud — Scan 1 of active sector run
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  logPanel: { padding: 10, marginBottom: 12, minHeight: 100 },
  logHeader: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  logLine: { fontFamily: 'monospace', fontSize: 8, lineHeight: 12, letterSpacing: 0.3, marginBottom: 3 },
  deepDiveBtn: { paddingVertical: 18, paddingHorizontal: 12, alignItems: 'center' },
  deepDiveTitle: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  deepDiveSub: { fontFamily: 'monospace', fontSize: 8, textAlign: 'center', letterSpacing: 0.4 },
});
