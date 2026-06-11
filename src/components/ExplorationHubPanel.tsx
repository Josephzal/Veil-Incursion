import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EXPLORATION_HUB_GRAPH } from '../data/explorationHubGraph';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import SectorOverworldMap from './SectorOverworldMap';
import type { ScannerCabal } from '../types/scanner';

/** Badge-screen exploration corridor — walkable terrain without nodes, hazards, or resonance. */
export default function ExplorationHubPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const cabal: ScannerCabal = account.alignedFaction ?? 'TERRAN_GRID';

  const layoutRollKey = useMemo(() => `hub-${account.operativeRank}`, [account.operativeRank]);

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
        mapStatusText="METROPOLITAN HUB // EXPLORATION CORRIDOR // NO ACTIVE VECTORS"
      />
      <Text style={[styles.caption, { color: theme.mutedColor }]}>
        JOYSTICK TO SCOUT // LEY SIGNATURES OFFLINE
      </Text>
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
});
