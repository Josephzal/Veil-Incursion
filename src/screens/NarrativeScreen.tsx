import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import NarrativeStepperModule from '../components/NarrativeStepperModule';
import ProceduralNarrativeModule from '../components/ProceduralNarrativeModule';
import NarrativeArtTerminalFrame from '../components/narrative/NarrativeArtTerminalFrame';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventImmersiveBackdrop from '../components/layout/RunEventImmersiveBackdrop';
import TerminalOverlay from '../components/TerminalOverlay';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useDevSandboxExit } from '../hooks/useDevSandboxExit';
import { isProceduralNarrative } from '../data/sectorNarrativeEngine';
import { CheckStatus, NarrativeChoiceKey } from '../types/game';
import { resolveNarrativeCreditPayout } from '../data/combatCredits';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import { resolveRunEventNodeHeaderFromNode } from '../utils/resolveRunEventNodeHeader';
import { resolveNarrativeBackgroundImage } from '../utils/resolveNarrativeBackground';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

export default function NarrativeScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    getCurrentNarrativeNode,
    resolveNarrativeChoice,
    appendRunLog,
    awardRunCredits,
    prepareStandardCombatEncounter,
    getCurrentEncounterNode,
    getSelectedVectorNode,
  } = useRun();
  const { startResourceHarvest, startScanning, startCombat } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const { exitToDevTestHub } = useDevSandboxExit();
  const { fontScale } = useResponsiveLayout();
  const resolvingRef = useRef(false);

  const node = getCurrentNarrativeNode();
  const vectorNode = getSelectedVectorNode();
  const headerCopy = resolveRunEventNodeHeaderFromNode(
    vectorNode,
    'NARRATIVE EVENT',
    'ANOMALY RESOLVER',
  );
  const isProcedural = node != null && isProceduralNarrative(node);

  const backgroundImage = useMemo(
    () => (node ? resolveNarrativeBackgroundImage(node) : null),
    [node],
  );

  const finishNarrative = (
    choice: NarrativeChoiceKey,
    status: CheckStatus = 'SUCCESS',
    options?: { tensionBonusCredits?: number },
  ) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;

    if (exitToDevTestHub()) {
      resolvingRef.current = false;
      return;
    }

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

  if (!node || !backgroundImage) {
    return (
      <IncursionShell>
        <IncursionRunLayout hideRunChrome style={{ backgroundColor: theme.backgroundColor }}>
          <View style={[styles.fallbackHost, { backgroundColor: theme.backgroundColor }]}>
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
      <IncursionRunLayout hideRunChrome style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventImmersiveBackdrop
          backgroundImage={backgroundImage}
          contentPadding={16 * fontScale}
          scrimOpacity={0}
          overlay={<TerminalOverlay />}
        >
          <View style={styles.masterShell}>
            <RunEventNodeHeader
              title={headerCopy.title}
              subtitle={headerCopy.subtitle}
              fontScale={fontScale}
              showRunChrome
            />

            <View style={styles.bodyStage}>
              <NarrativeArtTerminalFrame
                flavorText={node.scenarioText}
                flavorPrimaryColor={theme.primaryColor}
                flavorMutedColor={theme.mutedColor}
              >
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
              </NarrativeArtTerminalFrame>
            </View>
          </View>
        </RunEventImmersiveBackdrop>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  masterShell: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'stretch',
  },
  bodyStage: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
  },
  fallbackHost: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fallback: {
    fontFamily: 'monospace',
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
});
