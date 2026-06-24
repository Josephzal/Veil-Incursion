import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import DonationTerminalPanel from './shadowWar/DonationTerminalPanel';
import ShadowWarInfluencePanel from './shadowWar/ShadowWarInfluencePanel';
import ShadowWarMap from './shadowWar/ShadowWarMap';
import { formatBracketHeader, hubTerminalUi } from '../styles/hubTerminalUi';
import { useShadowWar } from '../context/ShadowWarContext';
import type { ShadowWarSectorId } from '../types/shadowWar';
import { TerminalTheme } from '../types/theme';
import { SHADOW_WAR_SECTORS } from '../data/shadowWarSectors';

interface ShadowWarDashboardProps {
  theme: TerminalTheme;
  onAppendLog: (line: string) => void;
}

export default function ShadowWarDashboard({
  theme,
  onAppendLog,
}: ShadowWarDashboardProps): React.JSX.Element {
  const { state } = useShadowWar();
  const [activeSectorId, setActiveSectorId] = useState<ShadowWarSectorId>(SHADOW_WAR_SECTORS[0].id);
  const [donationOpen, setDonationOpen] = useState(false);

  return (
    <View style={styles.root}>
      <Text style={[hubTerminalUi.sectionHeaderLg, styles.title, { color: theme.mutedColor }]}>
        {formatBracketHeader('SHADOW WAR // VEIL CONTROL')}
      </Text>
      <Text style={[styles.sub, { color: theme.mutedColor }]}>
        5 MACRO-SECTORS // ASYNC CABAL TUG-OF-WAR // WEEKLY IP CYCLE
      </Text>

      <View style={styles.mapRegion}>
        <ShadowWarMap
          theme={theme}
          activeSectorId={activeSectorId}
          sectorIp={state.sectorIp}
          onSectorPress={setActiveSectorId}
        />
      </View>

      <View style={styles.influenceRegion}>
        <ShadowWarInfluencePanel
          theme={theme}
          sectorId={activeSectorId}
          sectorIp={state.sectorIp[activeSectorId]}
          weeklyDonatedIP={state.weeklyDonatedIP}
          onDonatePress={() => setDonationOpen(true)}
        />
      </View>

      <Modal
        visible={donationOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDonationOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: theme.borderColor, backgroundColor: theme.backgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primaryColor }]}>
                DONATION TERMINAL
              </Text>
              <HapticPressable
                onPress={() => setDonationOpen(false)}
                style={[styles.closeBtn, { borderColor: theme.borderColor }]}
              >
                <Text style={[styles.closeBtnText, { color: theme.mutedColor }]}>[ CLOSE ]</Text>
              </HapticPressable>
            </View>
            <DonationTerminalPanel
              sectorId={activeSectorId}
              onStatus={(line) => {
                onAppendLog(line);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  title: { marginBottom: 2, flexShrink: 0 },
  sub: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    marginBottom: 6,
    flexShrink: 0,
  },
  mapRegion: {
    height: '40%',
    minHeight: 120,
    flexShrink: 0,
  },
  influenceRegion: {
    flex: 1,
    minHeight: 0,
    marginTop: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    maxHeight: '88%',
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    flex: 1,
  },
  closeBtn: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeBtnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
  },
});
