import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FACTION_DEFINITIONS } from '../data/factions';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useTerminal } from '../context/TerminalContext';
import { useTerminalNav } from '../context/TerminalNavContext';
import IdentificationBadgeView from '../components/IdentificationBadgeView';
import InventoryManifestPanel from '../components/InventoryManifestPanel';
import TerminalNavHeader from '../components/TerminalNavHeader';
import TerminalSafeArea from '../components/TerminalSafeArea';
import ShadowWarDashboard from '../components/ShadowWarDashboard';
import { useShadowWar } from '../context/ShadowWarContext';
import type { FactionType } from '../types/game';

const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

export default function OverworldHubScreen(): React.JSX.Element {
  const { theme, profile, updateCabalAlignment, alignment } = useTerminal();
  const { terminalView, setTerminalView } = useTerminalNav();
  const { account, isHydrated, hubLog, commitFactionAlignment, appendHubLog, addCredits, depositResourceStash } =
    usePlayerAccount();
  const { refreshCycleIfNeeded, isHydrated: shadowWarHydrated } = useShadowWar();
  const { startSafehouseHub } = useGameFlow();

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

  const handleInitiateDeepDive = () => {
    if (needsFactionSelection) return;
    appendHubLog('>> SAFEHOUSE ACCESS GRANTED — STAGE LOADOUT BEFORE DESCENT.');
    startSafehouseHub();
  };

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
        <View style={styles.gridBackdrop} pointerEvents="none">
          {Array.from({ length: 8 }).map((_, row) => (
            <View key={`g-${row}`} style={styles.gridRow}>
              {Array.from({ length: 4 }).map((__, col) => (
                <View key={`c-${row}-${col}`} style={[styles.gridCell, { borderColor: `${theme.borderColor}33` }]} />
              ))}
            </View>
          ))}
        </View>

        <TerminalNavHeader activeView={terminalView} onSelectView={setTerminalView} />

        <View style={styles.viewport}>
          {terminalView === 'BADGE' && (
            <IdentificationBadgeView theme={theme} profile={profile} account={account} />
          )}
          {terminalView === 'MAP' && (
            <ShadowWarDashboard
              theme={theme}
              hubLog={hubLog}
              runDisabled={needsFactionSelection}
              onInitiateDeepDive={handleInitiateDeepDive}
              onAppendLog={appendHubLog}
            />
          )}
          {terminalView === 'MANIFEST' && <InventoryManifestPanel />}
        </View>

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
                Select allegiance to unlock deep-dive scanning and asset manifest access.
              </Text>
              {FACTION_ORDER.map((factionId) => {
                const def = FACTION_DEFINITIONS[factionId];
                return (
                  <Pressable
                    key={factionId}
                    onPress={() => handleSelectFaction(factionId)}
                    style={({ pressed }) => [
                      styles.factionBlock,
                      { borderColor: def.borderColor, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text style={[styles.factionName, { color: theme.textColor }]}>[{def.displayName}]</Text>
                    <Text style={[styles.factionTagline, { color: theme.mutedColor }]}>{def.tagline}</Text>
                  </Pressable>
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
  gridBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.2 },
  gridRow: { flex: 1, flexDirection: 'row' },
  gridCell: { flex: 1, borderWidth: 0.5 },
  viewport: { flex: 1, paddingHorizontal: 16, paddingTop: 12, zIndex: 1 },
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
