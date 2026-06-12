import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import CraftingMenuPanel from './CraftingMenuPanel';
import { EXPLORATION_HUB_GRAPH } from '../data/explorationHubGraph';
import { HUB_CRAFTING_BENCH } from '../data/hubInteractables';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import SectorOverworldMap from './SectorOverworldMap';
import type { ScannerCabal } from '../types/scanner';

/** Badge-screen exploration corridor with hub fabrication bench. */
export default function ExplorationHubPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const cabal: ScannerCabal = account.alignedFaction ?? 'TERRAN_GRID';
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [nearBench, setNearBench] = useState(false);

  const layoutRollKey = useMemo(() => `hub-${account.operativeRank}`, [account.operativeRank]);

  if (craftingOpen) {
    return (
      <View style={styles.root}>
        <CraftingMenuPanel onClose={() => setCraftingOpen(false)} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SectorOverworldMap
        hubMode
        graph={EXPLORATION_HUB_GRAPH}
        currentNodeId={EXPLORATION_HUB_GRAPH.entryId}
        encounterPath={[]}
        focusedNodeIds={[]}
        cluster={[]}
        cabal={cabal}
        layoutRollKey={layoutRollKey}
        mapStatusText="METROPOLITAN HUB // EXPLORATION CORRIDOR // FABRICATION BENCH ONLINE"
        hubInteractables={[HUB_CRAFTING_BENCH]}
        onNearHubInteractable={(id) => setNearBench(id === HUB_CRAFTING_BENCH.id)}
        onHubInteractablePress={(id) => {
          if (id === HUB_CRAFTING_BENCH.id) setCraftingOpen(true);
        }}
      />
      {nearBench ? (
        <Pressable
          onPress={() => setCraftingOpen(true)}
          style={[styles.promptBtn, { borderColor: theme.statusColor }]}
        >
          <Text style={[styles.promptText, { color: theme.statusColor }]}>
            {HUB_CRAFTING_BENCH.prompt}
          </Text>
        </Pressable>
      ) : (
        <Text style={[styles.caption, { color: theme.mutedColor }]}>
          JOYSTICK TO SCOUT // APPROACH FABRICATION BENCH TO CRAFT
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 280,
    gap: 6,
  },
  caption: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
    textAlign: 'center',
    paddingBottom: 4,
  },
  promptBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 4,
    backgroundColor: '#050608',
  },
  promptText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
