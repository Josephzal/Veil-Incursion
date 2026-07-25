import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import SelectionContinueButton from './SelectionContinueButton';
import NarrativeOutcomePanel from './narrative/NarrativeOutcomePanel';
import TensionMechanicHost from './narrative/tension/TensionMechanicHost';
import { formatTensionMechanicLabel } from './narrative/tension/tensionMechanicTypes';
import { CheckStatus, NarrativeChoiceEffectPreview, NarrativeEventNode } from '../types/game';
import {
  buildLegacyOutcomeSummary,
  type NarrativeOutcomeSummary,
} from '../data/narrative/narrativeOutcomeSummary';
import {
  NARRATIVE_CHOICE_GAP,
  NARRATIVE_CHOICE_PADDING_H,
  NARRATIVE_CHOICE_PADDING_V,
  NARRATIVE_DIVIDER_COLOR,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../constants/narrativeLayout';
import { DOSSIER_CTA_BG, DOSSIER_ROW_BG } from '../constants/dossierSurface';
import DossierCardShell from './hub/DossierCardShell';
import type { TensionMechanic } from '../types/narrativeAssembly';

const TERMINAL_ACCENT = '#00ff33';

type StepperPhase = 'SCENARIO' | 'TENSION' | 'OUTCOME';

interface PendingLegacyResolve {
  choice: 'A' | 'B';
  status: CheckStatus;
}

export function isCityStreetsNarrative(node: NarrativeEventNode): boolean {
  const eventId = node.matrixEventId ?? node.id;
  return eventId.startsWith('city-');
}

function ChoiceEffectPreview({
  preview,
  mutedColor,
}: {
  preview: NarrativeChoiceEffectPreview;
  mutedColor: string;
}): React.JSX.Element | null {
  if (preview.guaranteed) {
    return (
      <Text style={[styles.choiceEffectLine, { color: mutedColor }]}>
        {`EFFECT // ${preview.guaranteed}`}
      </Text>
    );
  }

  const lines: React.JSX.Element[] = [];
  if (preview.onSuccess) {
    lines.push(
      <Text key="success" style={[styles.choiceEffectLine, styles.choiceEffectSuccess]}>
        {`CALIBRATION // ${preview.onSuccess}`}
      </Text>,
    );
  }
  if (preview.onFailure) {
    lines.push(
      <Text key="failure" style={[styles.choiceEffectLine, styles.choiceEffectFailure]}>
        {`MISCALIBRATION // ${preview.onFailure}`}
      </Text>,
    );
  }
  if (lines.length === 0) return null;
  return <View style={styles.choiceEffectCol}>{lines}</View>;
}

interface NarrativeStepperModuleProps {
  node: NarrativeEventNode;
  onComplete: (result: { choice: 'A' | 'B'; status: CheckStatus }) => void;
  borderColor?: string;
  mutedColor?: string;
  primaryColor?: string;
}

export default function NarrativeStepperModule({
  node,
  onComplete,
  borderColor = '#334155',
  mutedColor = '#94a3b8',
  primaryColor = '#f8fafc',
}: NarrativeStepperModuleProps): React.JSX.Element {
  const [phase, setPhase] = useState<StepperPhase>('SCENARIO');
  const [selectedChoice, setSelectedChoice] = useState<'A' | 'B' | null>(null);
  const [outcomeSummary, setOutcomeSummary] = useState<NarrativeOutcomeSummary | null>(null);
  const [pendingResolve, setPendingResolve] = useState<PendingLegacyResolve | null>(null);

  const tensionMechanic: TensionMechanic | undefined =
    node.proceduralMeta?.tensionMechanic;
  const tensionMechanicLabel = formatTensionMechanicLabel(tensionMechanic);

  const handleChoiceSelect = (choice: 'A' | 'B') => {
    setSelectedChoice(choice);
  };

  const showOutcome = (choice: 'A' | 'B', status: CheckStatus) => {
    const summary = buildLegacyOutcomeSummary(node, choice, status);
    setOutcomeSummary(summary);
    setPendingResolve({ choice, status });
    setPhase('OUTCOME');
  };

  const handleScenarioContinue = () => {
    if (!selectedChoice) return;
    if (selectedChoice === 'A') {
      // Undefined mechanic is intentional "no tension" — not a silent ScavengeBar fallback.
      if (!tensionMechanic) {
        showOutcome('A', 'SUCCESS');
        return;
      }
      setPhase('TENSION');
      return;
    }
    showOutcome('B', 'SUCCESS');
  };

  const handleTensionSuccess = () => {
    showOutcome('A', 'SUCCESS');
  };

  const handleTensionFailure = () => {
    showOutcome('A', 'FAILURE');
  };

  const handleContinue = () => {
    if (!pendingResolve) return;
    onComplete(pendingResolve);
  };

  return (
    <DossierCardShell
      fillHeight
      padding={NARRATIVE_UNIFIED_PANEL_PADDING}
      style={styles.root}
      contentStyle={styles.shellContent}
    >
      <View style={styles.header}>
        <Text style={[styles.docLabel, { color: mutedColor }]}>
          EXPEDITION LOG // RESOLVER TERMINAL
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: NARRATIVE_DIVIDER_COLOR }]} />

      {phase === 'SCENARIO' ? (
        <View style={styles.scenarioLayout}>
          <View style={styles.decisionDock}>
            <View style={styles.choiceCol}>
              <HapticPressable
                onPress={() => handleChoiceSelect('A')}
                style={({ pressed }) => [
                  styles.choiceBtn,
                  selectedChoice === 'A' && styles.choiceBtnSelected,
                  {
                    borderColor: selectedChoice === 'A' ? TERMINAL_ACCENT : borderColor,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.choiceLabel,
                    { color: selectedChoice === 'A' ? TERMINAL_ACCENT : primaryColor },
                  ]}
                >
                  {node.choiceA.label}
                </Text>
                <Text style={[styles.choiceReq, { color: mutedColor }]}>
                  REQ: {node.choiceA.requirement}
                </Text>
                {node.choiceA.effectPreview ? (
                  <ChoiceEffectPreview preview={node.choiceA.effectPreview} mutedColor={mutedColor} />
                ) : null}
              </HapticPressable>
              <HapticPressable
                onPress={() => !node.choiceB.locked && handleChoiceSelect('B')}
                disabled={node.choiceB.locked === true}
                style={({ pressed }) => [
                  styles.choiceBtn,
                  selectedChoice === 'B' && styles.choiceBtnSelected,
                  {
                    borderColor: selectedChoice === 'B' ? TERMINAL_ACCENT : borderColor,
                    opacity: node.choiceB.locked ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.choiceLabel,
                    { color: selectedChoice === 'B' ? TERMINAL_ACCENT : primaryColor },
                  ]}
                >
                  {node.choiceB.label}
                </Text>
                <Text style={[styles.choiceReq, { color: mutedColor }]}>
                  REQ: {node.choiceB.locked && node.choiceB.lockReason
                    ? node.choiceB.lockReason
                    : node.choiceB.requirement}
                </Text>
                {node.choiceB.effectPreview ? (
                  <ChoiceEffectPreview preview={node.choiceB.effectPreview} mutedColor={mutedColor} />
                ) : null}
              </HapticPressable>
            </View>
            <SelectionContinueButton
              enabled={selectedChoice != null}
              onPress={handleScenarioContinue}
              label={selectedChoice === 'A' ? '[ ENGAGE TENSION PROTOCOL ]' : '[ CONFIRM CHOICE]'}
              borderColor={borderColor}
              mutedColor={mutedColor}
              size="sm"
              style={styles.continueBtn}
            />
          </View>
        </View>
      ) : null}

      {phase === 'TENSION' ? (
        <View style={styles.tensionArea}>
          <TensionMechanicHost
            tensionMechanic={tensionMechanic}
            onSuccess={handleTensionSuccess}
            onFailure={handleTensionFailure}
            defaultPenalty={node.proceduralMeta?.defaultPenalty}
            difficulty={node.proceduralMeta?.tensionDifficulty}
            narrativeEventId={node.id}
            fallbackLabel={tensionMechanicLabel}
            borderColor={borderColor}
            mutedColor={mutedColor}
            primaryColor={primaryColor}
          />
        </View>
      ) : null}

      {phase === 'OUTCOME' && outcomeSummary ? (
        <NarrativeOutcomePanel
          summary={outcomeSummary}
          onContinue={handleContinue}
          borderColor={borderColor}
          mutedColor={mutedColor}
          primaryColor={primaryColor}
        />
      ) : null}
    </DossierCardShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  shellContent: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexShrink: 0,
    paddingBottom: 8,
  },
  divider: {
    height: 1,
    flexShrink: 0,
    marginBottom: 10,
  },
  scenarioLayout: {
    flex: 1,
    minHeight: 0,
  },
  decisionDock: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-end',
    paddingTop: 8,
    gap: 6,
  },
  tensionArea: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  docLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1,
  },
  choiceCol: {
    gap: NARRATIVE_CHOICE_GAP,
    width: '100%',
  },
  choiceBtn: {
    borderWidth: 1,
    paddingVertical: NARRATIVE_CHOICE_PADDING_V,
    paddingHorizontal: NARRATIVE_CHOICE_PADDING_H,
    width: '100%',
    backgroundColor: DOSSIER_ROW_BG,
  },
  choiceBtnSelected: {
    backgroundColor: DOSSIER_CTA_BG,
  },
  choiceLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  choiceReq: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.6,
    lineHeight: 10,
  },
  choiceEffectCol: {
    gap: 2,
    marginTop: 2,
  },
  choiceEffectLine: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.4,
    lineHeight: 9,
  },
  choiceEffectSuccess: {
    color: '#4ade80',
  },
  choiceEffectFailure: {
    color: '#f87171',
  },
  continueBtn: {
    marginTop: 0,
    width: '100%',
  },
});
