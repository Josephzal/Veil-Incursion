import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import { FACTION_DEFINITIONS } from '../../data/factions';
import { formatBracketHeader, HUB_DATA_DIVIDER } from '../../styles/hubTerminalUi';
import type { CabalEmployerId, SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import {
  describeEmployerPerks,
  employerSponsorLabel,
} from '../../utils/employerContractUi';
import { viewShadow } from '../../utils/adaptiveStyles';

interface SponsorDeploymentPanelProps {
  theme: TerminalTheme;
  sector: SectorState;
  selectedEmployer: CabalEmployerId | null;
  onSelectEmployer: (employer: CabalEmployerId | null) => void;
  onRequestDeploy: () => void;
  runDisabled: boolean;
  launching: boolean;
}

const ALL_EMPLOYERS: CabalEmployerId[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

function InitiateBreachButton({
  label,
  accentColor,
  mutedColor,
  disabled,
  onPress,
}: {
  label: string;
  accentColor: string;
  mutedColor: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { scaleSpacing, scaleSize } = useVeilFrontLayout();

  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.breachButton,
        {
          borderColor: accentColor,
          backgroundColor: `${accentColor}28`,
          paddingVertical: scaleSpacing(12),
          paddingHorizontal: scaleSpacing(12),
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          minHeight: scaleSize(44),
          ...viewShadow({
            color: accentColor,
            opacity: disabled ? 0.2 : 0.75,
            radius: 16,
            offset: { width: 0, height: 0 },
          }),
        },
      ]}
    >
      <TerminalText
        size={9}
        lineHeight={12}
        letterSpacing={1.2}
        style={{ color: disabled ? mutedColor : accentColor, fontWeight: '800', textAlign: 'center' }}
        numberOfLines={1}
      >
        {label}
      </TerminalText>
    </HapticPressable>
  );
}

export default function SponsorDeploymentPanel({
  theme,
  sector,
  selectedEmployer,
  onSelectEmployer,
  onRequestDeploy,
  runDisabled,
  launching,
}: SponsorDeploymentPanelProps): React.JSX.Element {
  const { scaleSpacing, isTwoColumnShell } = useVeilFrontLayout();
  const canLaunch = !runDisabled && !launching;
  const availableEmployers = ALL_EMPLOYERS.filter(
    (id) => sector.employerPresence?.includes(id) ?? true,
  );
  const deployLabel = launching
    ? '[ DEPLOYING... ]'
    : isTwoColumnShell
      ? '[ INITIATE BREACH ]'
      : '[ DEPLOY ]';

  return (
    <View style={styles.root}>
      <TerminalText
        variant="section"
        letterSpacing={1}
        style={{ color: theme.statusColor, marginBottom: scaleSpacing(10) }}
      >
        {formatBracketHeader('Sponsor Package')}
      </TerminalText>

      <View style={[styles.cardList, styles.cardListContent, { gap: scaleSpacing(8) }]}>
        <SponsorCard
          title="NO SPONSOR"
          perks={[]}
          isSelected={selectedEmployer === null}
          accentColor={theme.statusColor}
          textColor={theme.textColor}
          onPress={() => onSelectEmployer(null)}
        />

        {availableEmployers.map((employerId) => {
          const def = FACTION_DEFINITIONS[employerId];
          const isSelected = selectedEmployer === employerId;
          const perks = describeEmployerPerks(employerId);

          return (
            <SponsorCard
              key={employerId}
              title={employerSponsorLabel(employerId).toUpperCase()}
              perks={perks}
              isSelected={isSelected}
              accentColor={def.accentColor}
              textColor={theme.textColor}
              onPress={() => onSelectEmployer(employerId)}
            />
          );
        })}
      </View>

      <View style={{ marginTop: scaleSpacing(10) }}>
        <InitiateBreachButton
          label={deployLabel}
          accentColor={theme.statusColor}
          mutedColor={theme.mutedColor}
          disabled={!canLaunch}
          onPress={onRequestDeploy}
        />
      </View>
    </View>
  );
}

function SponsorCard({
  title,
  perks,
  isSelected,
  accentColor,
  textColor,
  onPress,
}: {
  title: string;
  perks: string[];
  isSelected: boolean;
  accentColor: string;
  textColor: string;
  onPress: () => void;
}) {
  const { scaleSpacing } = useVeilFrontLayout();

  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sponsorCard,
        {
          borderColor: isSelected ? accentColor : HUB_DATA_DIVIDER,
          backgroundColor: isSelected ? `${accentColor}14` : 'rgba(15, 23, 42, 0.35)',
          padding: scaleSpacing(10),
          opacity: pressed ? 0.9 : 1,
          ...(isSelected
            ? viewShadow({
              color: accentColor,
              opacity: 0.45,
              radius: 12,
              offset: { width: 0, height: 0 },
            })
            : {}),
        },
      ]}
    >
      <View style={styles.sponsorHeader}>
        <TerminalText variant="caption" letterSpacing={0.5} style={{ color: isSelected ? accentColor : textColor, flex: 1 }} numberOfLines={2}>
          {title}
        </TerminalText>
      </View>
      {perks.length > 0 ? (
        <View style={[styles.perkRow, { gap: scaleSpacing(4), marginTop: scaleSpacing(6), flexWrap: 'wrap' }]}>
          {perks.map((perk) => (
            <View key={perk} style={[styles.perkChip, { borderColor: `${accentColor}44` }]}>
              <TerminalText variant="micro" style={{ color: textColor }} numberOfLines={1}>
                {perk}
              </TerminalText>
            </View>
          ))}
        </View>
      ) : null}
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  cardList: {
    flex: 1,
    minHeight: 0,
  },
  cardListContent: {
    flexGrow: 1,
  },
  sponsorCard: {
    borderWidth: 1,
    minWidth: 0,
    ...Platform.select({
      web: { cursor: 'pointer' as const },
      default: {},
    }),
  },
  sponsorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
  },
  perkRow: {
    flexDirection: 'row',
  },
  perkChip: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    maxWidth: '100%',
  },
  breachButton: {
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
