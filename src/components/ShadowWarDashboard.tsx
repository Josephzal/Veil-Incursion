import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import DonationTerminalPanel from './shadowWar/DonationTerminalPanel';
import ShadowWarInfluencePanel from './shadowWar/ShadowWarInfluencePanel';
import ShadowWarMap from './shadowWar/ShadowWarMap';
import {
  formatBracketHeader,
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
  hubTerminalUi,
} from '../styles/hubTerminalUi';
import { pulseHubButton } from '../utils/hubButtonHaptics';
import { useShadowWar } from '../context/ShadowWarContext';
import type { ShadowWarSectorId } from '../types/shadowWar';
import { TerminalTheme } from '../types/theme';
import { SHADOW_WAR_SECTORS } from '../data/shadowWarSectors';

const LOG_BLOCK_HEIGHT = 100;

interface ShadowWarDashboardProps {
  theme: TerminalTheme;
  hubLog: string[];
  runDisabled: boolean;
  onInitiateDeepDive: () => void;
  onAppendLog: (line: string) => void;
}

function LogLine({ line, color }: { line: string; color: string }) {
  return (
    <View style={styles.logRow}>
      <Text style={[styles.logLine, { color }]}>{line}</Text>
    </View>
  );
}

export default function ShadowWarDashboard({
  theme,
  hubLog,
  runDisabled,
  onInitiateDeepDive,
  onAppendLog,
}: ShadowWarDashboardProps): React.JSX.Element {
  const { state } = useShadowWar();
  const [activeSectorId, setActiveSectorId] = useState<ShadowWarSectorId>(SHADOW_WAR_SECTORS[0].id);

  const combinedLog = [
    ...state.donationLog.slice(0, 6),
    ...hubLog.slice(-4),
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <Text style={[hubTerminalUi.sectionHeaderLg, styles.title, { color: theme.mutedColor }]}>
          {formatBracketHeader('SHADOW WAR // VEIL CONTROL')}
        </Text>
        <Text style={[styles.sub, { color: theme.mutedColor }]}>
          5 MACRO-SECTORS // ASYNC CABAL TUG-OF-WAR // WEEKLY IP CYCLE
        </Text>

        <ShadowWarMap
          theme={theme}
          activeSectorId={activeSectorId}
          sectorIp={state.sectorIp}
          onSectorPress={setActiveSectorId}
          expandedDetailPanel={(
            <ShadowWarInfluencePanel
              theme={theme}
              sectorId={activeSectorId}
              sectorIp={state.sectorIp[activeSectorId]}
              weeklyDonatedIP={state.weeklyDonatedIP}
            />
          )}
        />

        <ShadowWarInfluencePanel
          theme={theme}
          sectorId={activeSectorId}
          sectorIp={state.sectorIp[activeSectorId]}
          weeklyDonatedIP={state.weeklyDonatedIP}
        />

        <DonationTerminalPanel
          sectorId={activeSectorId}
          onStatus={onAppendLog}
        />

        <View style={styles.logPanel}>
          <Text style={[hubTerminalUi.sectionHeader, styles.logHeader, { color: theme.mutedColor }]}>
            {formatBracketHeader('SECTOR STATUS // DONATION LOG')}
          </Text>
          <ScrollView
            style={styles.logScroll}
            contentContainerStyle={styles.logScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {combinedLog.length === 0 ? (
              <LogLine line=">> AWAITING SHADOW WAR TELEMETRY..." color={theme.mutedColor} />
            ) : (
              combinedLog.map((line, idx) => (
                <LogLine key={`${line}-${idx}`} line={line} color={theme.statusColor} />
              ))
            )}
            <LogLine
              line={`>> ACTIVE SECTOR: ${activeSectorId.replace(/_/g, ' ')} // WEEKLY IP: ${state.weeklyDonatedIP}`}
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
          Stage loadout at Safehouse — then push into the Veil
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 12 },
  title: { marginBottom: 4 },
  sub: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.5, marginBottom: 10 },
  logPanel: {
    marginTop: 8,
    minHeight: LOG_BLOCK_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
  },
  logHeader: { marginBottom: 6 },
  logScroll: { maxHeight: LOG_BLOCK_HEIGHT },
  logScrollContent: { gap: 2 },
  logRow: { paddingVertical: 1 },
  logLine: { fontFamily: 'monospace', fontSize: 7, lineHeight: 11, letterSpacing: 0.3 },
  deepDiveBtn: { marginTop: 8 },
  deepDiveSub: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    marginTop: 4,
    textAlign: 'center',
  },
});
