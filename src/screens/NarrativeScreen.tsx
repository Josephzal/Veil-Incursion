import React, { useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import NarrativeStepperModule, { isCityStreetsNarrative } from '../components/NarrativeStepperModule';
import ProceduralNarrativeModule from '../components/ProceduralNarrativeModule';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { isProceduralNarrative } from '../data/sectorNarrativeEngine';
import { CheckStatus, NarrativeChoiceKey } from '../types/game';
import { narrativeSuccessCredits } from '../data/combatCredits';
import { depthFromNodesCleared } from '../data/districtPacing';

export default function NarrativeScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { getCurrentNarrativeNode, resolveNarrativeChoice, appendRunLog, awardRunCredits, runState, activeIncursion } = useRun();
  const { startResourceHarvest, startScanning } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const resolvingRef = useRef(false);

  const node = getCurrentNarrativeNode();
  const isProcedural = node != null && isProceduralNarrative(node);

  const finishNarrative = (choice: NarrativeChoiceKey, status: CheckStatus = 'SUCCESS') => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;

    const { outcomeText, aborted, creditReward, requiresResourcePack } = resolveNarrativeChoice(choice, status);
    appendRunLog(outcomeText);

    if (aborted) {
      resolvingRef.current = false;
      startScanning();
      return;
    }

    if (creditReward > 0) {
      awardRunCredits(creditReward, 'procedural narrative resolver');
    } else if (status !== 'FAILURE' && !requiresResourcePack) {
      const depth = depthFromNodesCleared(activeIncursion.nodesCleared);
      awardRunCredits(narrativeSuccessCredits(depth), 'narrative calibration cleared');
    }

    if (requiresResourcePack) {
      appendRunLog('>> RESOURCE CACHE STAGED — PACK CARGO BEFORE VECTOR RESUME.');
      resolvingRef.current = false;
      startResourceHarvest();
      return;
    }

    appendRunLog('>> NARRATIVE NODE RESOLVED — RETURNING TO LEY-LINE GRID.');
    finalizeIncursionAdvance('Narrative event cleared.');
  };

  const handleLegacyComplete = (result: { choice: 'A' | 'B'; status: CheckStatus }) => {
    finishNarrative(result.choice, result.status);
  };

  const handleProceduralResolve = (choice: NarrativeChoiceKey, status: CheckStatus = 'SUCCESS') => {
    finishNarrative(choice, status);
  };

  if (!node) {
    return (
      <IncursionShell>
        <MacroLogAnchoredLayout
          showMacroLog={runState.runActive}
          style={{ backgroundColor: theme.backgroundColor }}
        >
          <View style={[styles.body, { backgroundColor: theme.backgroundColor }]}>
            <Text style={[styles.fallback, { color: theme.mutedColor }]}>
              NO ACTIVE NARRATIVE VECTOR — AWAITING MAP COORDINATOR.
            </Text>
          </View>
        </MacroLogAnchoredLayout>
      </IncursionShell>
    );
  }

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.body}>
          <View style={[styles.content, isCityStreetsNarrative(node) && styles.contentCityStreets]}>
            {isProcedural ? (
              <ProceduralNarrativeModule
                node={node}
                onResolve={handleProceduralResolve}
                borderColor={theme.borderColor}
                mutedColor={theme.mutedColor}
                primaryColor={theme.primaryColor}
              />
            ) : (
              <NarrativeStepperModule
                node={node}
                onComplete={handleLegacyComplete}
                borderColor={theme.borderColor}
                mutedColor={theme.mutedColor}
                primaryColor={theme.primaryColor}
              />
            )}
          </View>
        </View>
      </MacroLogAnchoredLayout>
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
