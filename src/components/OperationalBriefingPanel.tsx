import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import HubScreenShell from './hub/HubScreenShell';
import HubCommandBar from './hub/HubCommandBar';
import TerminalText from './TerminalText';
import HackingTerminalOverlay from './shadowWar/HackingTerminalOverlay';
import SectorMapPanel from './veilFront/SectorMapPanel';
import SectorBriefingPanel from './veilFront/SectorBriefingPanel';
import VeilFrontDeployConfirmModal from './veilFront/VeilFrontDeployConfirmModal';
import { useVeilFrontLayout } from './veilFront/useVeilFrontLayout';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useWorldState } from '../context/WorldStateContext';
import { DANGER_RED, SELECT_ACCENT } from '../constants/dossierSurface';
import type { SectorId } from '../types/worldState';
import { TerminalTheme } from '../types/theme';
import {
  contractBreachGradeWarning,
  contractSectorWarning,
  getContractSectorCompatibility,
  getSelectedContractForCompatibility,
} from '../utils/contractUi';
import {
  buildSectorMandateBriefing,
  canSectorBeBreached,
} from '../data/sectorAccessMandateEngine';
import { ALL_SECTOR_IDS } from '../data/sectorBiomeBridge';
import { getAccountProgressionProfile } from '../data/progressionDebugEngine';
import {
  contractMeetsBreachGrade,
  formatBreachGradeLabel,
  resolveSelectedBreachGrade,
} from '../data/breachGradeEngine';

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
    panelGap,
    scaleSpacing,
    actionPanelWidth,
  } = useVeilFrontLayout();
  const [mapViewportHeight, setMapViewportHeight] = useState(0);
  const [deployModalVisible, setDeployModalVisible] = useState(false);
  const [breachWindowMs, setBreachWindowMs] = useState(() => {
    const cycle = 3 * 60 * 60 * 1000;
    return cycle - (Date.now() % cycle);
  });

  useEffect(() => {
    const id = setInterval(() => {
      const cycle = 3 * 60 * 60 * 1000;
      setBreachWindowMs(cycle - (Date.now() % cycle));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const breachWindowLabel = useMemo(() => {
    const totalSec = Math.max(0, Math.floor(breachWindowMs / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [breachWindowMs]);

  const progressionProfile = useMemo(
    () => getAccountProgressionProfile(account),
    [account],
  );
  const unlockedSectorIds = useMemo(
    () => ALL_SECTOR_IDS.filter((id) => canSectorBeBreached(progressionProfile, id)),
    [progressionProfile],
  );

  // Keep selection on an unlocked sector if a locked one is persisted.
  useEffect(() => {
    if (unlockedSectorIds.includes(persisted.selectedSectorId)) return;
    const fallback = unlockedSectorIds[0];
    if (fallback) setSelectedSectorId(fallback);
  }, [persisted.selectedSectorId, setSelectedSectorId, unlockedSectorIds]);
  const sectorLockLabels = useMemo(() => {
    const labels: Partial<Record<SectorId, string>> = {};
    ALL_SECTOR_IDS.forEach((id) => {
      if (canSectorBeBreached(progressionProfile, id)) return;
      const briefing = buildSectorMandateBriefing(progressionProfile, id);
      if (briefing.mandateState === 'ACTIVE') {
        labels[id] = 'HUNTING';
      } else if (briefing.mandateState === 'AVAILABLE') {
        labels[id] = 'MANDATE';
      } else {
        labels[id] = 'LOCKED';
      }
    });
    return labels;
  }, [progressionProfile]);
  const selectedContract = persisted.contractBoard.selectedContract;
  const activeSector = useMemo(
    () => sectors.find((s) => s.id === persisted.selectedSectorId) ?? sectors[0],
    [sectors, persisted.selectedSectorId],
  );
  const mandateBriefing = useMemo(
    () => buildSectorMandateBriefing(progressionProfile, activeSector.id),
    [progressionProfile, activeSector.id],
  );
  const sectorUnlocked = mandateBriefing.canBreach;
  const selectedBreachGrade = useMemo(
    () => resolveSelectedBreachGrade(progressionProfile, persisted.selectedBreachGrade),
    [persisted.selectedBreachGrade, progressionProfile],
  );
  const contractMinGrade = selectedContract.kind === 'SPONSOR'
    ? selectedContract.contract.minBreachGrade
    : undefined;
  const gradeMeetsContract = contractMeetsBreachGrade(selectedBreachGrade, contractMinGrade);
  const gradeWarning = contractBreachGradeWarning(selectedBreachGrade, contractMinGrade);

  const sectorCompatibility = useMemo(
    () => getContractSectorCompatibility(
      getSelectedContractForCompatibility(selectedContract),
      activeSector.id,
    ),
    [activeSector.id, selectedContract],
  );

  const handleSectorPress = useCallback((sectorId: SectorId) => {
    if (!unlockedSectorIds.includes(sectorId)) return;
    setSelectedSectorId(sectorId);
    onAppendLog(`>> VEIL FRONT — SECTOR SELECTED: ${sectorId.replace(/_/g, ' ')}`);
  }, [onAppendLog, setSelectedSectorId, unlockedSectorIds]);

  const handleMapLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setMapViewportHeight((prev) => (prev === height ? prev : height));
  }, []);

  const handleRequestDeploy = useCallback(() => {
    if (runDisabled || launching || !sectorUnlocked || !gradeMeetsContract) return;
    setDeployModalVisible(true);
  }, [gradeMeetsContract, launching, runDisabled, sectorUnlocked]);

  const handleAbortDeploy = useCallback(() => {
    if (launching) return;
    setDeployModalVisible(false);
  }, [launching]);

  const handleContinueDeploy = useCallback(() => {
    if (!sectorUnlocked) {
      onAppendLog(`>> BREACH DENIED — ${mandateBriefing.headline}`);
      setDeployModalVisible(false);
      return;
    }
    if (!gradeMeetsContract) {
      onAppendLog(`>> BREACH DENIED — ${gradeWarning ?? 'BREACH GRADE TOO LOW FOR CONTRACT'}`);
      setDeployModalVisible(false);
      return;
    }
    const contractLine = selectedContract.kind === 'SPONSOR'
      ? ` // CONTRACT: ${selectedContract.contract.title.toUpperCase()}`
      : ' // INDEPENDENT BREACH';
    const warning = contractSectorWarning(sectorCompatibility);
    if (warning) {
      onAppendLog(`>> WARNING — ${warning.toUpperCase()}`);
    }
    onAppendLog(
      `>> BREACH VECTOR LOCKED — ${activeSector.displayName.toUpperCase()} // ${formatBreachGradeLabel(selectedBreachGrade, true).toUpperCase()}${contractLine}`,
    );
    setDeployModalVisible(false);
    onBeginIncursion();
  }, [
    activeSector.displayName,
    gradeMeetsContract,
    gradeWarning,
    mandateBriefing.headline,
    onAppendLog,
    onBeginIncursion,
    sectorCompatibility,
    sectorUnlocked,
    selectedBreachGrade,
    selectedContract,
  ]);

  const body = (
    <View style={styles.stage}>
      <View
        style={[
          styles.contentGrid,
          isTwoColumnShell ? styles.contentGridDesktop : styles.contentGridStacked,
          {
            gap: panelGap,
            flex: 1,
            alignSelf: 'stretch',
            width: '100%',
            paddingBottom: scaleSpacing(4),
          },
        ]}
      >
        <View style={[styles.mapPanel, styles.mapPanelContent]}>
          <View style={styles.mapRegion} onLayout={handleMapLayout}>
            <View style={styles.mapLayer}>
              <SectorMapPanel
                theme={theme}
                sectors={sectors}
                activeSectorId={persisted.selectedSectorId}
                onSectorPress={handleSectorPress}
                unlockedSectorIds={unlockedSectorIds}
                sectorLockLabels={sectorLockLabels}
              />
            </View>
            <HackingTerminalOverlay viewportHeight={mapViewportHeight} />
          </View>
        </View>

        <View
          style={[
            styles.briefingPanel,
            {
              borderLeftWidth: isTwoColumnShell ? StyleSheet.hairlineWidth : 0,
              borderLeftColor: 'rgba(255, 255, 255, 0.12)',
            },
            isTwoColumnShell
              ? { width: actionPanelWidth, maxWidth: actionPanelWidth, flexShrink: 0, alignSelf: 'stretch' }
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
        selectedBreachGrade={selectedBreachGrade}
        launching={launching}
        onContinue={handleContinueDeploy}
        onAbort={handleAbortDeploy}
      />
    </View>
  );

  const breachDisabled = runDisabled || launching || !sectorUnlocked || !gradeMeetsContract;
  const gradeLabel = formatBreachGradeLabel(selectedBreachGrade, true).toUpperCase();
  const sectorLabel = activeSector.displayName.toUpperCase();
  const contractConflict = sectorCompatibility === 'UNAVAILABLE';
  const theaterAccent = SELECT_ACCENT;
  const statusTone =
    !sectorUnlocked || !gradeMeetsContract || contractConflict
      ? DANGER_RED
      : theaterAccent;

  let commandStatus = `SECTOR LOCKED / ${sectorLabel} / ${gradeLabel}`;
  let statusTitle: string | undefined;
  let statusDetail: string | undefined;
  if (!sectorUnlocked) {
    statusTitle = 'ACCESS LOCKED';
    statusDetail =
      mandateBriefing.mandate?.summary
      ?? 'Route unknown. Clearance and mandate requirements apply.';
  } else if (!gradeMeetsContract && gradeWarning) {
    statusTitle = 'GRADE CONFLICT';
    statusDetail = gradeWarning;
  } else if (contractConflict) {
    statusTitle = 'CONTRACT CONFLICT';
    statusDetail = 'This sector cannot complete the selected contract. Deployment is still available.';
  }

  return (
    <HubScreenShell
      title="OPERATIONAL THEATER"
      subtitle="VEIL FRONT / SECTOR NETWORK"
      bracketTitle={false}
      subtitleFirst
      theaterChrome
      titleColor="#E8F0EC"
      headerRight={(
        <View style={styles.breachWindow}>
          <TerminalText size={5.2} letterSpacing={1} style={{ color: theaterAccent, fontWeight: '800' }}>
            BREACH WINDOW OPEN
          </TerminalText>
          <TerminalText size={7.2} letterSpacing={1.2} style={{ color: '#E8F0EC', fontWeight: '800', marginTop: 2 }}>
            {breachWindowLabel}
          </TerminalText>
        </View>
      )}
      footer={(
        <HubCommandBar
          statusLabel={commandStatus}
          statusTitle={statusTitle}
          statusDetail={statusDetail}
          statusColor={statusTone}
          actionAccent={theaterAccent}
          prominentAction
          actionLabel={
            launching
              ? '[ DEPLOYING... ]'
              : !sectorUnlocked
                ? '[ ACCESS DENIED ]'
                : !gradeMeetsContract
                  ? '[ GRADE TOO LOW ]'
                  : '[ INITIATE BREACH ]'
          }
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
    alignSelf: 'stretch',
  },
  breachWindow: {
    alignItems: 'flex-end',
  },
});
