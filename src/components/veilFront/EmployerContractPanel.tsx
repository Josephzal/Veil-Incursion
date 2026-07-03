import React from 'react';
import { StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import TacticalButton from '../TacticalButton';
import { FACTION_DEFINITIONS, getDossierFactionAccent } from '../../data/factions';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { HUB_BORDER_INSET, hubCtaButtonStyle } from '../../constants/hubCta';
import { dossierOpaqueCtaStyle } from '../../constants/dossierSurface';
import { formatBracketHeader, HUB_DATA_DIVIDER, accentButtonFill } from '../../styles/hubTerminalUi';
import type { CabalEmployerId, SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import {
  describeEmployerPerks,
  employerSponsorLabel,
} from '../../utils/employerContractUi';
import { formatOperationObjectiveKind } from '../../utils/veilFrontBriefingUi';

interface EmployerContractPanelProps {
  theme: TerminalTheme;
  sector: SectorState;
  selectedEmployer: CabalEmployerId | null;
  onSelectEmployer: (employer: CabalEmployerId | null) => void;
  onBeginIncursion: () => void;
  runDisabled: boolean;
  launching: boolean;
}

const ALL_EMPLOYERS: CabalEmployerId[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

export default function EmployerContractPanel({
  theme,
  sector,
  selectedEmployer,
  onSelectEmployer,
  onBeginIncursion,
  runDisabled,
  launching,
}: EmployerContractPanelProps): React.JSX.Element {
  const { theme: terminalTheme } = useTerminal();
  const { account } = usePlayerAccount();
  const { scaleSpacing, scaleSize } = useHubLayout();
  const ctaAccent = getDossierFactionAccent(account.alignedFaction);
  const canLaunch = !runDisabled && !launching;
  const availableEmployers = ALL_EMPLOYERS.filter(
    (id) => sector.employerPresence?.includes(id) ?? true,
  );

  return (
    <View style={styles.root}>
      <TerminalText
        variant="section"
        letterSpacing={1}
        style={{ color: theme.statusColor, marginBottom: scaleSpacing(10) }}
      >
        {formatBracketHeader('Sponsor Contract')}
      </TerminalText>

      <TerminalText variant="micro" style={{ color: theme.mutedColor, lineHeight: scaleSize(14), marginBottom: scaleSpacing(10) }}>
        Optional employer reward package. Cabals sponsor extraction — they do not control this front.
      </TerminalText>

      <HapticPressable
        onPress={() => onSelectEmployer(null)}
        style={({ pressed }) => [
          styles.contractBlock,
          {
            borderColor: selectedEmployer === null ? theme.statusColor : HUB_DATA_DIVIDER,
            backgroundColor: accentButtonFill(theme.statusColor, pressed),
            marginBottom: scaleSpacing(8),
            padding: scaleSpacing(10),
          },
        ]}
      >
        <TerminalText variant="caption" style={{ color: theme.textColor }}>
          NO SPONSOR
        </TerminalText>
        <TerminalText variant="micro" style={{ color: theme.mutedColor, marginTop: scaleSpacing(2) }}>
          Independent breach — base sector rewards only
        </TerminalText>
      </HapticPressable>

      {availableEmployers.map((employerId) => {
        const def = FACTION_DEFINITIONS[employerId];
        const isSelected = selectedEmployer === employerId;
        const perks = describeEmployerPerks(employerId);

        return (
          <HapticPressable
            key={employerId}
            onPress={() => onSelectEmployer(employerId)}
            style={({ pressed }) => [
              styles.contractBlock,
              {
                borderColor: isSelected ? def.borderColor : HUB_DATA_DIVIDER,
                backgroundColor: accentButtonFill(def.accentColor, pressed),
                marginBottom: scaleSpacing(8),
                padding: scaleSpacing(10),
              },
            ]}
          >
            <TerminalText variant="caption" style={{ color: def.typographyColor }}>
              {employerSponsorLabel(employerId).toUpperCase()}
            </TerminalText>
            <TerminalText variant="micro" style={{ color: theme.mutedColor, marginTop: scaleSpacing(2), marginBottom: scaleSpacing(4) }}>
              {def.tagline}
            </TerminalText>
            {perks.map((perk) => (
              <TerminalText key={perk} variant="micro" style={{ color: theme.textColor }}>
                {`• ${perk}`}
              </TerminalText>
            ))}
          </HapticPressable>
        );
      })}

      <View style={[styles.divider, { borderTopColor: HUB_DATA_DIVIDER, marginVertical: scaleSpacing(12) }]} />

      <TacticalButton
        label={launching ? '[ INITIATING BREACH... ]' : '[ INITIATE BREACH ]'}
        active={canLaunch}
        onPress={onBeginIncursion}
        accentColor={ctaAccent}
        mutedColor={terminalTheme.mutedColor}
        variant="cta"
        disabled={!canLaunch}
        style={[
          hubCtaButtonStyle(ctaAccent, scaleSize, scaleSpacing),
          dossierOpaqueCtaStyle(ctaAccent),
          { marginHorizontal: HUB_BORDER_INSET, opacity: canLaunch ? 1 : 0.4 },
        ]}
      />
      <TerminalText
        variant="micro"
        style={{ color: theme.mutedColor, textAlign: 'center', marginTop: scaleSpacing(6) }}
      >
        {`TARGET: ${sector.displayName.toUpperCase()} // ${sector.activeOperation.title.toUpperCase()}`}
      </TerminalText>
      <TerminalText
        variant="micro"
        style={{ color: theme.mutedColor, textAlign: 'center', marginTop: scaleSpacing(2) }}
      >
        {formatOperationObjectiveKind(sector.activeOperation.objectiveKind).toUpperCase()}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  contractBlock: {
    borderWidth: 1,
  },
  divider: {
    borderTopWidth: 1,
  },
});
