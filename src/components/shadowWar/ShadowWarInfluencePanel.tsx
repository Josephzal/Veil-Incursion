import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import TacticalButton from '../TacticalButton';
import { FACTION_DEFINITIONS } from '../../data/factions';
import { calculateSectorControl } from '../../data/shadowWarEngine';
import { getShadowWarSector } from '../../data/shadowWarSectors';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { HUB_BORDER_INSET, hubCtaButtonStyle } from '../../constants/hubCta';
import { formatBracketHeader, HUB_DATA_DIVIDER } from '../../styles/hubTerminalUi';
import { FactionType } from '../../types/game';
import type { CabalIpPool, ShadowWarSectorId } from '../../types/shadowWar';
import { TerminalTheme } from '../../types/theme';
import { SHADOW_WAR_FACTION_VISUAL } from '../../utils/sectorInfluenceVisual';

const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

function InfluenceMeter({
  label,
  pct,
  barColor,
  rawIp,
  isDesktop,
  scaleSize,
  scaleSpacing,
  mutedColor,
}: {
  label: string;
  pct: number;
  barColor: string;
  rawIp: number;
  isDesktop: boolean;
  scaleSize: (value: number) => number;
  scaleSpacing: (value: number) => number;
  mutedColor: string;
}) {
  const barHeight = isDesktop ? scaleSize(28) : scaleSize(5);
  const clampedPct = Math.min(100, Math.max(0, pct));

  return (
    <View style={[styles.meterBlock, { marginBottom: scaleSpacing(isDesktop ? 10 : 2) }]}>
      <TerminalText
        variant="caption"
        letterSpacing={0.6}
        style={{ color: barColor, marginBottom: scaleSpacing(isDesktop ? 4 : 2) }}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </TerminalText>
      <View style={[styles.meterTrack, { height: barHeight }]}>
        <View
          style={[
            styles.meterFill,
            {
              backgroundColor: barColor,
              width: `${clampedPct}%`,
              minWidth: clampedPct > 0 ? scaleSize(isDesktop ? 36 : 8) : 0,
            },
          ]}
        >
          {isDesktop && clampedPct >= 12 ? (
            <TerminalText variant="body" letterSpacing={0.5} style={styles.meterPctInside}>
              {`${clampedPct}%`}
            </TerminalText>
          ) : null}
        </View>
        {(!isDesktop || clampedPct < 12) ? (
          <TerminalText
            variant={isDesktop ? 'body' : 'micro'}
            style={[
              styles.meterPctEdge,
              {
                color: barColor,
                right: scaleSpacing(4),
              },
            ]}
          >
            {`${clampedPct}%`}
          </TerminalText>
        ) : null}
      </View>
      <TerminalText
        variant="micro"
        style={{ color: mutedColor, marginTop: scaleSpacing(2), marginLeft: scaleSpacing(isDesktop ? 2 : 0) }}
        numberOfLines={1}
      >
        {`${rawIp} IP`}
      </TerminalText>
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
  const { account } = usePlayerAccount();
  const { isDesktop, scaleSize, scaleSpacing } = useHubLayout();

  const sector = getShadowWarSector(sectorId);
  const control = calculateSectorControl(sectorIp);
  const statusColor = control.status === 'CONTESTED' ? '#ef4444' : theme.statusColor;
  const statusLabel = control.status === 'CONTESTED'
    ? '[ CONTESTED ]'
    : `[ SECURED — ${control.controllingFaction?.replace('_', ' ') ?? 'NONE'} ]`;
  const ctaAccent = account.alignedFaction
    ? FACTION_DEFINITIONS[account.alignedFaction].accentColor
    : theme.statusColor;

  const readout = (
    <View style={[styles.readout, { gap: scaleSpacing(isDesktop ? 6 : 2) }]}>
      <TerminalText variant="display" letterSpacing={0.5} style={{ color: theme.textColor }} numberOfLines={1}>
        {sector.label.toUpperCase()}
      </TerminalText>
      <TerminalText variant="caption" style={{ color: theme.mutedColor }} numberOfLines={1}>
        {`TOTAL IP: ${control.totalIp}`}
      </TerminalText>
      <TerminalText variant="body" style={{ color: statusColor }} numberOfLines={1}>
        {`STATUS: ${statusLabel}`}
      </TerminalText>
      <TerminalText variant="caption" style={{ color: theme.primaryColor }} numberOfLines={isDesktop ? 3 : 2}>
        {`BUFF: ${sector.buffSummary.toUpperCase()}`}
      </TerminalText>
      <TerminalText variant="caption" style={{ color: theme.mutedColor }} numberOfLines={1}>
        {`YOUR WEEKLY DONATION: ${weeklyDonatedIP} IP`}
      </TerminalText>
    </View>
  );

  const influenceBlock = (
    <View style={styles.influenceBlock}>
      <TerminalText
        variant="section"
        letterSpacing={1.1}
        style={[
          styles.influenceHeader,
          { color: theme.mutedColor, marginBottom: scaleSpacing(isDesktop ? 12 : 6) },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {formatBracketHeader(`TERRITORIAL INFLUENCE — ${sector.label}`)}
      </TerminalText>
      {FACTION_ORDER.map((factionId) => {
        const def = FACTION_DEFINITIONS[factionId];
        const pct = control.displayInfluence[factionId];
        const rawIp = sectorIp[factionId];
        const barColor = SHADOW_WAR_FACTION_VISUAL[factionId].bar;
        return (
          <InfluenceMeter
            key={factionId}
            label={def.displayName}
            pct={pct}
            barColor={barColor}
            rawIp={rawIp}
            isDesktop={isDesktop}
            scaleSize={scaleSize}
            scaleSpacing={scaleSpacing}
            mutedColor={theme.mutedColor}
          />
        );
      })}
    </View>
  );

  const donateButton = onDonatePress ? (
    <TacticalButton
      label="[ DEPLOY RESOURCES ]"
      active
      onPress={onDonatePress}
      accentColor={ctaAccent}
      mutedColor={theme.mutedColor}
      variant="cta"
      style={hubCtaButtonStyle(ctaAccent, scaleSize, scaleSpacing)}
    />
  ) : null;

  if (isDesktop) {
    return (
      <View style={styles.desktopColumn}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scaleSpacing(8) }]}
          showsVerticalScrollIndicator={false}
        >
          {readout}
          <View style={[styles.divider, { borderBottomColor: HUB_DATA_DIVIDER, marginVertical: scaleSpacing(12) }]} />
          {influenceBlock}
        </ScrollView>
        {donateButton ? (
          <View style={styles.dropSection}>
            {donateButton}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {readout}
      <View style={[styles.divider, { borderBottomColor: HUB_DATA_DIVIDER }]} />
      {influenceBlock}
      {donateButton}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  desktopColumn: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'space-between',
    gap: 12,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  readout: {
    flexShrink: 0,
  },
  divider: {
    borderBottomWidth: 1,
    marginVertical: 6,
  },
  influenceBlock: {
    flexShrink: 0,
  },
  influenceHeader: {
    fontWeight: '800',
  },
  meterBlock: {
    width: '100%',
  },
  meterTrack: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  meterFill: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  meterPctInside: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  meterPctEdge: {
    position: 'absolute',
    fontWeight: '700',
  },
  deployBtn: {
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  dropSection: {
    gap: 6,
    flexShrink: 0,
    paddingHorizontal: HUB_BORDER_INSET,
    overflow: 'visible',
  },
});
