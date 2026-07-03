import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { useHubLayout } from '../../context/HubLayoutContext';
import { useWorldState } from '../../context/WorldStateContext';
import { DOSSIER_METER_TRACK } from '../../constants/dossierSurface';
import { formatBracketHeader, HUB_DATA_DIVIDER } from '../../styles/hubTerminalUi';
import type { SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { operationProgressPercent } from '../../data/worldStateHelpers';
import { anchorIdForSector, getSectorWorldTemplate } from '../../data/sectorWorldCatalog';
import {
  formatEchoActivity,
  formatOperationObjectiveKind,
  qualitativeLevel,
} from '../../utils/veilFrontBriefingUi';

interface SectorBriefingPanelProps {
  theme: TerminalTheme;
  sector: SectorState;
}

function BriefRow({
  label,
  value,
  mutedColor,
  textColor,
  accentColor,
  scaleSpacing,
}: {
  label: string;
  value: string;
  mutedColor: string;
  textColor: string;
  accentColor: string;
  scaleSpacing: (n: number) => number;
}) {
  return (
    <View style={[styles.row, { marginBottom: scaleSpacing(8) }]}>
      <TerminalText variant="caption" letterSpacing={0.8} style={{ color: mutedColor }}>
        {label.toUpperCase()}
      </TerminalText>
      <TerminalText variant="body" letterSpacing={0.5} style={{ color: textColor, marginTop: scaleSpacing(2) }}>
        {value}
      </TerminalText>
      <View style={[styles.rowRule, { backgroundColor: accentColor, opacity: 0.15, marginTop: scaleSpacing(4) }]} />
    </View>
  );
}

export default function SectorBriefingPanel({
  theme,
  sector,
}: SectorBriefingPanelProps): React.JSX.Element {
  const { isDesktop, scaleSpacing, scaleSize } = useHubLayout();
  const { persisted } = useWorldState();
  const operationPct = operationProgressPercent(
    sector.activeOperation.progressCurrent,
    sector.activeOperation.progressRequired,
  );
  const sectorTemplate = getSectorWorldTemplate(sector.id);
  const dormantAnchorRunsRemaining = sectorTemplate.anchor
    ? persisted.dormantAnchorRuns[anchorIdForSector(sector.id, sectorTemplate.anchor.type)] ?? 0
    : 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: scaleSpacing(12) }]}
      showsVerticalScrollIndicator={false}
    >
      <TerminalText
        variant="section"
        letterSpacing={1}
        style={{ color: theme.statusColor, marginBottom: scaleSpacing(10) }}
      >
        {formatBracketHeader('Sector Dossier')}
      </TerminalText>

      <TerminalText
        variant="display"
        letterSpacing={1.2}
        style={{ color: theme.textColor, marginBottom: scaleSpacing(4) }}
      >
        {sector.displayName.toUpperCase()}
      </TerminalText>
      <TerminalText variant="caption" style={{ color: theme.mutedColor, marginBottom: scaleSpacing(12) }}>
        {sector.biome.toUpperCase()}
      </TerminalText>

      <View style={[styles.divider, { borderTopColor: HUB_DATA_DIVIDER, marginBottom: scaleSpacing(12) }]} />

      <BriefRow
        label="Hazard"
        value={qualitativeLevel(sector.hazardLevel)}
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
        accentColor={theme.statusColor}
        scaleSpacing={scaleSpacing}
      />
      <BriefRow
        label="Reward"
        value={qualitativeLevel(sector.rewardLevel)}
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
        accentColor={theme.statusColor}
        scaleSpacing={scaleSpacing}
      />
      <BriefRow
        label="Echo Activity"
        value={formatEchoActivity(sector.echoActivity)}
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
        accentColor={theme.statusColor}
        scaleSpacing={scaleSpacing}
      />
      <BriefRow
        label="Resource Focus"
        value={sector.resourceFocus.join(' / ')}
        mutedColor={theme.mutedColor}
        textColor={theme.textColor}
        accentColor={theme.statusColor}
        scaleSpacing={scaleSpacing}
      />

      <View style={[styles.divider, { borderTopColor: HUB_DATA_DIVIDER, marginVertical: scaleSpacing(12) }]} />

      <TerminalText
        variant="caption"
        letterSpacing={0.8}
        style={{ color: theme.mutedColor, marginBottom: scaleSpacing(4) }}
      >
        ACTIVE ANCHOR
      </TerminalText>
      <TerminalText
        variant="body"
        letterSpacing={0.6}
        style={{ color: sector.activeAnchor ? theme.statusColor : theme.mutedColor, marginBottom: scaleSpacing(4) }}
      >
        {sector.activeAnchor?.displayName.toUpperCase() ?? 'NONE DETECTED'}
      </TerminalText>
      {sector.activeAnchor ? (
        <TerminalText variant="micro" style={{ color: theme.mutedColor, lineHeight: scaleSize(14), marginBottom: scaleSpacing(12) }}>
          {sector.activeAnchor.description}
        </TerminalText>
      ) : dormantAnchorRunsRemaining > 0 && sectorTemplate.anchor ? (
        <>
          <TerminalText variant="micro" style={{ color: theme.statusColor, marginBottom: scaleSpacing(4) }}>
            {`${sectorTemplate.anchor.displayName.toUpperCase()} — DORMANT`}
          </TerminalText>
          <TerminalText variant="micro" style={{ color: theme.mutedColor, marginBottom: scaleSpacing(12) }}>
            {`Veil signature suppressed for ${dormantAnchorRunsRemaining} more run${dormantAnchorRunsRemaining === 1 ? '' : 's'}.`}
          </TerminalText>
        </>
      ) : (
        <TerminalText variant="micro" style={{ color: theme.mutedColor, marginBottom: scaleSpacing(12) }}>
          No active Veil anchor signatures in this sector.
        </TerminalText>
      )}

      <View style={[styles.divider, { borderTopColor: HUB_DATA_DIVIDER, marginBottom: scaleSpacing(12) }]} />

      <TerminalText
        variant="caption"
        letterSpacing={0.8}
        style={{ color: theme.mutedColor, marginBottom: scaleSpacing(4) }}
      >
        ACTIVE OPERATION
      </TerminalText>
      <TerminalText variant="body" letterSpacing={0.5} style={{ color: theme.textColor, marginBottom: scaleSpacing(4) }}>
        {sector.activeOperation.title}
      </TerminalText>
      <TerminalText variant="micro" style={{ color: theme.statusColor, marginBottom: scaleSpacing(4) }}>
        {formatOperationObjectiveKind(sector.activeOperation.objectiveKind).toUpperCase()}
      </TerminalText>
      <TerminalText variant="micro" style={{ color: theme.mutedColor, lineHeight: scaleSize(14), marginBottom: scaleSpacing(8) }}>
        {sector.activeOperation.description}
      </TerminalText>

      <View style={[styles.progressTrack, { height: scaleSize(isDesktop ? 22 : 8), backgroundColor: DOSSIER_METER_TRACK }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${operationPct}%`,
              backgroundColor: theme.statusColor,
              minWidth: operationPct > 0 ? scaleSize(8) : 0,
            },
          ]}
        />
      </View>
      <TerminalText variant="micro" style={{ color: theme.mutedColor, marginTop: scaleSpacing(4) }}>
        {`${operationPct}% COMMUNITY PROGRESS`}
      </TerminalText>

      {persisted.temporarySectorModifiers.some((mod) => mod.sectorId === sector.id && mod.runsRemaining > 0) ? (
        <>
          <View style={[styles.divider, { borderTopColor: HUB_DATA_DIVIDER, marginVertical: scaleSpacing(12) }]} />
          <TerminalText variant="caption" letterSpacing={0.8} style={{ color: theme.mutedColor, marginBottom: scaleSpacing(4) }}>
            ACTIVE SECTOR MODIFIERS
          </TerminalText>
          {persisted.temporarySectorModifiers
            .filter((mod) => mod.sectorId === sector.id && mod.runsRemaining > 0)
            .map((mod) => (
              <TerminalText key={mod.label} variant="micro" style={{ color: theme.statusColor, marginBottom: scaleSpacing(2) }}>
                {`• ${mod.label} — ${mod.runsRemaining} run${mod.runsRemaining === 1 ? '' : 's'} remaining`}
              </TerminalText>
            ))}
        </>
      ) : null}

      {persisted.operationLog.length > 0 ? (
        <>
          <View style={[styles.divider, { borderTopColor: HUB_DATA_DIVIDER, marginVertical: scaleSpacing(12) }]} />
          <TerminalText variant="caption" letterSpacing={0.8} style={{ color: theme.mutedColor, marginBottom: scaleSpacing(4) }}>
            OPERATION LOG
          </TerminalText>
          {persisted.operationLog.slice(0, 4).map((line) => (
            <TerminalText key={line} variant="micro" style={{ color: theme.mutedColor, marginBottom: scaleSpacing(3), lineHeight: scaleSize(13) }}>
              {line.replace(/^>>\s*/, '')}
            </TerminalText>
          ))}
        </>
      ) : null}

      {sector.employerPresence && sector.employerPresence.length > 0 ? (
        <>
          <View style={[styles.divider, { borderTopColor: HUB_DATA_DIVIDER, marginVertical: scaleSpacing(12) }]} />
          <TerminalText variant="caption" letterSpacing={0.8} style={{ color: theme.mutedColor, marginBottom: scaleSpacing(4) }}>
            EMPLOYERS ACTIVE IN SECTOR
          </TerminalText>
          {sector.employerPresence.map((employer) => (
            <TerminalText key={employer} variant="micro" style={{ color: theme.textColor, marginBottom: scaleSpacing(2) }}>
              {`• ${employer.replace('_', ' ')} — sponsor packages available`}
            </TerminalText>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  divider: {
    borderTopWidth: 1,
  },
  row: {},
  rowRule: {
    height: 1,
    width: '40%',
  },
  progressTrack: {
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
