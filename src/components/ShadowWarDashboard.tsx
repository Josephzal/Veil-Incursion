import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import CabalPanel from './hub/CabalPanel';
import DonationTerminalPanel from './shadowWar/DonationTerminalPanel';
import ShadowWarInfluencePanel from './shadowWar/ShadowWarInfluencePanel';
import ShadowWarMap from './shadowWar/ShadowWarMap';
import HubScreenShell from './hub/HubScreenShell';
import { useShadowWar } from '../context/ShadowWarContext';
import { useResponsiveScale } from '../hooks/useResponsiveScale';
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
  const { isDesktop, scaleSpacing } = useResponsiveScale();
  const [activeSectorId, setActiveSectorId] = useState<ShadowWarSectorId>(SHADOW_WAR_SECTORS[0].id);
  const [donationOpen, setDonationOpen] = useState(false);

  return (
    <>
      <HubScreenShell
        title="SHADOW WAR // VEIL CONTROL"
        subtitle="5 MACRO-SECTORS // ASYNC CABAL TUG-OF-WAR // WEEKLY IP CYCLE"
      >
        <View
          style={[
            styles.body,
            isDesktop ? styles.bodyDesktop : styles.bodyMobile,
            isDesktop ? { gap: scaleSpacing(24) } : null,
          ]}
        >
          <CabalPanel
            style={[
              styles.mapColumn,
              isDesktop ? styles.mapColumnDesktop : styles.mapColumnMobile,
            ]}
            contentStyle={styles.panelContent}
          >
            <ShadowWarMap
              theme={theme}
              activeSectorId={activeSectorId}
              sectorIp={state.sectorIp}
              onSectorPress={setActiveSectorId}
              isDesktop={isDesktop}
            />
          </CabalPanel>

          <CabalPanel
            style={[
              styles.intelColumn,
              isDesktop ? styles.intelColumnDesktop : styles.intelColumnMobile,
            ]}
            contentStyle={[styles.panelContent, styles.intelPanelContent]}
          >
            <ShadowWarInfluencePanel
              theme={theme}
              sectorId={activeSectorId}
              sectorIp={state.sectorIp[activeSectorId]}
              weeklyDonatedIP={state.weeklyDonatedIP}
              onDonatePress={() => setDonationOpen(true)}
              isDesktop={isDesktop}
            />
          </CabalPanel>
        </View>
      </HubScreenShell>

      <Modal
        visible={donationOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDonationOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: theme.borderColor, backgroundColor: 'rgba(10, 0, 21, 0.96)' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.statusColor }]}>
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
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  bodyMobile: {
    flexDirection: 'column',
    gap: 4,
  },
  bodyDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  mapColumn: {
    minHeight: 0,
    overflow: 'hidden',
  },
  mapColumnMobile: {
    flex: 0.42,
    maxHeight: '48%',
    flexShrink: 1,
  },
  mapColumnDesktop: {
    flex: 0.6,
  },
  intelColumn: {
    minHeight: 0,
    overflow: 'hidden',
  },
  intelColumnMobile: {
    flex: 1,
  },
  intelColumnDesktop: {
    flex: 0.4,
  },
  panelContent: {
    padding: 10,
  },
  intelPanelContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    fontSize: 8,
    letterSpacing: 0.5,
  },
});
