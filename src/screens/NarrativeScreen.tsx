import React, { useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import NarrativeStepperModule, { isCityStreetsNarrative } from '../components/NarrativeStepperModule';
import ProceduralNarrativeModule from '../components/ProceduralNarrativeModule';
import IncursionRunLayout from '../components/IncursionRunLayout';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useLandscapeMetrics } from '../hooks/useLandscapeMetrics';
import { isProceduralNarrative } from '../data/sectorNarrativeEngine';
import { CheckStatus, NarrativeChoiceKey } from '../types/game';
import { resolveNarrativeCreditPayout } from '../data/combatCredits';

export default function NarrativeScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { useHorizontalSplit } = useLandscapeMetrics();
  const {
    getCurrentNarrativeNode,
    resolveNarrativeChoice,
    appendRunLog,
    awardRunCredits,
    runState,
    activeIncursion,
    prepareStandardCombatEncounter,
    getCurrentEncounterNode,
  } = useRun();
  const { startResourceHarvest, startScanning, startCombat } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const resolvingRef = useRef(false);

  const node = getCurrentNarrativeNode();
  const isProcedural = node != null && isProceduralNarrative(node);

  const finishNarrative = (
    choice: NarrativeChoiceKey,
    status: CheckStatus = 'SUCCESS',
    options?: { tensionBonusCredits?: number },
  ) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;

    const {
      outcomeText,
      aborted,
      creditReward,
      requiresResourcePack,
      triggerCombatAmbush,
    } = resolveNarrativeChoice(choice, status, options);
    appendRunLog(outcomeText);

    if (aborted) {
      resolvingRef.current = false;
      startScanning();
      return;
    }

    const totalCredits = resolveNarrativeCreditPayout(
      creditReward,
      status === 'FAILURE' ? 'FAILURE' : 'SUCCESS',
    );
    if (totalCredits > 0) {
      awardRunCredits(totalCredits, options?.tensionBonusCredits
        ? 'narrative tension salvage + resolver payout'
        : creditReward > 0
          ? 'procedural narrative resolver'
          : 'narrative calibration cleared');
    }

    if (requiresResourcePack) {
      appendRunLog('>> RESOURCE CACHE STAGED — PACK CARGO BEFORE VECTOR RESUME.');
      resolvingRef.current = false;
      startResourceHarvest();
      return;
    }

    if (triggerCombatAmbush) {
      appendRunLog('>> NARRATIVE AMBUSH — HOSTILE SIGNATURES LOCKED.');
      prepareStandardCombatEncounter(getCurrentEncounterNode());
      resolvingRef.current = false;
      startCombat();
      return;
    }

    appendRunLog('>> NARRATIVE NODE RESOLVED — RETURNING TO LEY-LINE GRID.');
    finalizeIncursionAdvance('Narrative event cleared.');
  };

  const handleLegacyComplete = (result: { choice: 'A' | 'B'; status: CheckStatus }) => {
    finishNarrative(result.choice, result.status);
  };

  const handleProceduralResolve = (
    choice: NarrativeChoiceKey,
    status: CheckStatus = 'SUCCESS',
    options?: { tensionBonusCredits?: number },
  ) => {
    finishNarrative(choice, status, options);
  };

  if (!node) {
    return (
      <IncursionShell>
        <IncursionRunLayout
          style={{ backgroundColor: theme.backgroundColor }}
        >
          <View style={[styles.body, { backgroundColor: theme.backgroundColor }]}>
            <Text style={[styles.fallback, { color: theme.mutedColor }]}>
              NO ACTIVE NARRATIVE VECTOR — AWAITING MAP COORDINATOR.
            </Text>
          </View>
        </IncursionRunLayout>
      </IncursionShell>
    );
  }

  return (
    <IncursionShell>
      <IncursionRunLayout
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.body}>
          <View style={[styles.content, isCityStreetsNarrative(node) && styles.contentCityStreets]}>
            {isProcedural ? (
              <ProceduralNarrativeModule
                node={node}
                onResolve={handleProceduralResolve}
                splitLayout={useHorizontalSplit}
                borderColor={theme.borderColor}
                mutedColor={theme.mutedColor}
                primaryColor={theme.primaryColor}
              />
            ) : (
              <NarrativeStepperModule
                node={node}
                onComplete={handleLegacyComplete}
                splitLayout={useHorizontalSplit}
                borderColor={theme.borderColor}
                mutedColor={theme.mutedColor}
                primaryColor={theme.primaryColor}
              />
            )}
          </View>
        </View>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  contentCityStreets: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  fallback: {
    fontFamily: 'monospace',
    fontSize: 10,
    textAlign: 'center',
    padding: 24,
    letterSpacing: 0.8,
  },
});
