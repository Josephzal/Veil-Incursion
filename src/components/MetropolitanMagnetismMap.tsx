import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMagnetism } from '../hooks/useMagnetism';
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
    <View style={[styles.panel, { borderColor: theme.borderColor, borderWidth: theme.borderWidth, borderStyle: theme.borderStyle }]}>
      <Text style={[styles.title, { color: theme.primaryColor }]}>
        VECTOR WORLD MAP // CONTINENTAL MAGNETISM
      </Text>
      <Text style={[styles.sub, { color: theme.mutedColor }]}>
        5 MACRO-SECTORS // LOW-POLY WORLD MAP // FACTION CONTROL
      </Text>

      <WorldMagnetismMap
        theme={theme}
        sectors={magnetism.allSectors}
        activeSectorId={magnetism.activeSectorId}
        homeSectorId={homeSectorId}
        isInfluenceFrozen={isInfluenceFrozen}
        frozenInfluence={frozenInfluence}
        onSectorPress={handleSectorPress}
      />

      <SectorInfluencePanel
        theme={theme}
        sector={sectorDef}
        localTrafficDensity={magnetism.localTrafficDensity}
        influence={magnetism.influence}
        isInfluenceFrozen={isInfluenceFrozen}
        isWeakLocalSignal={magnetism.isWeakLocalSignal}
        proxyMetropolitanNode={magnetism.proxyMetropolitanNode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 12, marginBottom: 12 },
  title: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  sub: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.5, marginBottom: 10 },
});
