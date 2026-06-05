import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import MetropolitanMagnetismMap from './MetropolitanMagnetismMap';
import { MacroSectorId } from '../types/regional';
import { TerminalTheme } from '../types/theme';

const LOG_BLOCK_HEIGHT = 100;

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

function MagnetismLogLine({ line, color }: { line: string; color: string }) {
  return (
    <View style={styles.logRow}>
      <Text style={[styles.logLine, { color }]}>{line}</Text>
    </View>
  );
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
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
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
              height: LOG_BLOCK_HEIGHT,
            },
          ]}
        >
          <Text style={[styles.logHeader, { color: theme.primaryColor }]}>REGIONAL MAGNETISM LOG</Text>
          <ScrollView
            style={styles.logScroll}
            contentContainerStyle={styles.logScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {hubLog.length === 0 ? (
              <MagnetismLogLine line=">> AWAITING SECTOR TELEMETRY..." color={theme.mutedColor} />
            ) : (
              hubLog.slice(-8).map((line, idx) => (
                <MagnetismLogLine key={`${line}-${idx}`} line={line} color={theme.statusColor} />
              ))
            )}
            <MagnetismLogLine
              line={`>> ACTIVE SECTOR: ${activeMagnetSector} // SCAN DEPTH READY: 1/10`}
              color={theme.mutedColor}
            />
          </ScrollView>
        </View>
      </ScrollView>

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
        <Text style={[styles.deepDiveTitle, { color: theme.statusColor }]}>BEGIN INCURSION</Text>
        <Text style={[styles.deepDiveSub, { color: theme.mutedColor }]}>
          Pass through the veil — Scan 1 of active sector run
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  logPanel: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, marginBottom: 12, overflow: 'hidden' },
  logHeader: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  logScroll: { flex: 1 },
  logScrollContent: { paddingBottom: 2 },
  logRow: { flexDirection: 'row', width: '100%' },
  logLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.3,
    marginBottom: 3,
    flexShrink: 1,
    flexWrap: 'wrap',
    width: '100%',
  },
  deepDiveBtn: { marginTop: 8, paddingVertical: 18, paddingHorizontal: 12, alignItems: 'center' },
  deepDiveTitle: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  deepDiveSub: { fontFamily: 'monospace', fontSize: 8, textAlign: 'center', letterSpacing: 0.4 },
});
