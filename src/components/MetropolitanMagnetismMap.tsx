import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FACTION_DEFINITIONS } from '../data/factions';
import { useMagnetism } from '../hooks/useMagnetism';
import { FactionType } from '../types/game';
import { MacroSectorId } from '../types/regional';
import { TerminalTheme } from '../types/theme';

const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

interface MetropolitanMagnetismMapProps {
  homeSectorId: MacroSectorId;
  theme: TerminalTheme;
  isInfluenceFrozen: boolean;
  frozenInfluence: { TERRAN_GRID: number; LEGION: number; SOLARIS: number } | null;
  onProxyReroute: (line: string) => void;
  onSectorChange?: (id: MacroSectorId) => void;
}

function InfluenceMeter({
  label,
  pct,
  color,
  borderColor,
}: {
  label: string;
  pct: number;
  color: string;
  borderColor: string;
}) {
  return (
    <View style={styles.meterRow}>
      <Text style={[styles.meterLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.meterTrack, { borderColor }]}>
        <View style={[styles.meterFill, { backgroundColor: color, width: `${pct}%` }]} />
      </View>
      <Text style={[styles.meterPct, { color }]}>{pct}%</Text>
    </View>
  );
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

  return (
    <View style={[styles.panel, { borderColor: theme.borderColor, borderWidth: theme.borderWidth, borderStyle: theme.borderStyle }]}>
      <Text style={[styles.title, { color: theme.primaryColor }]}>
        METROPOLITAN HUB // CONTINENTAL MAGNETISM
      </Text>
      <Text style={[styles.sub, { color: theme.mutedColor }]}>
        5 MACRO-SECTORS // CABal INFLUENCE TELEMETRY
      </Text>

      <View style={styles.sectorGrid}>
        {magnetism.allSectors.map((sector) => {
          const active = sector.id === magnetism.activeSectorId;
          return (
            <Pressable
              key={sector.id}
              onPress={() => {
                magnetism.selectSector(sector.id);
                onSectorChange?.(sector.id);
              }}
              style={[
                styles.sectorCell,
                {
                  borderColor: active ? theme.statusColor : theme.borderColor,
                  borderWidth: active ? theme.borderWidth + 1 : 1,
                  backgroundColor: active ? `${theme.primaryColor}11` : 'transparent',
                },
              ]}
            >
              <Text style={[styles.sectorLabel, { color: active ? theme.statusColor : theme.mutedColor }]}>
                {sector.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.readout, { borderColor: theme.borderColor }]}>
        <Text style={[styles.readoutLine, { color: theme.mutedColor }]}>
          ACTIVE: {sectorDef.label} // NODE: {sectorDef.metropolitanNode}
        </Text>
        <Text style={[styles.readoutLine, { color: theme.statusColor }]}>
          TRAFFIC DENSITY: {magnetism.localTrafficDensity}%
        </Text>
        {isInfluenceFrozen && (
          <Text style={[styles.readoutLine, { color: theme.primaryColor }]}>
            INFLUENCE ARRAYS FROZEN — SHATTER DECREE ACTIVE
          </Text>
        )}
      </View>

      {magnetism.isWeakLocalSignal && magnetism.proxyMetropolitanNode && (
        <View style={[styles.warningOverlay, { borderColor: theme.primaryColor }]}>
          <Text style={[styles.warningTitle, { color: theme.primaryColor }]}>
            WEAK LOCAL SIGNAL
          </Text>
          <Text style={[styles.warningBody, { color: theme.mutedColor }]}>
            Routing to nearest metropolitan node: {magnetism.proxyMetropolitanNode}
          </Text>
        </View>
      )}

      <View style={styles.influenceBlock}>
        <Text style={[styles.influenceHeader, { color: theme.primaryColor }]}>
          TERRITORIAL INFLUENCE — {sectorDef.label}
        </Text>
        {FACTION_ORDER.map((factionId) => {
          const def = FACTION_DEFINITIONS[factionId];
          const pct = magnetism.influence[factionId];
          return (
            <InfluenceMeter
              key={factionId}
              label={def.displayName}
              pct={pct}
              color={def.accentColor}
              borderColor={theme.borderColor}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 12, marginBottom: 12 },
  title: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  sub: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.5, marginBottom: 10 },
  sectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  sectorCell: {
    width: '48%',
    minHeight: 44,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectorLabel: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', letterSpacing: 0.6, textAlign: 'center' },
  readout: { borderWidth: 1, padding: 8, marginBottom: 8, minHeight: 56 },
  readoutLine: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.4, lineHeight: 13, marginBottom: 2 },
  warningOverlay: {
    borderWidth: 2,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#0a0b0f',
    minHeight: 52,
  },
  warningTitle: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  warningBody: { fontFamily: 'monospace', fontSize: 8, lineHeight: 12 },
  influenceBlock: { marginTop: 4 },
  influenceHeader: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  meterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  meterLabel: { fontFamily: 'monospace', fontSize: 7, width: 72 },
  meterTrack: { flex: 1, height: 8, borderWidth: 1, padding: 1 },
  meterFill: { height: '100%' },
  meterPct: { fontFamily: 'monospace', fontSize: 8, width: 32, textAlign: 'right' },
});
