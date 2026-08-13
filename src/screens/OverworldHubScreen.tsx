import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useWorldState } from '../context/WorldStateContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useTerminalNav } from '../context/TerminalNavContext';
import OperationalBriefingPanel from '../components/OperationalBriefingPanel';
import ContractBoardPanel from '../components/hub/ContractBoardPanel';
import BlackMarketHubPanel from '../components/hub/BlackMarketHubPanel';
import LoadoutHubPanel from '../components/hub/LoadoutHubPanel';
import { snapshotWeaponForRun } from '../data/weaponRunState';
import { canDeployWithRequisition } from '../data/requisitionAccountNormalize';
import DevTestHubPanel from '../components/hub/DevTestHubPanel';
import TerminalHubLayout from '../components/layout/TerminalHubLayout';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { transitionActions } from '../stores/transitionStore';
import { ensureHubBgmPlaying, unlockBgm } from '../utils/bgmController';

export default function OverworldHubScreen(): React.JSX.Element {
  const { theme, updateCabalAlignment, alignment } = useTerminal();
  const { terminalView, setTerminalView } = useTerminalNav();
  const {
    account,
    isHydrated,
    appendHubLog,
    commitDescentLoadout,
  } = usePlayerAccount();
  const { buildRunContextForDescent, isHydrated: worldStateHydrated } = useWorldState();
  const { startScanning } = useGameFlow();
  const { startNewRun } = useRun();
  const [launchingIncursion, setLaunchingIncursion] = useState(false);

  const breachFaction = account.alignedFaction ?? 'TERRAN_GRID';
  const hubReady = isHydrated && worldStateHydrated;

  useEffect(() => {
    if (breachFaction === alignment) return;
    updateCabalAlignment(breachFaction);
  }, [alignment, breachFaction, updateCabalAlignment]);

  // Veil Front visible — kick hub music immediately (and keep retrying via controller watchdog).
  useEffect(() => {
    if (!hubReady) return;
    ensureHubBgmPlaying();
  }, [hubReady]);

  const handleHubPointer = useCallback(() => {
    ensureHubBgmPlaying(400);
  }, []);

  const handleInitiateDeepDive = useCallback(() => {
    if (launchingIncursion) return;
    if (!canDeployWithRequisition(account)) {
      appendHubLog(
        '>> DESCENT BLOCKED — SELECT ONE EXPEDITION REQUISITION IN LOADOUT.',
      );
      setTerminalView('LOADOUT');
      return;
    }
    setLaunchingIncursion(true);
    unlockBgm();

    // Prepare destination before transit; persistent supply stock commits only
    // after the transition accepts the deployment.
    const { runGenerationContext, runModifiers, runWorldBrief } = buildRunContextForDescent();
    const weaponProgression = {
      weaponUnlocks: account.weaponUnlocks,
      equippedWeaponByClass: account.equippedWeaponByClass,
    };
    const weaponSnapshot = snapshotWeaponForRun(account.activeClass, weaponProgression);
    const runPayloadBase = {
      factionPerks: account.factionPerks,
      unlockedBiomes: account.unlockedBiomes,
      aegisTechniqueLoadout: account.aegisTechniqueLoadout,
      hexShotLoadout: account.hexShotLoadout,
      envoyLoadout: account.envoyLoadout,
      activeClass: account.activeClass,
      alignedFaction: breachFaction,
      runGenerationContext,
      runWorldBrief,
      runModifiers,
      startingVeilResidueBalance: account.veilResidueBalance,
      equippedRequisitionId: account.equippedRequisitionId,
      requisitionDeployment: account.requisitionDeployment,
      activeWeaponFamilyId: weaponSnapshot.activeWeaponFamilyId,
    };

    const started = transitionActions.startBreaching({ x: 0.5, y: 0.5 }, () => {
      const committed = commitDescentLoadout();
      if (!committed) {
        appendHubLog('>> DESCENT BLOCKED — PACKED SUPPLY STOCK CHANGED. REVIEW CARGO.');
        setLaunchingIncursion(false);
        return;
      }
      appendHubLog('>> DESCENT LOADOUT LOCKED — CARGO AND SUPPLIES COMMITTED.');
      appendHubLog(`>> WEAPON LINK LOCKED — ${weaponSnapshot.activeWeaponFamilyId.replace(/-/g, ' ').toUpperCase()}.`);
      appendHubLog(`>> VEIL FRONT BREACH — ${runGenerationContext.sectorState.displayName.toUpperCase()} // ${runGenerationContext.activeOperation.title.toUpperCase()} // GRADE ${runGenerationContext.breachGrade}`);
      if (startNewRun({ ...runPayloadBase, initialCargo: committed.cargo })) {
        startScanning();
      }
      setLaunchingIncursion(false);
    });
    if (!started) {
      setLaunchingIncursion(false);
    }
  }, [
    account,
    appendHubLog,
    breachFaction,
    buildRunContextForDescent,
    commitDescentLoadout,
    launchingIncursion,
    startScanning,
    startNewRun,
    setTerminalView,
  ]);

  if (!hubReady) {
    return (
      <TerminalSafeArea>
        <View style={styles.loadingRoot}>
          <ActivityIndicator color={theme.statusColor} />
          <Text style={[styles.loadingText, { color: theme.mutedColor }]}>LOADING OPERATIVE ACCOUNT...</Text>
        </View>
      </TerminalSafeArea>
    );
  }

  return (
    <TerminalSafeArea>
      <View
        style={styles.root}
        onTouchStart={handleHubPointer}
        {...({ onClick: handleHubPointer } as object)}
      >
        <TerminalHubLayout
          activeView={terminalView}
          onSelectView={setTerminalView}
          mainStyle={styles.viewport}
        >
          {terminalView === 'MAP' && (
            <OperationalBriefingPanel
              theme={theme}
              onAppendLog={appendHubLog}
              onBeginIncursion={handleInitiateDeepDive}
              runDisabled={launchingIncursion}
              launching={launchingIncursion}
            />
          )}
          {terminalView === 'CONTRACTS' && <ContractBoardPanel />}
          {terminalView === 'BLACK_MARKET' && <BlackMarketHubPanel />}
          {terminalView === 'LOADOUT' && <LoadoutHubPanel />}
          {terminalView === 'TEST' && <DevTestHubPanel />}
        </TerminalHubLayout>
      </View>
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  viewport: { flex: 1, minHeight: 0, padding: 0 },
});
