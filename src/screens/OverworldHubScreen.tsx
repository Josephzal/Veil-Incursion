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
import DevTestHubPanel from '../components/hub/DevTestHubPanel';
import TerminalHubLayout from '../components/layout/TerminalHubLayout';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { transitionActions } from '../stores/transitionStore';

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
  const { startBoundRequisition } = useGameFlow();
  const { startNewRun } = useRun();
  const [launchingIncursion, setLaunchingIncursion] = useState(false);

  const breachFaction = account.alignedFaction ?? 'TERRAN_GRID';

  useEffect(() => {
    if (breachFaction === alignment) return;
    updateCabalAlignment(breachFaction);
  }, [alignment, breachFaction, updateCabalAlignment]);

  const handleInitiateDeepDive = useCallback(() => {
    if (launchingIncursion) return;
    setLaunchingIncursion(true);

    // Prepare destination before the 1s Veil transit begins — swap stays instantaneous under cover.
    const { cargo: initialCargo, runItems: initialRunItems } = commitDescentLoadout();
    const { runGenerationContext, runModifiers, runWorldBrief } = buildRunContextForDescent();
    const weaponProgression = {
      weaponUnlocks: account.weaponUnlocks,
      weaponTiers: account.weaponTiers,
      equippedWeaponByClass: account.equippedWeaponByClass,
    };
    const weaponSnapshot = snapshotWeaponForRun(account.activeClass, weaponProgression);
    appendHubLog('>> DESCENT LOADOUT LOCKED — CARGO MANIFEST COMMITTED TO RUN STATE.');
    appendHubLog('>> RUN ITEM SLOTS LOCKED — TACTICAL MANIFEST COMMITTED.');
    appendHubLog(`>> WEAPON LINK LOCKED — ${weaponSnapshot.activeWeaponFamilyId.replace(/-/g, ' ').toUpperCase()} TIER ${weaponSnapshot.activeWeaponTier}.`);
    appendHubLog(`>> VEIL FRONT BREACH — ${runGenerationContext.sectorState.displayName.toUpperCase()} // ${runGenerationContext.activeOperation.title.toUpperCase()} // GRADE ${runGenerationContext.breachGrade}`);

    const runPayload = {
      factionPerks: account.factionPerks,
      unlockedBiomes: account.unlockedBiomes,
      aegisLoadout: account.aegisLoadout,
      hexShotLoadout: account.hexShotLoadout,
      envoyLoadout: account.envoyLoadout,
      activeClass: account.activeClass,
      alignedFaction: breachFaction,
      initialCargo,
      initialRunItems,
      runGenerationContext,
      runWorldBrief,
      runModifiers,
      startingVeilResidueBalance: account.veilResidueBalance,
      equippedKeepsakeId: account.equippedKeepsakeId,
      keepsakeDeployment: account.keepsakeDeployment,
      activeWeaponFamilyId: weaponSnapshot.activeWeaponFamilyId,
      activeWeaponTier: weaponSnapshot.activeWeaponTier,
    };

    const started = transitionActions.startBreaching({ x: 0.5, y: 0.5 }, () => {
      startNewRun(runPayload);
      startBoundRequisition();
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
    startBoundRequisition,
    startNewRun,
  ]);

  if (!isHydrated || !worldStateHydrated) {
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
      <View style={styles.root}>
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
