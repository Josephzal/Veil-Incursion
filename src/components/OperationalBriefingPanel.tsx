import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import TerminalText from './TerminalText';
import VeilTerminalEffects from './atmosphere/VeilTerminalEffects';
import SectorMapPanel from './veilFront/SectorMapPanel';
import SectorBriefingPanel from './veilFront/SectorBriefingPanel';
import VeilFrontDeployConfirmModal from './veilFront/VeilFrontDeployConfirmModal';
import { useVeilFrontLayout } from './veilFront/useVeilFrontLayout';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useWorldState } from '../context/WorldStateContext';
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

/** Matches prior shell bottom inset so dossier top/bottom edge padding stay equal. */
const DOSSIER_EDGE_PAD = 12;

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
    actionPanelWidth,
    scaleSpacing,
  } = useVeilFrontLayout();
  const [mapViewportHeight, setMapViewportHeight] = useState(0);
  const [deployModalVisible, setDeployModalVisible] = useState(false);

  const progressionProfile = useMemo(
    () => getAccountProgressionProfile(account),
    [account],
  );
  const unlockedSectorIds = useMemo(
    () => ALL_SECTOR_IDS.filter((id) => canSectorBeBreached(progressionProfile, id)),
    [progressionProfile],
  );

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
    setSelectedSectorId(sectorId);
    onAppendLog(`>> VEIL FRONT — SECTOR SELECTED: ${sectorId.replace(/_/g, ' ')}`);
  }, [onAppendLog, setSelectedSectorId]);

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

  const breachDisabled = runDisabled || launching || !sectorUnlocked || !gradeMeetsContract;
  const edgePad = scaleSpacing(DOSSIER_EDGE_PAD);

  return (
    <View style={styles.stage}>
      <View
        style={[
          styles.contentGrid,
          isTwoColumnShell ? styles.contentGridDesktop : styles.contentGridStacked,
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
            <VeilTerminalEffects viewportHeight={mapViewportHeight} intensity="subtle" />
            <View style={[styles.mapTitle, { top: edgePad, left: edgePad }]} pointerEvents="none">
              <TerminalText
                size={7.5}
                letterSpacing={0.8}
                style={styles.mapSubtitle}
              >
                VEIL FRONT / SECTOR NETWORK
              </TerminalText>
              <TerminalText
                size={13.5}
                letterSpacing={0.8}
                style={styles.mapHeading}
              >
                SELECT INCURSION ZONE
              </TerminalText>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.briefingColumn,
            isTwoColumnShell
              ? {
                  width: actionPanelWidth + edgePad,
                  maxWidth: actionPanelWidth + edgePad,
                  flexShrink: 0,
                }
              : { flex: 1, minHeight: 0 },
            {
              paddingTop: edgePad,
              paddingBottom: edgePad,
              paddingRight: edgePad,
            },
          ]}
        >
          <View
            style={[
              styles.briefingPanel,
              isTwoColumnShell ? { width: actionPanelWidth, maxWidth: actionPanelWidth } : null,
            ]}
          >
            <SectorBriefingPanel
              theme={theme}
              sector={activeSector}
              selectedContract={selectedContract}
              sectorCompatibility={sectorCompatibility}
              sectorUnlocked={sectorUnlocked}
              breachDisabled={breachDisabled}
              launching={launching}
              gradeMeetsContract={gradeMeetsContract}
              gradeWarning={gradeWarning}
              onRequestDeploy={handleRequestDeploy}
            />
          </View>
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
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#010304',
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
    backgroundColor: '#000000',
  },
  mapLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  mapTitle: {
    position: 'absolute',
    zIndex: 3,
    maxWidth: '70%',
  },
  mapSubtitle: {
    color: 'rgba(148, 163, 184, 0.75)',
    fontWeight: '700',
  },
  mapHeading: {
    marginTop: 4,
    color: '#E8F0EC',
    fontWeight: '800',
  },
  briefingColumn: {
    minHeight: 0,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  briefingPanel: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
});
