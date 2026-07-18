import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { InfoChip } from './VeilFrontUiPrimitives';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import { formatEchoActivity } from '../../utils/veilFrontBriefingUi';
import {
  anchorStatusLabel,
  echoMeterColor,
  echoPipCount,
  hazardLabel,
  hazardPipCount,
  rewardLabel,
  rewardPipCount,
  threatMeterColor,
} from '../../utils/veilFrontSectorUi';
import type { SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { getAccountProgressionProfile } from '../../data/progressionDebugEngine';
import { formatSectorFarmingPreviewLines } from '../../data/resourceSourceHintEngine';
import { getResourceDisplayName } from '../../data/resourceRegistry';
import { sectorPrimaryResourcePool } from '../../data/sectorResourceTableEngine';

interface MapStatusSummaryProps {
  theme: TerminalTheme;
  sector: SectorState;
  /** When true, card stretches to container width (stacked layout). */
  fullWidth?: boolean;
}

function StatusRow({
  label,
  value,
  pips,
  maxPips = 4,
  accentColor,
  mutedColor,
  textColor,
}: {
  label: string;
  value: string;
  pips: number;
  maxPips?: number;
  accentColor: string;
  mutedColor: string;
  textColor: string;
}) {
  const { scaleSpacing, scaleFont } = useVeilFrontLayout();

  return (
    <View style={[styles.statusRow, { gap: scaleSpacing(6) }]}>
      <TerminalText
        size={scaleFont(6.5)}
        letterSpacing={0.8}
        style={[styles.statusLabel, { color: mutedColor, width: scaleSpacing(52) }]}
      >
        {label}
      </TerminalText>
      <TerminalText
        size={scaleFont(7.5)}
        letterSpacing={0.2}
        style={[styles.statusValue, { color: textColor }]}
        numberOfLines={1}
      >
        {value}
      </TerminalText>
      {pips > 0 ? (
        <View style={[styles.pipRow, { gap: scaleSpacing(2) }]}>
          {Array.from({ length: maxPips }, (_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                { backgroundColor: i < pips ? accentColor : `${mutedColor}33` },
              ]}
            />
          ))}
        </View>
      ) : (
        <View style={styles.pipSpacer} />
      )}
    </View>
  );
}

export default function MapStatusSummary({
  theme,
  sector,
  fullWidth = false,
}: MapStatusSummaryProps): React.JSX.Element {
  const { scaleSpacing, statusOverlayWidth } = useVeilFrontLayout();
  const { account } = usePlayerAccount();
  const profile = getAccountProgressionProfile(account);
  const anchor = anchorStatusLabel(sector);
  const farmingLines = formatSectorFarmingPreviewLines(sector.id, profile);
  const primaryChips = sectorPrimaryResourcePool(sector.id)
    .slice(0, 4)
    .map((id) => getResourceDisplayName(id, true));

  return (
    <View
      style={[
        styles.card,
        {
          paddingHorizontal: scaleSpacing(12),
          paddingVertical: scaleSpacing(10),
          gap: scaleSpacing(5),
          borderColor: 'rgba(128, 170, 220, 0.35)',
          width: fullWidth ? '100%' : statusOverlayWidth,
          maxWidth: fullWidth ? undefined : 320,
        },
      ]}
    >
      <StatusRow
        label="THREAT"
        value={hazardLabel(sector.hazardLevel)}
        pips={hazardPipCount(sector.hazardLevel)}
        accentColor={threatMeterColor(sector.hazardLevel)}
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
      />
      <StatusRow
        label="REWARD"
        value={rewardLabel(sector.rewardLevel)}
        pips={rewardPipCount(sector.rewardLevel)}
        accentColor="#fbbf24"
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
      />
      <StatusRow
        label="ECHO"
        value={formatEchoActivity(sector.echoActivity)}
        pips={echoPipCount(sector.echoActivity)}
        accentColor={echoMeterColor(sector.echoActivity)}
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
      />
      <StatusRow
        label="ANCHOR"
        value={anchor.label}
        pips={anchor.pips}
        accentColor="#a855f7"
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
      />
      <View style={[styles.resourceRow, { gap: scaleSpacing(5), marginTop: scaleSpacing(4) }]}>
        <TerminalText
          size={6}
          letterSpacing={0.7}
          style={{ color: theme.mutedColor, marginBottom: scaleSpacing(2) }}
        >
          FARMING IDENTITY
        </TerminalText>
        <View style={[styles.resourceChips, { gap: scaleSpacing(4) }]}>
          {(primaryChips.length > 0 ? primaryChips : sector.resourceFocus).map((resource) => (
            <InfoChip key={resource} label={resource} accentColor="#fbbf24" />
          ))}
        </View>
        {farmingLines.map((line) => (
          <TerminalText
            key={line}
            size={5.4}
            style={{ color: theme.mutedColor, marginTop: scaleSpacing(2), lineHeight: 8 }}
          >
            {line}
          </TerminalText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(8, 13, 22, 0.88)',
    borderWidth: 1,
    flexShrink: 0,
    minWidth: 0,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  statusLabel: {
    flexShrink: 0,
    fontWeight: '700',
  },
  statusValue: {
    flex: 1,
    minWidth: 0,
    fontWeight: '700',
  },
  pipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  pipSpacer: {
    width: 20,
    flexShrink: 0,
  },
  pip: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  resourceRow: {
    minWidth: 0,
  },
  resourceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
