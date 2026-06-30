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
import { HUB_BORDER_INSET } from '../constants/hubCta';
import { useHubLayout } from '../context/HubLayoutContext';
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
  const {
    isDesktop,
    scaleSpacing,
    gap,
    contentWidth,
    shadowWarMapLaneWidth,
    shadowWarIntelLaneWidth,
  } = useHubLayout();
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
        <View style={styles.stage}>
          <View
            style={[
              styles.body,
              isDesktop ? styles.bodyDesktop : styles.bodyMobile,
              isDesktop
                ? {
                    gap,
                    flex: 1,
                    alignSelf: 'stretch',
                    paddingHorizontal: HUB_BORDER_INSET,
                    paddingBottom: scaleSpacing(8),
                    maxWidth: contentWidth,
                    width: contentWidth,
                  }
                : null,
            ]}
          >
            <CabalPanel
              fillHeight={isDesktop}
              style={[
                styles.mapColumn,
                isDesktop
                  ? { width: shadowWarMapLaneWidth, flexShrink: 0 }
                  : styles.mapColumnMobile,
              ]}
              contentStyle={[
                styles.panelContent,
                styles.mapPanelContent,
                { padding: scaleSpacing(isDesktop ? 12 : 10) },
              ]}
            >
              <View style={styles.mapStack} onLayout={handleMapStackLayout}>
                <View style={styles.mapLayer}>
                  <ShadowWarMap
                    theme={theme}
                    activeSectorId={activeSectorId}
                    sectorIp={state.sectorIp}
                    onSectorPress={setActiveSectorId}
                  />
                </View>
                <HackingTerminalOverlay viewportHeight={mapViewportHeight} />
              </View>
            </CabalPanel>

            <View
              style={[
                styles.intelColumn,
                isDesktop
                  ? {
                      flex: 1,
                      minWidth: shadowWarIntelLaneWidth,
                      minHeight: 0,
                      alignSelf: 'stretch',
                      justifyContent: 'space-between',
                    }
                  : styles.intelColumnMobile,
              ]}
            >
              <ShadowWarInfluencePanel
                theme={theme}
                sectorId={activeSectorId}
                sectorIp={state.sectorIp[activeSectorId]}
                weeklyDonatedIP={state.weeklyDonatedIP}
                onDonatePress={() => setDonationOpen(true)}
              />
            </View>
          </View>
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
              style={[styles.modalPanel, { maxWidth: Math.min(600, Math.floor(contentWidth * 0.92)) }]}
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
  stage: {
    flex: 1,
    minHeight: 0,
  },
  body: {
    flex: 1,
    minHeight: 0,
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
  },
  mapColumnMobile: {
    flex: 0.42,
    maxHeight: '48%',
    flexShrink: 1,
  },
  intelColumn: {
    minHeight: 0,
    minWidth: 0,
  },
  intelColumnMobile: {
    flex: 1,
  },
  panelContent: {
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
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 5, 0.85)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(18px)',
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
