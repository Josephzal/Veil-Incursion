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
import DevTestHubPanel from '../components/hub/DevTestHubPanel';
import TerminalHubLayout from '../components/layout/TerminalHubLayout';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { resolveBreachTransitionColor } from '../constants/breachTransitionColors';
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
    const breachColor = resolveBreachTransitionColor(breachFaction);
    transitionActions.startBreaching(breachColor, () => {
      const initialCargo = commitDescentLoadout();
      const { runGenerationContext, runModifiers } = buildRunContextForDescent();
      appendHubLog('>> DESCENT LOADOUT LOCKED — CARGO MANIFEST COMMITTED TO RUN STATE.');
      appendHubLog(`>> VEIL FRONT BREACH — ${runGenerationContext.sectorState.displayName.toUpperCase()} // ${runGenerationContext.activeOperation.title.toUpperCase()}`);
      startNewRun({
        factionPerks: account.factionPerks,
        unlockedBiomes: account.unlockedBiomes,
        aegisLoadout: account.aegisLoadout,
        hexShotLoadout: account.hexShotLoadout,
        envoyLoadout: account.envoyLoadout,
        activeClass: account.activeClass,
        alignedFaction: breachFaction,
        initialCargo,
        runGenerationContext,
        runModifiers,
        startingVeilResidueBalance: account.veilResidueBalance,
        equippedKeepsakeId: account.equippedKeepsakeId,
      });
      startBoundRequisition();
      setLaunchingIncursion(false);
    });
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
