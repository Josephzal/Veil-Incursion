import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import { FACTION_DEFINITIONS } from '../data/factions';
import { useWorldState } from '../context/WorldStateContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useTerminalNav } from '../context/TerminalNavContext';
import OperationalBriefingPanel from '../components/OperationalBriefingPanel';
import BlackMarketHubPanel from '../components/hub/BlackMarketHubPanel';
import LoadoutHubPanel from '../components/hub/LoadoutHubPanel';
import DevTestHubPanel from '../components/hub/DevTestHubPanel';
import TerminalHubLayout from '../components/layout/TerminalHubLayout';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { resolveBreachTransitionColor } from '../constants/breachTransitionColors';
import { transitionActions } from '../stores/transitionStore';
import type { FactionType } from '../types/game';

const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

export default function OverworldHubScreen(): React.JSX.Element {
  const { theme, updateCabalAlignment, alignment } = useTerminal();
  const { terminalView, setTerminalView } = useTerminalNav();
  const {
    account,
    isHydrated,
    commitFactionAlignment,
    appendHubLog,
    commitDescentLoadout,
  } = usePlayerAccount();
  const { buildRunContextForDescent, isHydrated: worldStateHydrated } = useWorldState();
  const { startBoundRequisition } = useGameFlow();
  const { startNewRun } = useRun();
  const [launchingIncursion, setLaunchingIncursion] = useState(false);

  const needsFactionSelection = account.alignedFaction === null;

  useEffect(() => {
    if (!account.alignedFaction || account.alignedFaction === alignment) return;
    updateCabalAlignment(account.alignedFaction);
  }, [account.alignedFaction, alignment, updateCabalAlignment]);

  const handleInitiateDeepDive = useCallback(() => {
    if (needsFactionSelection || launchingIncursion) return;
    setLaunchingIncursion(true);
    const breachColor = resolveBreachTransitionColor(account.alignedFaction);
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
        alignedFaction: account.alignedFaction,
        initialCargo,
        runGenerationContext,
        runModifiers,
        startingVeilResidueBalance: account.veilResidueBalance,
      });
      startBoundRequisition();
      setLaunchingIncursion(false);
    });
  }, [
    account,
    appendHubLog,
    buildRunContextForDescent,
    commitDescentLoadout,
    launchingIncursion,
    needsFactionSelection,
    startBoundRequisition,
    startNewRun,
  ]);

  const handleSelectFaction = (faction: FactionType) => {
    commitFactionAlignment(faction);
    updateCabalAlignment(faction);
  };

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
              runDisabled={needsFactionSelection || launchingIncursion}
              launching={launchingIncursion}
            />
          )}
          {terminalView === 'BLACK_MARKET' && <BlackMarketHubPanel />}
          {terminalView === 'LOADOUT' && <LoadoutHubPanel />}
          {terminalView === 'TEST' && <DevTestHubPanel />}
        </TerminalHubLayout>

        {needsFactionSelection && (
          <View style={styles.factionOverlay}>
            <View
              style={[
                styles.factionModal,
                { borderColor: theme.borderColor, backgroundColor: theme.backgroundColor },
              ]}
            >
              <Text style={[styles.factionModalTitle, { color: theme.primaryColor }]}>CABAL ALIGNMENT MATRIX</Text>
              <Text style={[styles.factionModalSub, { color: theme.mutedColor }]}>
                Select allegiance to unlock Loadout prep, Veil Front briefing, and incursion access.
              </Text>
              {FACTION_ORDER.map((factionId) => {
                const def = FACTION_DEFINITIONS[factionId];
                return (
                  <HapticPressable
                    key={factionId}
                    onPress={() => handleSelectFaction(factionId)}
                    style={({ pressed }) => [
                      styles.factionBlock,
                      { borderColor: def.borderColor, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text style={[styles.factionName, { color: theme.textColor }]}>[{def.displayName}]</Text>
                    <Text style={[styles.factionTagline, { color: theme.mutedColor }]}>{def.tagline}</Text>
                  </HapticPressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  viewport: { flex: 1, minHeight: 0, padding: 0 },
  factionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  factionModal: { borderWidth: 2, padding: 16 },
  factionModalTitle: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textAlign: 'center', marginBottom: 8 },
  factionModalSub: { fontFamily: 'monospace', fontSize: 9, textAlign: 'center', lineHeight: 14, marginBottom: 14 },
  factionBlock: { borderWidth: 1, padding: 12, marginBottom: 8 },
  factionName: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  factionTagline: { fontFamily: 'monospace', fontSize: 8, lineHeight: 12 },
});
