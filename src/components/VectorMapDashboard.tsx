import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import MetropolitanMagnetismMap from './MetropolitanMagnetismMap';
import {
  formatBracketHeader,
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
  hubTerminalUi,
  HUB_DATA_DIVIDER,
} from '../styles/hubTerminalUi';
import { pulseHubButton } from '../utils/hubButtonHaptics';
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

        <View style={styles.logPanel}>
          <Text style={[hubTerminalUi.sectionHeader, styles.logHeader, { color: theme.mutedColor }]}>
            {formatBracketHeader('REGIONAL MAGNETISM LOG')}
          </Text>
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
        onPress={() => {
          if (runDisabled) return;
          pulseHubButton();
          onInitiateDeepDive();
        }}
        disabled={runDisabled}
        style={({ pressed }) => [
          getInteractiveButtonStyle(theme.statusColor, {
            disabled: runDisabled,
            pressed,
            size: 'lg',
          }),
          styles.deepDiveBtn,
          runDisabled ? null : pressed ? { opacity: 0.85 } : null,
        ]}
      >
        <Text style={[getInteractiveButtonTextStyle('lg'), { color: theme.statusColor }]}>
          BEGIN INCURSION
        </Text>
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
  logPanel: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    marginBottom: 12,
    overflow: 'hidden',
    height: LOG_BLOCK_HEIGHT,
    borderTopWidth: 0,
    borderTopColor: HUB_DATA_DIVIDER,
  },
  logHeader: { marginBottom: 4 },
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
  deepDiveBtn: { marginTop: 8, gap: 6 },
  deepDiveSub: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.4 },
});
