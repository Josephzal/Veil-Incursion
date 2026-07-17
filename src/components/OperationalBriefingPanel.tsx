import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import DossierCardShell from './hub/DossierCardShell';
import HubScreenShell from './hub/HubScreenShell';
import HubCommandBar from './hub/HubCommandBar';
import HackingTerminalOverlay from './shadowWar/HackingTerminalOverlay';
import SectorMapPanel from './veilFront/SectorMapPanel';
import SectorBriefingPanel from './veilFront/SectorBriefingPanel';
import VeilFrontDeployConfirmModal from './veilFront/VeilFrontDeployConfirmModal';
import { useVeilFrontLayout } from './veilFront/useVeilFrontLayout';
import { getDossierFactionAccent } from '../data/factions';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useWorldState } from '../context/WorldStateContext';
import { HUB_BORDER_INSET } from '../constants/hubCta';
import { SELECT_ACCENT, DANGER_RED } from '../constants/dossierSurface';
import type { SectorId } from '../types/worldState';
import { TerminalTheme } from '../types/theme';
import {
  contractSectorWarning,
  getContractSectorCompatibility,
  getSelectedContractForCompatibility,
} from '../utils/contractUi';

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
  } = useWorldState();
  const {
    isTwoColumnShell,
    isDesktop,
    panelGap,
    contentWidth,
    scaleSpacing,
    actionPanelWidth,
    cardPadding,
  } = useVeilFrontLayout();
  const [mapViewportHeight, setMapViewportHeight] = useState(0);
  const [deployModalVisible, setDeployModalVisible] = useState(false);

  const dossierAccent = getDossierFactionAccent(account.alignedFaction);
  const selectedContract = persisted.contractBoard.selectedContract;
  const activeSector = useMemo(
    () => sectors.find((s) => s.id === persisted.selectedSectorId) ?? sectors[0],
    [sectors, persisted.selectedSectorId],
  );

  const sectorCompatibility = useMemo(
    () => getContractSectorCompatibility(
      getSelectedContractForCompatibility(selectedContract),
      activeSector.id,
    ),
    [activeSector.id, selectedContract],
  );

  const handleSectorPress = useCallback((sectorId: SectorId) => {
    setSelectedSectorId(sectorId);
    onAppendLog(`>> VEIL FRONT — SECTOR SELECTED: ${sectorId.replace(/_/g, ' ')}`);
  }, [onAppendLog, setSelectedSectorId]);

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
    const contractLine = selectedContract.kind === 'SPONSOR'
      ? ` // CONTRACT: ${selectedContract.contract.title.toUpperCase()}`
      : ' // INDEPENDENT BREACH';
    const warning = contractSectorWarning(sectorCompatibility);
    if (warning) {
      onAppendLog(`>> WARNING — ${warning.toUpperCase()}`);
    }
    onAppendLog(`>> BREACH VECTOR LOCKED — ${activeSector.displayName.toUpperCase()}${contractLine}`);
    setDeployModalVisible(false);
    onBeginIncursion();
  }, [activeSector.displayName, onAppendLog, onBeginIncursion, sectorCompatibility, selectedContract]);

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

        <View
          style={[
            styles.briefingPanel,
            { padding: cardPadding },
            isTwoColumnShell
              ? { width: actionPanelWidth, maxWidth: actionPanelWidth, flexShrink: 0 }
              : { flex: 1, minHeight: 0 },
          ]}
        >
          <SectorBriefingPanel
            theme={theme}
            sector={activeSector}
            selectedContract={selectedContract}
            sectorCompatibility={sectorCompatibility}
          />
        </View>
      </View>

      <VeilFrontDeployConfirmModal
        visible={deployModalVisible}
        theme={theme}
        profile={profile}
        account={account}
        sector={activeSector}
        selectedContract={selectedContract}
        sectorCompatibility={sectorCompatibility}
        launching={launching}
        onContinue={handleContinueDeploy}
        onAbort={handleAbortDeploy}
      />
    </View>
  );

  const breachDisabled = runDisabled || launching;
  const sectorWarning = contractSectorWarning(sectorCompatibility);
  const commandStatus = sectorWarning
    ? `SECTOR SELECTED: ${activeSector.displayName.toUpperCase()} // ${sectorWarning.toUpperCase()}`
    : `SECTOR SELECTED: ${activeSector.displayName.toUpperCase()}`;

  return (
    <HubScreenShell
      title="OPERATIONAL BRIEFING"
      subtitle="VEIL FRONT // SECTOR BRIEFING // DEPLOY"
      footer={(
        <HubCommandBar
          statusLabel={commandStatus}
          statusColor={sectorCompatibility === 'UNAVAILABLE' ? DANGER_RED : SELECT_ACCENT}
          actionLabel={launching ? '[ DEPLOYING... ]' : '[ INITIATE BREACH ]'}
          onAction={handleRequestDeploy}
          actionDisabled={breachDisabled}
        />
      )}
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
    overflow: 'hidden',
  },
});
