import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMagnetism } from '../hooks/useMagnetism';
import {
  formatBracketHeader,
  hubTerminalUi,
  HUB_DATA_DIVIDER,
} from '../styles/hubTerminalUi';
import { MacroSectorId } from '../types/regional';
import { TerminalTheme } from '../types/theme';
import SectorInfluencePanel from './SectorInfluencePanel';
import WorldMagnetismMap from './WorldMagnetismMap';

interface MetropolitanMagnetismMapProps {
  homeSectorId: MacroSectorId;
  theme: TerminalTheme;
  isInfluenceFrozen: boolean;
  frozenInfluence: { TERRAN_GRID: number; LEGION: number; SOLARIS: number } | null;
  onProxyReroute: (line: string) => void;
  onSectorChange?: (id: MacroSectorId) => void;
}

export default function MetropolitanMagnetismMap({
  homeSectorId,
  theme,
  isInfluenceFrozen,
  frozenInfluence,
  onProxyReroute,
  onSectorChange,
}: MetropolitanMagnetismMapProps): React.JSX.Element {
  const magnetism = useMagnetism(homeSectorId, isInfluenceFrozen, frozenInfluence);
  const sectorDef = magnetism.allSectors.find((s) => s.id === magnetism.activeSectorId)!;

  useEffect(() => {
    if (!magnetism.isWeakLocalSignal || !magnetism.proxyMetropolitanNode) return;
    onProxyReroute(
      `>> WEAK LOCAL SIGNAL — ROUTING TO NEAREST METROPOLITAN NODE: ${magnetism.proxyMetropolitanNode}`,
    );
  }, [magnetism.isWeakLocalSignal, magnetism.proxyMetropolitanNode, magnetism.activeSectorId, onProxyReroute]);

  const handleSectorPress = (id: MacroSectorId) => {
    magnetism.selectSector(id);
    onSectorChange?.(id);
  };

  return (
    <View style={styles.panel}>
      <Text style={[hubTerminalUi.sectionHeaderLg, styles.title, { color: theme.mutedColor }]}>
        {formatBracketHeader('VECTOR WORLD MAP // CONTINENTAL MAGNETISM')}
      </Text>
      <Text style={[styles.sub, { color: theme.mutedColor }]}>
        20 GLOBAL MACRO-SECTORS // LOW-POLY WORLD MAP // FACTION CONTROL
      </Text>

      <WorldMagnetismMap
        theme={theme}
        sectors={magnetism.allSectors}
        activeSectorId={magnetism.activeSectorId}
        homeSectorId={homeSectorId}
        isInfluenceFrozen={isInfluenceFrozen}
        frozenInfluence={frozenInfluence}
        isWeakLocalSignal={magnetism.isWeakLocalSignal}
        proxyMetropolitanNode={magnetism.proxyMetropolitanNode}
        onSectorPress={handleSectorPress}
        expandedDetailPanel={
          <SectorInfluencePanel
            theme={theme}
            sector={sectorDef}
            localTrafficDensity={magnetism.localTrafficDensity}
            influence={magnetism.influence}
            isInfluenceFrozen={isInfluenceFrozen}
          />
        }
      />

      <SectorInfluencePanel
        theme={theme}
        sector={sectorDef}
        localTrafficDensity={magnetism.localTrafficDensity}
        influence={magnetism.influence}
        isInfluenceFrozen={isInfluenceFrozen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: HUB_DATA_DIVIDER,
  },
  title: { marginBottom: 4 },
  sub: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.5, marginBottom: 10 },
});
