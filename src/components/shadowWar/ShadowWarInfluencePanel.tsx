import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { FACTION_DEFINITIONS } from '../../data/factions';
import { calculateSectorControl } from '../../data/shadowWarEngine';
import { getShadowWarSector } from '../../data/shadowWarSectors';
import {
  formatBracketHeader,
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
  hubTerminalUi,
  HUB_DATA_DIVIDER,
} from '../../styles/hubTerminalUi';
import { FactionType } from '../../types/game';
import type { CabalIpPool, ShadowWarSectorId } from '../../types/shadowWar';
import { TerminalTheme } from '../../types/theme';

const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];
const DONATE_AMBER = '#d4a574';

function InfluenceMeter({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <View style={styles.meterRow}>
      <Text style={[styles.meterLabel, { color }]} numberOfLines={1}>{label}</Text>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { backgroundColor: color, width: `${Math.min(100, pct)}%` }]} />
      </View>
      <Text style={[styles.meterPct, { color }]}>{pct}%</Text>
    </View>
  );
}

interface ShadowWarInfluencePanelProps {
  theme: TerminalTheme;
  sectorId: ShadowWarSectorId;
  sectorIp: CabalIpPool;
  weeklyDonatedIP: number;
  onDonatePress?: () => void;
}

export default function ShadowWarInfluencePanel({
  theme,
  sectorId,
  sectorIp,
  weeklyDonatedIP,
  onDonatePress,
}: ShadowWarInfluencePanelProps): React.JSX.Element {
  const sector = getShadowWarSector(sectorId);
  const control = calculateSectorControl(sectorIp);
  const statusColor = control.status === 'CONTESTED' ? '#ef4444' : theme.statusColor;
  const statusLabel = control.status === 'CONTESTED'
    ? '[ CONTESTED ]'
    : `[ SECURED — ${control.controllingFaction?.replace('_', ' ') ?? 'NONE'} ]`;

  return (
    <View style={styles.root}>
      <View style={styles.readoutRow}>
        <View style={styles.readout}>
          <Text style={[styles.readoutLine, { color: theme.mutedColor }]}>
            {`SECTOR: ${sector.label.toUpperCase()} // TOTAL IP: ${control.totalIp}`}
          </Text>
          <Text style={[styles.readoutLine, { color: statusColor }]}>
            {`STATUS: ${statusLabel}`}
          </Text>
          <Text style={[styles.readoutLine, { color: theme.primaryColor }]}>
            {`BUFF: ${sector.buffSummary.toUpperCase()}`}
          </Text>
          <Text style={[styles.readoutLine, { color: theme.mutedColor }]}>
            {`YOUR WEEKLY DONATION: ${weeklyDonatedIP} IP`}
          </Text>
        </View>
        {onDonatePress ? (
          <HapticPressable
            onPress={onDonatePress}
            style={({ pressed }) => [
              getInteractiveButtonStyle(DONATE_AMBER, { pressed, size: 'sm' }),
              styles.donateBtn,
            ]}
          >
            <Text style={[getInteractiveButtonTextStyle('sm'), { color: DONATE_AMBER }]}>
              [ DONATE ]
            </Text>
          </HapticPressable>
        ) : null}
      </View>

      <View style={styles.influenceBlock}>
        <Text style={[hubTerminalUi.sectionHeader, styles.influenceHeader, { color: theme.mutedColor }]}>
          {formatBracketHeader(`TERRITORIAL INFLUENCE — ${sector.label}`)}
        </Text>
        {FACTION_ORDER.map((factionId) => {
          const def = FACTION_DEFINITIONS[factionId];
          const pct = control.displayInfluence[factionId];
          const rawIp = sectorIp[factionId];
          return (
            <View key={factionId}>
              <InfluenceMeter label={def.displayName} pct={pct} color={def.accentColor} />
              <Text style={[styles.ipLine, { color: theme.mutedColor }]}>{`${rawIp} IP`}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: HUB_DATA_DIVIDER,
    paddingBottom: 6,
  },
  readout: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  donateBtn: {
    flexShrink: 0,
    minWidth: 72,
    alignItems: 'center',
  },
  readoutLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.3,
    lineHeight: 11,
  },
  influenceBlock: { flex: 1, minHeight: 0 },
  influenceHeader: { marginBottom: 6 },
  meterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 6 },
  meterLabel: { fontFamily: 'monospace', fontSize: 6, width: 64 },
  meterTrack: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  meterFill: { height: '100%' },
  meterPct: { fontFamily: 'monospace', fontSize: 7, width: 28, textAlign: 'right' },
  ipLine: { fontFamily: 'monospace', fontSize: 6, marginBottom: 4, marginLeft: 70 },
});
