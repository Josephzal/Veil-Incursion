import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { useVeilFrontLayout, visibleWithOverflow } from './useVeilFrontLayout';
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

interface SelectedSectorStatusOverlayProps {
  theme: TerminalTheme;
  sector: SectorState;
  /** When true, overlay stretches to container width (stacked map top). */
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
        letterSpacing={0.7}
        style={[styles.statusLabel, { color: mutedColor, width: scaleSpacing(56) }]}
      >
        {label}
      </TerminalText>
      <TerminalText
        size={scaleFont(7.5)}
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
              style={[styles.pip, { backgroundColor: i < pips ? accentColor : `${mutedColor}33` }]}
            />
          ))}
        </View>
      ) : (
        <View style={styles.pipSpacer} />
      )}
    </View>
  );
}

function ResourceChip({ label, accentColor }: { label: string; accentColor: string }) {
  const { scaleFont, scaleSpacing } = useVeilFrontLayout();
  return (
    <View
      style={[
        styles.resourceChip,
        {
          borderColor: `${accentColor}55`,
          paddingHorizontal: scaleSpacing(5),
          paddingVertical: scaleSpacing(2),
        },
      ]}
    >
      <TerminalText size={scaleFont(6)} style={{ color: accentColor }} numberOfLines={1}>
        {label}
      </TerminalText>
    </View>
  );
}

/** Compact tactical status overlay for the map panel top-right. */
export default function SelectedSectorStatusOverlay({
  theme,
  sector,
  fullWidth = false,
}: SelectedSectorStatusOverlayProps): React.JSX.Element {
  const { scaleSpacing, statusOverlayWidth, isCompactHeight } = useVeilFrontLayout();
  const anchor = anchorStatusLabel(sector);
  const { visible: visibleResources, overflow: resourceOverflow } = visibleWithOverflow(sector.resourceFocus, 2);

  return (
    <View
      style={[
        styles.overlay,
        {
          paddingHorizontal: scaleSpacing(isCompactHeight ? 10 : 12),
          paddingVertical: scaleSpacing(isCompactHeight ? 8 : 10),
          borderColor: 'rgba(120, 170, 220, 0.28)',
          width: fullWidth ? '100%' : statusOverlayWidth,
          maxWidth: fullWidth ? undefined : 320,
          gap: scaleSpacing(4),
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
      <View style={[styles.resourceRow, { gap: scaleSpacing(4), marginTop: scaleSpacing(8) }]}>
        <View style={[styles.resourceChips, { gap: scaleSpacing(4) }]}>
          {visibleResources.map((resource) => (
            <ResourceChip key={resource} label={resource} accentColor="#fbbf24" />
          ))}
          {resourceOverflow > 0 ? (
            <ResourceChip label={`+${resourceOverflow}`} accentColor={theme.mutedColor} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(10, 16, 28, 0.88)',
    borderWidth: 1,
    flexShrink: 0,
    minWidth: 0,
    overflow: 'hidden',
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
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  resourceRow: {
    minWidth: 0,
    overflow: 'hidden',
  },
  resourceChips: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  resourceChip: {
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    maxWidth: 140,
    overflow: 'hidden',
  },
});
