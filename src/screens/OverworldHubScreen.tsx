import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import { FACTION_DEFINITIONS } from '../data/factions';
import { shadowWarBuffsToRunModifiers } from '../data/shadowWarBuffEngine';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useTerminalNav } from '../context/TerminalNavContext';
import { useShadowWar } from '../context/ShadowWarContext';
import IdentificationBadgeView from '../components/IdentificationBadgeView';
import SafehouseHubPanel from '../components/safehouse/SafehouseHubPanel';
import TerminalHubLayout from '../components/layout/TerminalHubLayout';
import TerminalSafeArea from '../components/TerminalSafeArea';
import ShadowWarDashboard from '../components/ShadowWarDashboard';
import IncursionPrepPanel from '../components/hub/IncursionPrepPanel';
import DevTestHubPanel from '../components/hub/DevTestHubPanel';
import type { FactionType } from '../types/game';

const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

export default function OverworldHubScreen(): React.JSX.Element {
  const { theme, profile, updateCabalAlignment, alignment } = useTerminal();
  const { terminalView, setTerminalView } = useTerminalNav();
  const {
    account,
    isHydrated,
    commitFactionAlignment,
    appendHubLog,
    addCredits,
    depositResourceStash,
    commitDescentLoadout,
  } = usePlayerAccount();
  const { refreshCycleIfNeeded, isHydrated: shadowWarHydrated, activeBuffs } = useShadowWar();
  const { startBoundRequisition } = useGameFlow();
  const { startNewRun } = useRun();
  const [launchingIncursion, setLaunchingIncursion] = useState(false);

  const needsFactionSelection = account.alignedFaction === null;

  useEffect(() => {
    if (!isHydrated || !shadowWarHydrated) return;
    refreshCycleIfNeeded(account.alignedFaction).then((result) => {
      result.logs.forEach((line) => appendHubLog(line));
      if (result.creditGrant > 0) addCredits(result.creditGrant);
      Object.entries(result.resourceGrants).forEach(([id, qty]) => {
        if (qty && qty > 0) {
          depositResourceStash({ [id as import('../types/resourceItem').ResourceItemId]: qty });
        }
      });
    });
  }, [
    isHydrated,
    shadowWarHydrated,
    account.alignedFaction,
    refreshCycleIfNeeded,
    appendHubLog,
    addCredits,
    depositResourceStash,
  ]);

  useEffect(() => {
    if (!account.alignedFaction || account.alignedFaction === alignment) return;
    updateCabalAlignment(account.alignedFaction);
  }, [account.alignedFaction, alignment, updateCabalAlignment]);

  const handleInitiateDeepDive = useCallback(() => {
    if (needsFactionSelection || launchingIncursion) return;
    setLaunchingIncursion(true);
    const initialCargo = commitDescentLoadout();
    const shadowWarBuffs = shadowWarBuffsToRunModifiers(activeBuffs);
    appendHubLog('>> DESCENT LOADOUT LOCKED — CARGO MANIFEST COMMITTED TO RUN STATE.');
    startNewRun({
      factionPerks: account.factionPerks,
      unlockedBiomes: account.unlockedBiomes,
      aegisLoadout: account.aegisLoadout,
      hexShotLoadout: account.hexShotLoadout,
      envoyLoadout: account.envoyLoadout,
      activeClass: account.activeClass,
      alignedFaction: account.alignedFaction,
      initialCargo,
      shadowWarBuffs,
    });
    startBoundRequisition();
    setLaunchingIncursion(false);
  }, [
    account,
    activeBuffs,
    appendHubLog,
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

  if (!isHydrated) {
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
          {terminalView === 'BADGE' && (
            <IdentificationBadgeView theme={theme} profile={profile} account={account} />
          )}
          {terminalView === 'MAP' && (
            <ShadowWarDashboard
              theme={theme}
              onAppendLog={appendHubLog}
            />
          )}
          {terminalView === 'SAFEHOUSE' && <SafehouseHubPanel />}
          {terminalView === 'INCURSION' && (
            <IncursionPrepPanel
              theme={theme}
              account={account}
              runDisabled={needsFactionSelection || launchingIncursion}
              launching={launchingIncursion}
              onBeginIncursion={handleInitiateDeepDive}
            />
          )}
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
                Select allegiance to unlock Safehouse prep, Shadow War donations, and incursion access.
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
