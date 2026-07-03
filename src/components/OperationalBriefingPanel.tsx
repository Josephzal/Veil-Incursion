import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import DossierCardShell from './hub/DossierCardShell';
import HubScreenShell from './hub/HubScreenShell';
import HackingTerminalOverlay from './shadowWar/HackingTerminalOverlay';
import EmployerContractPanel from './veilFront/EmployerContractPanel';
import SectorBriefingPanel from './veilFront/SectorBriefingPanel';
import VeilFrontMap from './veilFront/VeilFrontMap';
import { getDossierFactionAccent } from '../data/factions';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useWorldState } from '../context/WorldStateContext';
import { HUB_BORDER_INSET } from '../constants/hubCta';
import { useHubLayout } from '../context/HubLayoutContext';
import type { SectorId } from '../types/worldState';
import { TerminalTheme } from '../types/theme';

interface OperationalBriefingPanelProps {
  theme: TerminalTheme;
  onAppendLog: (line: string) => void;
  onBeginIncursion: () => void;
  runDisabled: boolean;
  launching: boolean;
}

export default function OperationalBriefingPanel({
  theme,
  onAppendLog,
  onBeginIncursion,
  runDisabled,
  launching,
}: OperationalBriefingPanelProps): React.JSX.Element {
  const { account } = usePlayerAccount();
  const {
    sectors,
    persisted,
    setSelectedSectorId,
    setSelectedEmployerCabal,
  } = useWorldState();
  const {
    isDesktop,
    scaleSpacing,
    gap,
    contentWidth,
    veilFrontMapLaneWidth,
    veilFrontIntelLaneWidth,
  } = useHubLayout();
  const [mapViewportHeight, setMapViewportHeight] = useState(0);

  const dossierAccent = getDossierFactionAccent(account.alignedFaction);
  const panelPadding = scaleSpacing(isDesktop ? 12 : 10);
  const activeSector = sectors.find((s) => s.id === persisted.selectedSectorId) ?? sectors[0];

  const handleSectorPress = useCallback((sectorId: SectorId) => {
    setSelectedSectorId(sectorId);
    onAppendLog(`>> VEIL FRONT — SECTOR SELECTED: ${sectorId.replace(/_/g, ' ')}`);
  }, [onAppendLog, setSelectedSectorId]);

  const handleMapStackLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setMapViewportHeight((prev) => (prev === height ? prev : height));
  }, []);

  const handleBeginIncursion = useCallback(() => {
    const sponsorLine = persisted.selectedEmployerCabal
      ? ` // SPONSOR: ${persisted.selectedEmployerCabal.replace('_', ' ')}`
      : '';
    onAppendLog(`>> BREACH VECTOR LOCKED — ${activeSector.displayName.toUpperCase()}${sponsorLine}`);
    onBeginIncursion();
  }, [activeSector.displayName, onAppendLog, onBeginIncursion, persisted.selectedEmployerCabal]);

  const body = (
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
        <View
          style={[
            styles.mapColumn,
            isDesktop
              ? { width: veilFrontMapLaneWidth, flexShrink: 0 }
              : styles.mapColumnMobile,
          ]}
        >
          <View
            style={[
              styles.mapPanelContent,
              { padding: panelPadding },
              isDesktop ? styles.mapPanelDesktop : null,
            ]}
          >
            <View style={styles.mapStack} onLayout={handleMapStackLayout}>
              <View style={styles.mapLayer}>
                <VeilFrontMap
                  theme={theme}
                  sectors={sectors}
                  activeSectorId={persisted.selectedSectorId}
                  onSectorPress={handleSectorPress}
                />
              </View>
              <HackingTerminalOverlay viewportHeight={mapViewportHeight} />
            </View>
          </View>
        </View>

        <DossierCardShell
          fillHeight
          padding={panelPadding}
          accentColor={dossierAccent}
          style={[
            styles.dossierColumn,
            isDesktop
              ? {
                  flex: 1,
                  minWidth: veilFrontIntelLaneWidth,
                  minHeight: 0,
                  alignSelf: 'stretch',
                }
              : styles.dossierColumnMobile,
          ]}
          contentStyle={styles.dossierContent}
        >
          <SectorBriefingPanel theme={theme} sector={activeSector} />
        </DossierCardShell>

        <DossierCardShell
          fillHeight
          padding={panelPadding}
          accentColor={dossierAccent}
          style={[
            styles.contractColumn,
            isDesktop
              ? {
                  width: veilFrontIntelLaneWidth,
                  flexShrink: 0,
                  minHeight: 0,
                  alignSelf: 'stretch',
                }
              : styles.contractColumnMobile,
          ]}
          contentStyle={styles.contractContent}
        >
          {isDesktop ? (
            <EmployerContractPanel
              theme={theme}
              sector={activeSector}
              selectedEmployer={persisted.selectedEmployerCabal}
              onSelectEmployer={setSelectedEmployerCabal}
              onBeginIncursion={handleBeginIncursion}
              runDisabled={runDisabled}
              launching={launching}
            />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mobileContractScroll}>
              <EmployerContractPanel
                theme={theme}
                sector={activeSector}
                selectedEmployer={persisted.selectedEmployerCabal}
                onSelectEmployer={setSelectedEmployerCabal}
                onBeginIncursion={handleBeginIncursion}
                runDisabled={runDisabled}
                launching={launching}
              />
            </ScrollView>
          )}
        </DossierCardShell>
      </View>
    </View>
  );

  return (
    <HubScreenShell
      title="OPERATIONAL BRIEFING"
      subtitle="VEIL FRONT // SECTOR DOSSIER // OPTIONAL SPONSOR CONTRACT"
    >
      {body}
    </HubScreenShell>
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
    flex: 1,
  },
  mapColumnMobile: {
    flex: 0.38,
    maxHeight: '40%',
    flexShrink: 1,
  },
  mapPanelContent: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  mapPanelDesktop: {
    minHeight: 0,
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
  dossierColumn: {
    minHeight: 0,
    minWidth: 0,
  },
  dossierColumnMobile: {
    flex: 1,
    minHeight: 120,
  },
  dossierContent: {
    flex: 1,
    minHeight: 0,
  },
  contractColumn: {
    minHeight: 0,
    minWidth: 0,
  },
  contractColumnMobile: {
    flex: 0,
    flexShrink: 0,
    maxHeight: '42%',
  },
  contractContent: {
    flex: 1,
    minHeight: 0,
  },
  mobileContractScroll: {
    flexGrow: 1,
  },
});
