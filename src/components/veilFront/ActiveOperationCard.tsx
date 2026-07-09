import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { ProgressBar } from './VeilFrontUiPrimitives';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import { operationProgressPercent } from '../../data/worldStateHelpers';
import type { SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { formatOperationContributesForObjective, formatOperationLifecycleStatus, formatOperationProgressLabel, formatOperationProgressLockMessage, isOperationProgressLocked, operationLifecycleAccentColor, operationTypeChip } from '../../utils/veilFrontSectorUi';

interface ActiveOperationCardProps {
  theme: TerminalTheme;
  sector: SectorState;
}

export default function ActiveOperationCard({
  theme,
  sector,
}: ActiveOperationCardProps): React.JSX.Element {
  const { scaleSpacing, scaleSize, scaleFont } = useVeilFrontLayout();
  const operationPct = operationProgressPercent(
    sector.activeOperation.progressCurrent,
    sector.activeOperation.progressRequired,
  );
  const contributes = formatOperationContributesForObjective(
    sector.activeOperation.objectiveKind,
    sector.activeOperation.contributionRules,
    sector.activeOperation.rewardEmphasis.targetResources,
  );
  const lifecycleLabel = formatOperationLifecycleStatus(
    sector.activeOperation.lifecycleStatus,
    sector.activeOperation.runsRemaining,
  );
  const lifecycleColor = operationLifecycleAccentColor(
    sector.activeOperation.lifecycleStatus,
    theme.statusColor,
  );
  const progressLocked = isOperationProgressLocked(sector.activeOperation.lifecycleStatus);
  const progressLockMessage = formatOperationProgressLockMessage(sector.activeOperation.lifecycleStatus);
  const visibleContributes = contributes.slice(0, 3);
  const overflowCount = contributes.length - visibleContributes.length;

  return (
    <View
      style={[
        styles.card,
        {
          padding: scaleSpacing(14),
          borderColor: `${theme.statusColor}44`,
          gap: scaleSpacing(8),
        },
      ]}
    >
      <TerminalText
        size={scaleFont(7)}
        letterSpacing={1}
        style={{ color: theme.statusColor, fontWeight: '700' }}
      >
        ACTIVE OPERATION
      </TerminalText>

      <TerminalText
        size={scaleFont(6.5)}
        letterSpacing={0.6}
        style={{ color: lifecycleColor, fontWeight: '700' }}
      >
        {lifecycleLabel}
      </TerminalText>
      <TerminalText size={scaleFont(6)} style={{ color: theme.mutedColor }}>
        {`Run window: ${sector.activeOperation.generatedAtRunIndex} → ${sector.activeOperation.expiresAtRunIndex}`}
      </TerminalText>

      <View style={styles.bodyContent}>
        <TerminalText
          size={scaleFont(10)}
          letterSpacing={0.3}
          style={{ color: theme.textColor, fontWeight: '700' }}
          numberOfLines={2}
        >
          {sector.activeOperation.title}
        </TerminalText>

        <View
          style={[
            styles.typeChip,
            {
              borderColor: `${theme.statusColor}55`,
              paddingHorizontal: scaleSpacing(8),
              paddingVertical: scaleSpacing(3),
              marginTop: scaleSpacing(2),
            },
          ]}
        >
          <TerminalText size={scaleFont(6.5)} letterSpacing={0.6} style={{ color: theme.statusColor }}>
            {operationTypeChip(sector.activeOperation.objectiveKind)}
          </TerminalText>
        </View>

        <TerminalText
          size={scaleFont(7.5)}
          style={{ color: theme.mutedColor, lineHeight: scaleSize(12), marginTop: scaleSpacing(4) }}
          numberOfLines={3}
        >
          {sector.activeOperation.description}
        </TerminalText>

        <TerminalText
          size={scaleFont(6.5)}
          letterSpacing={0.6}
          style={{ color: theme.mutedColor, marginTop: scaleSpacing(8) }}
        >
          {`Community Progress: ${formatOperationProgressLabel(
            sector.activeOperation.progressCurrent,
            sector.activeOperation.progressRequired,
            operationPct,
          )}`}
        </TerminalText>
        <ProgressBar
          percent={operationPct}
          accentColor={progressLocked ? theme.mutedColor : theme.statusColor}
          height={scaleSize(7)}
        />
        {progressLockMessage ? (
          <TerminalText
            size={scaleFont(6)}
            style={{ color: lifecycleColor, marginTop: scaleSpacing(4) }}
            numberOfLines={2}
          >
            {progressLockMessage}
          </TerminalText>
        ) : null}

        <TerminalText
          size={scaleFont(6.2)}
          letterSpacing={0.5}
          style={{ color: theme.statusColor, marginTop: scaleSpacing(6) }}
          numberOfLines={2}
        >
          {`Reward preview: ${sector.activeOperation.rewardPreview}`}
        </TerminalText>

        {visibleContributes.length > 0 ? (
          <View style={{ marginTop: scaleSpacing(8) }}>
            <TerminalText
              size={scaleFont(6.5)}
              letterSpacing={0.6}
              style={{ color: theme.mutedColor, marginBottom: scaleSpacing(4) }}
            >
              CONTRIBUTES
            </TerminalText>
            <View style={[styles.chipRow, { gap: scaleSpacing(4) }]}>
              {visibleContributes.map((line) => (
                <View
                  key={line}
                  style={[styles.contributeChip, { borderColor: `${theme.statusColor}44`, paddingHorizontal: scaleSpacing(6), paddingVertical: scaleSpacing(3) }]}
                >
                  <TerminalText size={scaleFont(6.5)} style={{ color: theme.textColor }} numberOfLines={1}>
                    {line}
                  </TerminalText>
                </View>
              ))}
              {overflowCount > 0 ? (
                <View style={[styles.contributeChip, { borderColor: `${theme.mutedColor}44`, paddingHorizontal: scaleSpacing(6), paddingVertical: scaleSpacing(3) }]}>
                  <TerminalText size={scaleFont(6.5)} style={{ color: theme.mutedColor }}>
                    {`+${overflowCount} more`}
                  </TerminalText>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderWidth: 1,
    backgroundColor: 'rgba(18, 28, 44, 0.88)',
    overflow: 'hidden',
  },
  bodyContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  typeChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  contributeChip: {
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    maxWidth: '100%',
  },
});
