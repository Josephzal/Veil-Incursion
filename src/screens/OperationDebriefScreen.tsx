import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import TerminalResultsLayout from '../components/layout/TerminalResultsLayout';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useWorldState } from '../context/WorldStateContext';
import { useTerminal } from '../context/TerminalContext';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { useImmersiveScreenPadding } from '../hooks/useImmersiveScreenPadding';
import { formatDebriefResourceLine } from '../data/runDebriefResourceEngine';
import { formatExtractionKindLabel, sponsorDisplayName } from '../utils/contractUi';
import { getResourceDisplayName } from '../data/resourceRegistry';
import { formatTimeAliveMmSs } from '../types/runDeathSummary';
import {
  formatCommunityProgressLine,
  formatProgressThisRunLine,
  filterDebriefCompletionEffectLines,
} from '../utils/operationDebriefUi';

const TERMINAL_ACCENT = '#00ff33';
const FAILURE_ACCENT = '#ef4444';

export default function OperationDebriefScreen(): React.JSX.Element | null {
  const { theme } = useTerminal();
  const { pendingDebrief, clearPendingDebrief, tickAfterRunComplete } = useWorldState();
  const { appendHubLog } = usePlayerAccount();
  const { goToHub } = useGameFlow();
  const immersivePadding = useImmersiveScreenPadding();

  if (!pendingDebrief) {
    return null;
  }

  const {
    runOutcome,
    sectorName,
    operationTitle,
    contribution,
    progressBeforePct,
    progressAfterPct,
    totalContributionThisRun,
    completed,
    completionLogLines,
    credits,
    riftIron,
    residueVaulted,
    nextOperationTitle,
    contractResult,
    resourceSections,
    extractionKind,
    deathStats,
    midRunContributionTransmitted,
  } = pendingDebrief;

  const isFailure = runOutcome === 'FAILED';
  const accentColor = isFailure ? FAILURE_ACCENT : TERMINAL_ACCENT;
  const progressThisRunLine = formatProgressThisRunLine({
    totalContributionThisRun,
    progressBeforePct,
    progressAfterPct,
    midRunTransmitted: midRunContributionTransmitted,
    extractedSuccessfully: !isFailure,
  });
  const communityProgressLine = formatCommunityProgressLine(progressBeforePct, progressAfterPct);
  const hasExtractContribution = contribution.breakdown.length > 0;
  const showNoProgressGenerated = totalContributionThisRun <= 0;
  const completionEffectLines = filterDebriefCompletionEffectLines(completionLogLines);

  const handleContinue = () => {
    appendHubLog(
      `>> RUN DEBRIEF — ${sectorName.toUpperCase()} // ${runOutcome} // +${totalContributionThisRun} OPERATION`,
    );
    if (contractResult.status === 'SUCCESS') {
      appendHubLog(
        `>> CONTRACT PAID — ${contractResult.title.toUpperCase()} // +${contractResult.creditsAwarded + contractResult.bonusCreditsAwarded} CR`,
      );
    }
    if (completed) {
      completionLogLines.forEach((line) => appendHubLog(line));
      if (nextOperationTitle) {
        appendHubLog(`>> NEW OPERATION ACTIVE: ${nextOperationTitle.toUpperCase()}`);
      }
    }
    if (isFailure) {
      tickAfterRunComplete();
    }
    clearPendingDebrief();
    goToHub();
  };

  return (
    <TerminalSafeArea style={immersivePadding}>
      <TerminalResultsLayout
        accentBorderColor={`${accentColor}44`}
        narrative={(
          <>
            <Text style={[styles.title, { color: accentColor }]}>RUN DEBRIEF</Text>
            <Text style={[styles.subtitle, { color: theme.textColor }]}>
              {sectorName.toUpperCase()} // {operationTitle.toUpperCase()}
            </Text>
            <Text style={[styles.body, { color: theme.mutedColor }]}>
              {isFailure
                ? 'Incursion failed. Banked safehouse cargo routed to hub stash; unbanked cargo lost.'
                : 'Sector extraction secured. Payload archived to hub stash.'}
            </Text>
            {completed ? (
              <Text style={[styles.completeBanner, { color: TERMINAL_ACCENT }]}>
                OPERATION COMPLETE
              </Text>
            ) : null}
          </>
        )}
        summary={(
          <View style={[styles.statsBox, { borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>RUN OUTCOME</Text>
            <Text style={[styles.statAccent, { color: accentColor }]}>
              {runOutcome === 'EXTRACTED' ? 'EXTRACTION SECURED' : 'INCURSION FAILED'}
            </Text>
            {runOutcome === 'EXTRACTED' ? (
              <Text style={[styles.stat, { color: theme.mutedColor }]}>
                {formatExtractionKindLabel(extractionKind).toUpperCase()}
              </Text>
            ) : null}

            {deathStats ? (
              <>
                <View style={styles.sectionGap} />
                <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>RUN STATS</Text>
                <Text style={[styles.stat, { color: theme.primaryColor }]}>
                  {`TIME ALIVE: ${formatTimeAliveMmSs(deathStats.timeAliveMs)}`}
                </Text>
                <Text style={[styles.stat, { color: FAILURE_ACCENT }]}>
                  {`CAUSE: ${deathStats.causeOfDeath.toUpperCase()}`}
                </Text>
                <Text style={[styles.stat, { color: theme.mutedColor }]}>
                  {`LEVEL ${deathStats.sectorLevel} // DEPTH ${deathStats.depthLayer}`}
                </Text>
              </>
            ) : null}

            {runOutcome === 'EXTRACTED' ? (
              <>
                <View style={styles.sectionGap} />
                <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>EXTRACTION PAYOUT</Text>
                <Text style={[styles.stat, { color: theme.primaryColor }]}>
                  +{credits} CREDITS // +{riftIron} RIFT IRON
                </Text>
                {residueVaulted > 0 ? (
                  <Text style={[styles.stat, { color: theme.mutedColor }]}>
                    +{residueVaulted} VEIL RESIDUE VAULTED
                  </Text>
                ) : null}
              </>
            ) : null}

            <View style={styles.sectionGap} />

            <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>CONTRACT RESULT</Text>
            {contractResult.status === 'NONE' ? (
              <Text style={[styles.stat, { color: theme.mutedColor }]}>
                Independent Breach — no sponsor contract.
              </Text>
            ) : (
              <>
                <Text style={[styles.stat, { color: theme.textColor }]}>
                  {contractResult.title.toUpperCase()}
                </Text>
                {contractResult.sponsorId ? (
                  <Text style={[styles.stat, { color: theme.mutedColor }]}>
                    {sponsorDisplayName(contractResult.sponsorId).toUpperCase()}
                  </Text>
                ) : null}
                <Text style={[styles.stat, { color: theme.mutedColor }]}>
                  {contractResult.progressText}
                </Text>
                <Text
                  style={[
                    styles.statAccent,
                    { color: contractResult.status === 'SUCCESS' ? TERMINAL_ACCENT : FAILURE_ACCENT },
                  ]}
                >
                  {contractResult.status === 'SUCCESS' ? 'CONTRACT COMPLETE' : 'CONTRACT FAILED'}
                </Text>
                {contractResult.status === 'SUCCESS' ? (
                  <>
                    <Text style={[styles.stat, { color: theme.statusColor }]}>
                      {`+${contractResult.creditsAwarded + contractResult.bonusCreditsAwarded} CR // +${contractResult.reputationAwarded + contractResult.bonusReputationAwarded} REP`}
                    </Text>
                    {contractResult.resourceBonusIds.length > 0 ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {`Bonus cargo: ${contractResult.resourceBonusIds.map((id) => getResourceDisplayName(id, true)).join(', ')}`}
                      </Text>
                    ) : null}
                    {contractResult.bonusObjectiveText ? (
                      <Text style={[styles.stat, { color: contractResult.bonusObjectiveMet ? theme.statusColor : theme.mutedColor }]}>
                        {`Bonus: ${contractResult.bonusObjectiveText}${contractResult.bonusObjectiveMet ? ' — MET' : contractResult.bonusProgressText ? ` — ${contractResult.bonusProgressText}` : ' — MISSED'}`}
                      </Text>
                    ) : null}
                  </>
                ) : contractResult.bonusProgressText ? (
                  <Text style={[styles.stat, { color: theme.mutedColor }]}>
                    {contractResult.bonusProgressText}
                  </Text>
                ) : null}
              </>
            )}

            {resourceSections.length > 0 ? (
              <>
                <View style={styles.sectionGap} />
                <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>RESOURCE RESOLUTION</Text>
                {resourceSections.map((section) => (
                  <View key={section.group} style={styles.resourceBlock}>
                    <Text style={[styles.stat, { color: theme.textColor, fontWeight: '700' }]}>
                      {section.title.toUpperCase()} ({section.totalItems})
                    </Text>
                    {section.lines.map((line) => (
                      <Text key={`${section.group}-${line.resourceId}`} style={[styles.stat, { color: theme.mutedColor }]}>
                        {formatDebriefResourceLine(line)}
                      </Text>
                    ))}
                  </View>
                ))}
              </>
            ) : null}

            <View style={styles.sectionGap} />

            <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>OPERATION CONTRIBUTION</Text>
            <Text
              style={[
                styles.statAccent,
                { color: showNoProgressGenerated ? theme.mutedColor : accentColor },
              ]}
            >
              {progressThisRunLine.toUpperCase()}
            </Text>
            {(midRunContributionTransmitted ?? 0) > 0 ? (
              <Text style={[styles.stat, { color: theme.statusColor }]}>
                {`Mid-incursion transmission: +${midRunContributionTransmitted}`}
              </Text>
            ) : null}
            {hasExtractContribution ? (
              contribution.breakdown.map((line) => (
                <Text key={line} style={[styles.stat, { color: theme.textColor }]}>
                  {line}
                </Text>
              ))
            ) : showNoProgressGenerated ? (
              <Text style={[styles.stat, { color: theme.mutedColor }]}>
                No qualifying run events credited toward this operation.
              </Text>
            ) : null}
            {!showNoProgressGenerated ? (
              <Text style={[styles.statAccent, { color: accentColor }]}>
                TOTAL THIS RUN: +{totalContributionThisRun}
                {isFailure ? ' (not applied — extraction required)' : ''}
              </Text>
            ) : null}

            <View style={styles.sectionGap} />

            <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>COMMUNITY PROGRESS</Text>
            <Text style={[styles.stat, { color: theme.textColor }]}>
              {communityProgressLine.toUpperCase()}
            </Text>

            {completed && completionEffectLines.length > 0 ? (
              <>
                <View style={styles.sectionGap} />
                <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>COMPLETION EFFECTS</Text>
                {completionEffectLines.map((line) => (
                  <Text key={line} style={[styles.stat, { color: theme.mutedColor }]}>
                    {line.replace(/^>>\s*/, '')}
                  </Text>
                ))}
                {nextOperationTitle ? (
                  <Text style={[styles.statAccent, { color: theme.statusColor }]}>
                    NEXT: {nextOperationTitle.toUpperCase()}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        )}
        footer={(
          <HapticPressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.button,
              { borderColor: accentColor, backgroundColor: pressed ? '#0d1a12' : '#0e1624' },
            ]}
          >
            <Text style={[styles.buttonLabel, { color: accentColor }]}>[ RETURN TO OPERATIONAL BRIEFING ]</Text>
          </HapticPressable>
        )}
      />
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  completeBanner: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 16,
  },
  statsBox: {
    borderWidth: 1,
    padding: 16,
    gap: 4,
    backgroundColor: 'rgba(10, 11, 15, 0.88)',
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 2,
  },
  sectionGap: {
    height: 10,
  },
  resourceBlock: {
    gap: 2,
    marginTop: 4,
  },
  stat: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  statAccent: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  button: {
    borderWidth: 2,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonLabel: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
