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

const TERMINAL_ACCENT = '#00ff33';

export default function OperationDebriefScreen(): React.JSX.Element | null {
  const { theme } = useTerminal();
  const { pendingDebrief, clearPendingDebrief } = useWorldState();
  const { appendHubLog } = usePlayerAccount();
  const { goToHub } = useGameFlow();
  const immersivePadding = useImmersiveScreenPadding();

  if (!pendingDebrief) {
    return null;
  }

  const {
    sectorName,
    operationTitle,
    contribution,
    progressBeforePct,
    progressAfterPct,
    completed,
    completionLogLines,
    credits,
    riftIron,
    residueVaulted,
    nextOperationTitle,
  } = pendingDebrief;

  const handleContinue = () => {
    appendHubLog(
      `>> OPERATION DEBRIEF — ${sectorName.toUpperCase()} // +${contribution.total} CONTRIBUTION // ${progressBeforePct}% → ${progressAfterPct}%`,
    );
    if (completed) {
      completionLogLines.forEach((line) => appendHubLog(line));
      if (nextOperationTitle) {
        appendHubLog(`>> NEW OPERATION ACTIVE: ${nextOperationTitle.toUpperCase()}`);
      }
    }
    clearPendingDebrief();
    goToHub();
  };

  return (
    <TerminalSafeArea style={immersivePadding}>
      <TerminalResultsLayout
        accentBorderColor={`${TERMINAL_ACCENT}44`}
        narrative={(
          <>
            <Text style={[styles.title, { color: TERMINAL_ACCENT }]}>OPERATION DEBRIEF</Text>
            <Text style={[styles.subtitle, { color: theme.textColor }]}>
              {sectorName.toUpperCase()} // {operationTitle.toUpperCase()}
            </Text>
            <Text style={[styles.body, { color: theme.mutedColor }]}>
              Sector extraction secured. Operation telemetry archived to Veil Front.
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
            <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>EXTRACTION PAYOUT</Text>
            <Text style={[styles.stat, { color: theme.primaryColor }]}>
              +{credits} CREDITS // +{riftIron} RIFT IRON
            </Text>
            {residueVaulted > 0 ? (
              <Text style={[styles.stat, { color: theme.mutedColor }]}>
                +{residueVaulted} VEIL RESIDUE VAULTED
              </Text>
            ) : null}

            <View style={styles.sectionGap} />

            <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>OPERATION CONTRIBUTION</Text>
            {contribution.breakdown.length > 0 ? (
              contribution.breakdown.map((line) => (
                <Text key={line} style={[styles.stat, { color: theme.textColor }]}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={[styles.stat, { color: theme.mutedColor }]}>No operation credit this run.</Text>
            )}
            <Text style={[styles.statAccent, { color: TERMINAL_ACCENT }]}>
              TOTAL CONTRIBUTION: +{contribution.total}
            </Text>

            <View style={styles.sectionGap} />

            <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>COMMUNITY PROGRESS</Text>
            <Text style={[styles.stat, { color: theme.textColor }]}>
              {`${progressBeforePct}% → ${progressAfterPct}%`}
            </Text>

            {completed && completionLogLines.length > 0 ? (
              <>
                <View style={styles.sectionGap} />
                <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>COMPLETION EFFECTS</Text>
                {completionLogLines
                  .filter((line) => line.includes('OPERATION COMPLETE')
                    || line.includes('DORMANT')
                    || line.includes('REWARD SURGE')
                    || line.includes('NEW OPERATION'))
                  .map((line) => (
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
              { borderColor: TERMINAL_ACCENT, backgroundColor: pressed ? '#0d1a12' : '#0e1624' },
            ]}
          >
            <Text style={styles.buttonLabel}>[ RETURN TO OPERATIONAL BRIEFING ]</Text>
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
    color: TERMINAL_ACCENT,
    letterSpacing: 1.2,
  },
});
