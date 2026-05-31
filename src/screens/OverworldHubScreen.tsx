import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FACTION_DEFINITIONS } from '../data/factions';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRegionalShatter } from '../context/RegionalShatterContext';
import { useRun } from '../context/RunContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useTerminal } from '../context/TerminalContext';
import IdentificationBadgeView from '../components/IdentificationBadgeView';
import VectorMapDashboard from '../components/VectorMapDashboard';
import { FactionType } from '../types/game';
import { MacroSectorId } from '../types/regional';

type HubSegment = 'BADGE' | 'MAP';

const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

export default function OverworldHubScreen(): React.JSX.Element {
  const { theme, profile, updateCabalAlignment, alignment } = useTerminal();
  const { account, isHydrated, hubLog, commitFactionAlignment, appendHubLog, setMetropolitanNode } =
    usePlayerAccount();
  const { isInfluenceFrozen, frozenInfluence } = useRegionalShatter();
  const { startNewRun } = useRun();
  const { startScanning, openInventoryManifest } = useGameFlow();

  const [segment, setSegment] = useState<HubSegment>('BADGE');
  const [activeMagnetSector, setActiveMagnetSector] = useState<MacroSectorId>(
    account.regionalPresence.homeMacroSector,
  );
  const lastProxyLogRef = useRef<string | null>(null);

  const needsFactionSelection = account.alignedFaction === null;

  useEffect(() => {
    if (!account.alignedFaction || account.alignedFaction === alignment) return;
    updateCabalAlignment(account.alignedFaction);
  }, [account.alignedFaction, alignment, updateCabalAlignment]);

  const handleInitiateDeepDive = () => {
    if (needsFactionSelection) return;
    appendHubLog('>> DEEP-DIVE SCAN AUTHORIZED — PROCEDURAL VECTOR CLOUD INITIALIZING.');
    startNewRun({
      factionPerks: account.factionPerks,
      unlockedBiomes: account.unlockedBiomes,
    });
    startScanning();
  };

  const handleSelectFaction = (faction: FactionType) => {
    commitFactionAlignment(faction);
    updateCabalAlignment(faction);
  };

  const handleProxyReroute = useCallback(
    (line: string) => {
      if (lastProxyLogRef.current === line) return;
      lastProxyLogRef.current = line;
      appendHubLog(line);
      const node = line.split(': ').pop();
      if (node) setMetropolitanNode(node, activeMagnetSector);
    },
    [appendHubLog, setMetropolitanNode, activeMagnetSector],
  );

  if (!isHydrated) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator color={theme.statusColor} />
        <Text style={[styles.loadingText, { color: theme.mutedColor }]}>LOADING OPERATIVE ACCOUNT...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.gridBackdrop, { opacity: 0.2 }]} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, row) => (
          <View key={`g-${row}`} style={styles.gridRow}>
            {Array.from({ length: 4 }).map((__, col) => (
              <View key={`c-${row}-${col}`} style={[styles.gridCell, { borderColor: `${theme.borderColor}33` }]} />
            ))}
          </View>
        ))}
      </View>

      <View style={[styles.commandBar, { borderBottomColor: theme.borderColor, borderBottomWidth: theme.borderWidth }]}>
        <Text style={[styles.commandTitle, { color: theme.mutedColor }]}>MAIN TERMINAL // BADGE / MAP DASHBOARD</Text>

        <View style={styles.segmentRow}>
          {(['BADGE', 'MAP'] as HubSegment[]).map((key) => {
            const active = segment === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSegment(key)}
                style={[
                  styles.segmentBtn,
                  {
                    borderColor: active ? theme.statusColor : theme.borderColor,
                    borderWidth: active ? theme.borderWidth + 1 : 1,
                    backgroundColor: active ? `${theme.primaryColor}14` : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.segmentText, { color: active ? theme.statusColor : theme.mutedColor }]}>
                  {key === 'BADGE' ? 'IDENTIFICATION BADGE' : 'VECTOR MAP'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={openInventoryManifest}
          style={[styles.manifestBtn, { borderColor: theme.borderColor }]}
        >
          <Text style={[styles.manifestBtnText, { color: theme.primaryColor }]}>[ OPEN ASSET MANIFEST ]</Text>
        </Pressable>
      </View>

      <View style={styles.viewport}>
        {segment === 'BADGE' ? (
          <IdentificationBadgeView theme={theme} profile={profile} account={account} />
        ) : (
          <VectorMapDashboard
            theme={theme}
            homeSectorId={account.regionalPresence.homeMacroSector}
            activeMagnetSector={activeMagnetSector}
            isInfluenceFrozen={isInfluenceFrozen}
            frozenInfluence={frozenInfluence}
            hubLog={hubLog}
            runDisabled={needsFactionSelection}
            onSectorChange={(id) => {
              setActiveMagnetSector(id);
              lastProxyLogRef.current = null;
            }}
            onProxyReroute={handleProxyReroute}
            onInitiateDeepDive={handleInitiateDeepDive}
          />
        )}
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  gridBackdrop: { ...StyleSheet.absoluteFillObject },
  gridRow: { flex: 1, flexDirection: 'row' },
  gridCell: { flex: 1, borderWidth: 0.5 },
  commandBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, zIndex: 2 },
  commandTitle: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1.2, textAlign: 'center', marginBottom: 10 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', letterSpacing: 0.6, textAlign: 'center' },
  manifestBtn: { borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  manifestBtnText: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
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
