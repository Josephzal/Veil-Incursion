import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
      <Text style={[styles.meterLabel, { color }]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { backgroundColor: color, width: `${Math.min(100, pct)}%` }]} />
      </View>
      <Text style={[styles.meterPct, { color }]} numberOfLines={1}>
        {`${pct}%`}
      </Text>
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.rootContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.readoutRow}>
        <View style={styles.readout}>
          <Text style={[styles.readoutLine, { color: theme.mutedColor }]} numberOfLines={1}>
            {`SECTOR: ${sector.label.toUpperCase()} // TOTAL IP: ${control.totalIp}`}
          </Text>
          <Text style={[styles.readoutLine, { color: statusColor }]} numberOfLines={1}>
            {`STATUS: ${statusLabel}`}
          </Text>
          <Text style={[styles.readoutLine, { color: theme.primaryColor }]} numberOfLines={2}>
            {`BUFF: ${sector.buffSummary.toUpperCase()}`}
          </Text>
          <Text style={[styles.readoutLine, { color: theme.mutedColor }]} numberOfLines={1}>
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
        <Text
          style={[hubTerminalUi.sectionHeader, styles.influenceHeader, { color: theme.mutedColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {formatBracketHeader(`TERRITORIAL INFLUENCE — ${sector.label}`)}
        </Text>
        {FACTION_ORDER.map((factionId) => {
          const def = FACTION_DEFINITIONS[factionId];
          const pct = control.displayInfluence[factionId];
          const rawIp = sectorIp[factionId];
          return (
            <View key={factionId} style={styles.factionBlock}>
              <InfluenceMeter label={def.displayName} pct={pct} color={def.accentColor} />
              <Text style={[styles.ipLine, { color: theme.mutedColor }]} numberOfLines={1}>
                {`${rawIp} IP`}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  rootContent: { flexGrow: 1, paddingBottom: 4 },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
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
    minWidth: 64,
    alignItems: 'center',
  },
  readoutLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.3,
    lineHeight: 11,
  },
  influenceBlock: { flexShrink: 0 },
  influenceHeader: { marginBottom: 6 },
  factionBlock: {
    marginBottom: 2,
    width: '100%',
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  meterLabel: {
    fontFamily: 'monospace',
    fontSize: 6,
    width: 58,
    flexShrink: 0,
  },
  meterTrack: {
    flex: 1,
    minWidth: 0,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  meterFill: { height: '100%' },
  meterPct: {
    fontFamily: 'monospace',
    fontSize: 6,
    width: 22,
    flexShrink: 0,
    textAlign: 'right',
  },
  ipLine: {
    fontFamily: 'monospace',
    fontSize: 6,
    marginBottom: 3,
    marginLeft: 62,
  },
});
