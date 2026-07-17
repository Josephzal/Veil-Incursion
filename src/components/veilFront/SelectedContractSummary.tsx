import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import { FACTION_DEFINITIONS } from '../../data/factions';
import type { SelectedContractState } from '../../types/contract';
import { TerminalTheme } from '../../types/theme';
import {
  formatContractRewardSummary,
  formatContractContextTag,
  sponsorDisplayName,
} from '../../utils/contractUi';
import { describeEmployerPerks } from '../../utils/employerContractUi';
import { formatContractCargoDeliveryHints } from '../../data/cargoRoutingIntelEngine';
import { isResourceContractObjective } from '../../data/contractResolver';
import { SPONSOR_IDENTITY } from '../../utils/sponsorIdentity';

interface SelectedContractSummaryProps {
  theme: TerminalTheme;
  selectedContract: SelectedContractState;
}

export default function SelectedContractSummary({
  theme,
  selectedContract,
}: SelectedContractSummaryProps): React.JSX.Element {
  const { scaleFont, scaleSpacing, scaleSize } = useVeilFrontLayout();

  if (selectedContract.kind === 'INDEPENDENT') {
    return (
      <View style={[styles.body, { gap: scaleSpacing(8) }]}>
        <TerminalText size={scaleFont(6)} letterSpacing={0.7} style={{ color: theme.statusColor, fontWeight: '700' }}>
          SELECTED CONTRACT
        </TerminalText>
        <TerminalText size={scaleFont(8)} style={{ color: theme.textColor, fontWeight: '800' }}>
          Independent Breach
        </TerminalText>
        <TerminalText size={scaleFont(6.5)} style={{ color: theme.mutedColor, lineHeight: scaleSize(11) }}>
          No sponsor objective. Select a contract on the Contract Board to take sponsor work.
        </TerminalText>
      </View>
    );
  }

  const contract = selectedContract.contract;
  const sponsorAccent = FACTION_DEFINITIONS[contract.sponsorId].accentColor;
  const identity = SPONSOR_IDENTITY[contract.sponsorId];
  const perks = describeEmployerPerks(contract.sponsorId);
  const cargoDeliveryHints = isResourceContractObjective(contract.objectiveKind)
    ? formatContractCargoDeliveryHints(contract)
    : [];

  return (
    <View style={[styles.body, { gap: scaleSpacing(8) }]}>
      <View style={styles.sealRow}>
        <TerminalText size={scaleFont(6)} letterSpacing={0.7} style={{ color: sponsorAccent, fontWeight: '700' }}>
          SELECTED CONTRACT
        </TerminalText>
        <View style={[styles.seal, { borderColor: sponsorAccent }]}>
          <TerminalText size={scaleFont(5.2)} letterSpacing={0.8} style={{ color: sponsorAccent, fontWeight: '800' }}>
            {identity.sealLabel}
          </TerminalText>
        </View>
      </View>
      <TerminalText size={scaleFont(6.5)} style={{ color: theme.mutedColor }}>
        {`${identity.emblem}  ${sponsorDisplayName(contract.sponsorId).toUpperCase()}`}
      </TerminalText>
      <TerminalText size={scaleFont(8)} style={{ color: theme.textColor, fontWeight: '800', lineHeight: scaleSize(11) }}>
        {contract.title}
      </TerminalText>
      {formatContractContextTag(contract) ? (
        <TerminalText size={scaleFont(5.8)} style={{ color: sponsorAccent, fontWeight: '700' }}>
          {formatContractContextTag(contract)}
        </TerminalText>
      ) : null}
      <TerminalText size={scaleFont(6.5)} style={{ color: theme.mutedColor, lineHeight: scaleSize(11) }}>
        {contract.objectiveText}
      </TerminalText>
      <TerminalText size={scaleFont(6)} style={{ color: theme.textColor }}>
        {`RECOMMENDED: ${contract.recommendedSectorIds.map((id) => id.replace('THE_', '').replace(/_/g, ' ')).join(', ') || 'ANY'}`}
      </TerminalText>
      <TerminalText size={scaleFont(6)} style={{ color: theme.statusColor }}>
        {formatContractRewardSummary(contract)}
      </TerminalText>
      <TerminalText size={scaleFont(5.6)} style={{ color: sponsorAccent, fontWeight: '700' }}>
        {identity.sealSubline}
      </TerminalText>
      {perks.length > 0 ? (
        <View style={{ gap: scaleSpacing(4) }}>
          <TerminalText size={scaleFont(5.5)} letterSpacing={0.6} style={{ color: theme.mutedColor }}>
            SPONSOR PERKS
          </TerminalText>
          {perks.map((perk) => (
            <TerminalText key={perk} size={scaleFont(5.8)} style={{ color: theme.textColor }}>
              {`• ${perk}`}
            </TerminalText>
          ))}
        </View>
      ) : null}
      {contract.bonusObjective ? (
        <TerminalText size={scaleFont(5.8)} style={{ color: theme.mutedColor }}>
          {`BONUS: ${contract.bonusObjective.text}`}
        </TerminalText>
      ) : null}
      {cargoDeliveryHints.length > 0 ? (
        <View style={{ gap: scaleSpacing(4) }}>
          <TerminalText size={scaleFont(5.5)} letterSpacing={0.6} style={{ color: theme.mutedColor }}>
            POST-RUN DELIVERY
          </TerminalText>
          {cargoDeliveryHints.map((line) => (
            <TerminalText key={line} size={scaleFont(5.8)} style={{ color: '#fbbf24', lineHeight: scaleSize(10) }}>
              {`• ${line}`}
            </TerminalText>
          ))}
        </View>
      ) : null}
      <TerminalText size={scaleFont(5.5)} style={{ color: theme.mutedColor }}>
        Change contract on the Contract Board tab.
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
  },
  sealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  seal: {
    borderWidth: 1.5,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: '-6deg' }],
  },
});
