import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { useHubLayout } from '../../context/HubLayoutContext';
import type { CabalEmployerId, SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { employerSponsorLabel } from '../../utils/employerContractUi';
import { formatOperationObjectiveKind } from '../../utils/veilFrontBriefingUi';

interface VeilFrontHeaderSummaryProps {
  theme: TerminalTheme;
  sector: SectorState;
  selectedEmployer: CabalEmployerId | null;
}

export default function VeilFrontHeaderSummary({
  theme,
  sector,
  selectedEmployer,
}: VeilFrontHeaderSummaryProps): React.JSX.Element {
  const { scaleSpacing } = useHubLayout();
  const sponsorLabel = selectedEmployer
    ? employerSponsorLabel(selectedEmployer)
    : 'No Sponsor';

  return (
    <View style={[styles.root, { gap: scaleSpacing(3) }]}>
      <SummaryRow label="Target" value={sector.displayName} mutedColor={theme.mutedColor} textColor={theme.textColor} />
      <SummaryRow
        label="Operation"
        value={formatOperationObjectiveKind(sector.activeOperation.objectiveKind)}
        mutedColor={theme.mutedColor}
        textColor={theme.statusColor}
      />
      <SummaryRow label="Sponsor" value={sponsorLabel} mutedColor={theme.mutedColor} textColor={theme.textColor} />
    </View>
  );
}

function SummaryRow({
  label,
  value,
  mutedColor,
  textColor,
}: {
  label: string;
  value: string;
  mutedColor: string;
  textColor: string;
}) {
  return (
    <View style={styles.row}>
      <TerminalText variant="micro" letterSpacing={0.6} style={{ color: mutedColor, minWidth: 72 }}>
        {`${label}:`}
      </TerminalText>
      <TerminalText variant="micro" letterSpacing={0.4} style={{ color: textColor, flex: 1, textAlign: 'right' }} numberOfLines={2}>
        {value.toUpperCase()}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'stretch',
    maxWidth: 260,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
});
