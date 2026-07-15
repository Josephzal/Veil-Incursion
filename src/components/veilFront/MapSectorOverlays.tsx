import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import { formatEchoActivity } from '../../utils/veilFrontBriefingUi';
import type { SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import {
  anchorStatusLabel,
  compactResourceDisplayName,
  echoPipCount,
  formatOperationLifecycleStatus,
  hazardLabel,
  hazardPipCount,
  operationTypeChip,
  rewardLabel,
  rewardPipCount,
  SECTOR_FLAVOR_LINES,
  threatMeterColor,
  VEIL_BIOME_VISUALS,
} from '../../utils/veilFrontSectorUi';
import { useWorldState } from '../../context/WorldStateContext';
import { getRecentlySuppressedAnchor } from '../../data/anchorLifecycleEngine';

interface MapSectorOverlaysProps {
  theme: TerminalTheme;
  sector: SectorState;
}

function IntelRow({
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
  const { scaleSpacing, scaleFont } = useVeilFrontLayout();

  return (
    <View style={[styles.intelRow, { gap: scaleSpacing(8) }]}>
      <TerminalText
        size={scaleFont(6)}
        letterSpacing={0.4}
        style={[styles.intelLabel, { color: mutedColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </TerminalText>
      <TerminalText
        size={scaleFont(7)}
        style={[styles.intelValue, { color: textColor, fontWeight: '700' }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {value}
      </TerminalText>
    </View>
  );
}

/** Upper-left sector summary in map top band. */
export function MapSectorSummary({ theme, sector }: MapSectorOverlaysProps): React.JSX.Element {
  const { scaleSpacing, descriptionLines, showOptionalCopy } = useVeilFrontLayout();
  const biomeVisual = VEIL_BIOME_VISUALS[sector.veilBiome];

  return (
    <View
      style={[
        styles.sectorSummary,
        {
          paddingHorizontal: scaleSpacing(14),
          paddingVertical: scaleSpacing(11),
          borderColor: `${biomeVisual.glow}40`,
          gap: scaleSpacing(5),
        },
      ]}
    >
      <TerminalText variant="section" letterSpacing={0.45} style={{ color: theme.textColor, fontWeight: '800' }}>
        {sector.displayName}
      </TerminalText>
      <TerminalText variant="micro" letterSpacing={0.9} style={{ color: biomeVisual.glow }}>
        {biomeVisual.label}
      </TerminalText>
      {showOptionalCopy ? (
        <TerminalText
          variant="caption"
          style={{ color: theme.mutedColor, lineHeight: scaleSpacing(12), marginTop: scaleSpacing(2) }}
          numberOfLines={descriptionLines}
        >
          {SECTOR_FLAVOR_LINES[sector.id]}
        </TerminalText>
      ) : null}
    </View>
  );
}

/** Upper-right sector intel: status rows + resources. */
export function SectorIntel({ theme, sector }: MapSectorOverlaysProps): React.JSX.Element {
  const { scaleSpacing, isMapTopBandStacked } = useVeilFrontLayout();
  const { persisted } = useWorldState();
  const suppressed = getRecentlySuppressedAnchor(persisted, sector.id);
  const anchor = sector.activeAnchor
    ? anchorStatusLabel(sector)
    : suppressed && suppressed.remainingRuns > 0
      ? { label: `Aftermath (${suppressed.remainingRuns})`, pips: 2 }
      : anchorStatusLabel(sector);
  const resourceLine = sector.resourceFocus.map(compactResourceDisplayName).join(' / ');
  const operationLabel = `${operationTypeChip(sector.activeOperation.objectiveKind)} · ${formatOperationLifecycleStatus(
    sector.activeOperation.lifecycleStatus,
    sector.activeOperation.runsRemaining,
  ).split(' — ')[0]}`;

  return (
    <View
      style={[
        styles.sectorIntel,
        isMapTopBandStacked ? styles.sectorIntelStacked : null,
        {
          paddingHorizontal: scaleSpacing(12),
          paddingVertical: scaleSpacing(9),
          borderColor: 'rgba(120, 170, 220, 0.22)',
          gap: scaleSpacing(4),
        },
      ]}
    >
      <TerminalText variant="micro" letterSpacing={0.8} style={{ color: theme.statusColor, fontWeight: '700' }}>
        SECTOR INTEL
      </TerminalText>
      <IntelRow
        label="Threat"
        value={hazardLabel(sector.hazardLevel)}
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
      />
      <IntelRow
        label="Reward"
        value={rewardLabel(sector.rewardLevel)}
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
      />
      <IntelRow
        label="Echo"
        value={formatEchoActivity(sector.echoActivity)}
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
      />
      <IntelRow
        label="Operation"
        value={operationLabel}
        mutedColor={theme.mutedColor}
        textColor={theme.statusColor}
      />
      <IntelRow
        label="Anchor"
        value={anchor.label}
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
      />
      {resourceLine.length > 0 ? (
        <IntelRow
          label="Resources"
          value={resourceLine}
          mutedColor={theme.mutedColor}
          textColor={theme.textColor}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectorSummary: {
    flex: 1,
    minWidth: 0,
    maxWidth: 560,
    backgroundColor: 'rgba(10, 16, 28, 0.74)',
    borderWidth: 1,
    borderLeftWidth: 2,
    overflow: 'hidden',
  },
  sectorIntel: {
    flexShrink: 0,
    width: 360,
    minWidth: 330,
    maxWidth: 390,
    backgroundColor: 'rgba(10, 16, 28, 0.72)',
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectorIntelStacked: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  intelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  intelLabel: {
    width: 68,
    flexShrink: 0,
  },
  intelValue: {
    flex: 1,
    minWidth: 0,
  },
});
