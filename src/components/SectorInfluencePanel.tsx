import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FACTION_DEFINITIONS } from '../data/factions';
import { FactionType } from '../types/game';
import { MacroSectorDefinition } from '../types/regional';
import { TerminalTheme } from '../types/theme';

const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

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

interface SectorInfluencePanelProps {
  theme: TerminalTheme;
  sector: MacroSectorDefinition;
  localTrafficDensity: number;
  influence: { TERRAN_GRID: number; LEGION: number; SOLARIS: number };
  isInfluenceFrozen: boolean;
  isWeakLocalSignal: boolean;
  proxyMetropolitanNode: string | null;
}

export default function SectorInfluencePanel({
  theme,
  sector,
  localTrafficDensity,
  influence,
  isInfluenceFrozen,
  isWeakLocalSignal,
  proxyMetropolitanNode,
}: SectorInfluencePanelProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      <View style={[styles.readout, { borderColor: theme.borderColor }]}>
        <Text style={[styles.readoutLine, { color: theme.mutedColor }]}>
          ACTIVE: {sector.label} // NODE: {sector.metropolitanNode}
        </Text>
        <Text style={[styles.readoutLine, { color: theme.statusColor }]}>
          TRAFFIC DENSITY: {localTrafficDensity}%
        </Text>
        {isInfluenceFrozen && (
          <Text style={[styles.readoutLine, { color: theme.primaryColor }]}>
            INFLUENCE ARRAYS FROZEN — SHATTER DECREE ACTIVE
          </Text>
        )}
      </View>

      {isWeakLocalSignal && proxyMetropolitanNode && (
        <View style={[styles.warningOverlay, { borderColor: theme.primaryColor }]}>
          <Text style={[styles.warningTitle, { color: theme.primaryColor }]}>
            WEAK LOCAL SIGNAL
          </Text>
          <Text style={[styles.warningBody, { color: theme.mutedColor }]}>
            Routing to nearest metropolitan node: {proxyMetropolitanNode}
          </Text>
        </View>
      )}

      <View style={styles.influenceBlock}>
        <Text style={[styles.influenceHeader, { color: theme.primaryColor }]}>
          TERRITORIAL INFLUENCE — {sector.label}
        </Text>
        {FACTION_ORDER.map((factionId) => {
          const def = FACTION_DEFINITIONS[factionId];
          const pct = influence[factionId];
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
  root: { marginTop: 0 },
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
