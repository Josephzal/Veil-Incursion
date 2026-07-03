import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import DossierCardShell from './hub/DossierCardShell';
import HubScreenShell from './hub/HubScreenShell';
import HackingTerminalOverlay from './shadowWar/HackingTerminalOverlay';
import SectorMapPanel from './veilFront/SectorMapPanel';
import SectorBriefingPanel from './veilFront/SectorBriefingPanel';
import VeilFrontDeployConfirmModal from './veilFront/VeilFrontDeployConfirmModal';
import VeilFrontHeaderSummary from './veilFront/VeilFrontHeader';
import { useVeilFrontLayout } from './veilFront/useVeilFrontLayout';
import { getDossierFactionAccent } from '../data/factions';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useWorldState } from '../context/WorldStateContext';
import { HUB_BORDER_INSET } from '../constants/hubCta';
import type { CabalEmployerId, SectorId } from '../types/worldState';
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
  const { profile } = useTerminal();
  const { account } = usePlayerAccount();
  const {
    sectors,
    persisted,
    setSelectedSectorId,
    setSelectedEmployerCabal,
  } = useWorldState();
  const {
    isTwoColumnShell,
    isDesktop,
    panelGap,
    contentWidth,
    scaleSpacing,
    showHeaderSummary,
    actionPanelWidth,
    cardPadding,
  } = useVeilFrontLayout();
  const [mapViewportHeight, setMapViewportHeight] = useState(0);
  const [deployModalVisible, setDeployModalVisible] = useState(false);

  const dossierAccent = getDossierFactionAccent(account.alignedFaction);
  const activeSector = useMemo(
    () => sectors.find((s) => s.id === persisted.selectedSectorId) ?? sectors[0],
    [sectors, persisted.selectedSectorId],
  );

  const handleSectorPress = useCallback((sectorId: SectorId) => {
    setSelectedSectorId(sectorId);
    const sector = sectors.find((s) => s.id === sectorId);
    if (sector && persisted.selectedEmployerCabal) {
      const sponsorValid = sector.employerPresence?.includes(persisted.selectedEmployerCabal) ?? true;
      if (!sponsorValid) {
        setSelectedEmployerCabal(null);
      }
    }
    onAppendLog(`>> VEIL FRONT — SECTOR SELECTED: ${sectorId.replace(/_/g, ' ')}`);
  }, [
    onAppendLog,
    persisted.selectedEmployerCabal,
    sectors,
    setSelectedEmployerCabal,
    setSelectedSectorId,
  ]);

  const handleMapLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setMapViewportHeight((prev) => (prev === height ? prev : height));
  }, []);

  const handleRequestDeploy = useCallback(() => {
    if (runDisabled || launching) return;
    setDeployModalVisible(true);
  }, [launching, runDisabled]);

  const handleAbortDeploy = useCallback(() => {
    if (launching) return;
    setDeployModalVisible(false);
  }, [launching]);

  const handleContinueDeploy = useCallback(() => {
    const sponsorLine = persisted.selectedEmployerCabal
      ? ` // SPONSOR: ${persisted.selectedEmployerCabal.replace('_', ' ')}`
      : '';
    onAppendLog(`>> BREACH VECTOR LOCKED — ${activeSector.displayName.toUpperCase()}${sponsorLine}`);
    setDeployModalVisible(false);
    onBeginIncursion();
  }, [activeSector.displayName, onAppendLog, onBeginIncursion, persisted.selectedEmployerCabal]);

  const handleSelectEmployer = useCallback((employer: CabalEmployerId | null) => {
    setSelectedEmployerCabal(employer);
  }, [setSelectedEmployerCabal]);

  const body = (
    <View style={styles.stage}>
      <View
        style={[
          styles.contentGrid,
          isTwoColumnShell ? styles.contentGridDesktop : styles.contentGridStacked,
          isDesktop
            ? {
                gap: panelGap,
                flex: 1,
                alignSelf: 'stretch',
                paddingHorizontal: HUB_BORDER_INSET,
                paddingBottom: scaleSpacing(6),
                maxWidth: contentWidth,
                width: contentWidth,
              }
            : { gap: panelGap, flex: 1 },
        ]}
      >
        <DossierCardShell
          fillHeight
          padding={cardPadding}
          accentColor={dossierAccent}
          showAccentStripe
          style={styles.mapPanel}
          contentStyle={styles.mapPanelContent}
        >
          <View style={styles.mapRegion} onLayout={handleMapLayout}>
            <View style={styles.mapLayer}>
              <SectorMapPanel
                theme={theme}
                sectors={sectors}
                activeSectorId={persisted.selectedSectorId}
                onSectorPress={handleSectorPress}
              />
            </View>
            <HackingTerminalOverlay viewportHeight={mapViewportHeight} />
          </View>
        </DossierCardShell>

        <DossierCardShell
          fillHeight
          padding={cardPadding}
          accentColor={dossierAccent}
          style={[
            styles.briefingPanel,
            isTwoColumnShell
              ? { width: actionPanelWidth, maxWidth: actionPanelWidth, flexShrink: 0 }
              : { flex: 1, minHeight: 0 },
          ]}
          contentStyle={styles.briefingContent}
        >
          <SectorBriefingPanel
            theme={theme}
            sector={activeSector}
            selectedEmployer={persisted.selectedEmployerCabal}
            onSelectEmployer={handleSelectEmployer}
            onRequestDeploy={handleRequestDeploy}
            runDisabled={runDisabled}
            launching={launching}
          />
        </DossierCardShell>
      </View>

      <VeilFrontDeployConfirmModal
        visible={deployModalVisible}
        theme={theme}
        profile={profile}
        account={account}
        sector={activeSector}
        selectedEmployer={persisted.selectedEmployerCabal}
        launching={launching}
        onContinue={handleContinueDeploy}
        onAbort={handleAbortDeploy}
      />
    </View>
  );

  return (
    <HubScreenShell
      title="OPERATIONAL BRIEFING"
      subtitle="VEIL FRONT // SECTOR BRIEFING // DEPLOY"
      headerRight={showHeaderSummary ? (
        <VeilFrontHeaderSummary
          theme={theme}
          sector={activeSector}
          selectedEmployer={persisted.selectedEmployerCabal}
        />
      ) : null}
    >
      {body}
    </HubScreenShell>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  contentGrid: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  contentGridDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  contentGridStacked: {
    flexDirection: 'column',
  },
  mapPanel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  mapPanelContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  mapRegion: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  mapLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  briefingPanel: {
    minHeight: 0,
    minWidth: 0,
  },
  briefingContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
});
