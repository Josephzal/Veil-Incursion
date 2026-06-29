import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, Modal, Platform, StyleSheet, View } from 'react-native';
import HapticPressable from './HapticPressable';
import CabalPanel from './hub/CabalPanel';
import DonationTerminalPanel from './shadowWar/DonationTerminalPanel';
import HackingTerminalOverlay from './shadowWar/HackingTerminalOverlay';
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
  const [mapViewportHeight, setMapViewportHeight] = useState(0);

  const handleMapStackLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setMapViewportHeight((prev) => (prev === height ? prev : height));
  }, []);

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
            contentStyle={[styles.panelContent, styles.mapPanelContent]}
          >
            <View style={styles.mapStack} onLayout={handleMapStackLayout}>
              <View style={styles.mapLayer}>
                <ShadowWarMap
                  theme={theme}
                  activeSectorId={activeSectorId}
                  sectorIp={state.sectorIp}
                  onSectorPress={setActiveSectorId}
                  isDesktop={isDesktop}
                />
              </View>
              <HackingTerminalOverlay viewportHeight={mapViewportHeight} />
            </View>
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
        <View style={styles.modalRoot}>
          <HapticPressable
            style={styles.modalBackdrop}
            onPress={() => setDonationOpen(false)}
            accessibilityLabel="Close donation terminal"
          />
          <View style={styles.modalPanelHost} pointerEvents="box-none">
            <CabalPanel
              shrinkWrap
              style={styles.modalPanel}
              contentStyle={styles.modalPanelContent}
            >
              <DonationTerminalPanel
                sectorId={activeSectorId}
                onClose={() => setDonationOpen(false)}
                onStatus={(line) => {
                  onAppendLog(line);
                }}
              />
            </CabalPanel>
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
    flex: 1,
    minHeight: 0,
  },
  mapPanelContent: {
    position: 'relative',
  },
  mapStack: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  mapLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  intelPanelContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 5, 0.85)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(18px)',
        // @ts-expect-error — web-only vendor prefix
        WebkitBackdropFilter: 'blur(18px)',
      },
      default: {},
    }),
  },
  modalPanelHost: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalPanel: {
    width: '90%',
    maxWidth: 600,
    maxHeight: '88%',
  },
  modalPanelContent: {
    maxHeight: '100%',
  },
});
