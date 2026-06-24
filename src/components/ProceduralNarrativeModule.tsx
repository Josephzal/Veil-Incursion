import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import type { NarrativeChoiceKey, NarrativeChoiceOption, NarrativeEventNode, CheckStatus } from '../types/game';
import TensionMechanicHost from './narrative/tension/TensionMechanicHost';
import NarrativeOutcomePanel from './narrative/NarrativeOutcomePanel';
import { formatTensionMechanicLabel } from './narrative/tension/tensionMechanicTypes';
import {
  buildProceduralOutcomeSummary,
  formatBonusLine,
} from '../data/narrative/narrativeOutcomeSummary';
import type { NarrativeOutcomeSummary } from '../data/narrative/narrativeOutcomeSummary';
import {
  NARRATIVE_CHOICE_GAP,
  NARRATIVE_CHOICE_PADDING_H,
  NARRATIVE_CHOICE_PADDING_V,
  NARRATIVE_DIVIDER_COLOR,
} from '../constants/narrativeLayout';

const TERMINAL_ACCENT = '#00ff33';

type ModulePhase = 'SCENARIO' | 'TENSION' | 'OUTCOME';

interface PendingResolve {
  choice: NarrativeChoiceKey;
  status: CheckStatus;
  options?: { tensionBonusCredits?: number };
}

type OptionDVariant = 'Retreat' | 'BruteForce';

function ChoiceEffectPreview({
  preview,
  mutedColor,
}: {
  preview: NonNullable<NarrativeChoiceOption['effectPreview']>;
  mutedColor: string;
}): React.JSX.Element | null {
  if (preview.guaranteed) {
    return (
      <Text style={[styles.choiceEffectLine, { color: mutedColor }]}>
        {preview.guaranteed}
      </Text>
    );
  }
  return null;
}

function getOptionDVariant(choiceD?: NarrativeChoiceOption): OptionDVariant | null {
  if (!choiceD) return null;
  const req = choiceD.requirement.toUpperCase();
  if (req.includes('RETURN TO MAP') || req.includes('RETURN TO SCANNER')) {
    return 'Retreat';
  }
  if (req.includes('GUARANTEED COST')) {
    return 'BruteForce';
  }
  if (choiceD.label.toUpperCase().includes('ABORT')) {
    return 'Retreat';
  }
  return 'BruteForce';
}

interface ProceduralNarrativeModuleProps {
  node: NarrativeEventNode;
  onResolve: (
    choice: NarrativeChoiceKey,
    status?: CheckStatus,
    options?: { tensionBonusCredits?: number },
  ) => void;
  borderColor?: string;
  mutedColor?: string;
  primaryColor?: string;
}

function ResolverButton({
  option,
  selected,
  onPress,
  borderColor,
  mutedColor,
  primaryColor,
  showLockIcon = false,
}: {
  option: NarrativeChoiceOption;
  selected: boolean;
  onPress: () => void;
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  showLockIcon?: boolean;
}): React.JSX.Element {
  const locked = option.locked === true;
  return (
    <HapticPressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.choiceBtn,
        selected && !locked && styles.choiceBtnSelected,
        locked && styles.choiceBtnLocked,
        {
          borderColor: selected && !locked ? TERMINAL_ACCENT : borderColor,
          opacity: locked ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.choiceLabelRow}>
        {locked && showLockIcon ? (
          <Text style={[styles.lockIcon, { color: mutedColor }]} accessibilityLabel="Locked">
            🔒
          </Text>
        ) : null}
        <Text
          style={[
            styles.choiceLabel,
            { color: selected && !locked ? TERMINAL_ACCENT : primaryColor },
            locked && styles.choiceLabelLocked,
          ]}
        >
          {option.label}
        </Text>
      </View>
      <Text style={[styles.choiceReq, { color: mutedColor }]}>
        {locked && option.lockReason ? option.lockReason : `REQ: ${option.requirement}`}
      </Text>
      {option.effectPreview ? (
        <ChoiceEffectPreview preview={option.effectPreview} mutedColor={mutedColor} />
      ) : null}
    </HapticPressable>
  );
}

export default function ProceduralNarrativeModule({
  node,
  onResolve,
  borderColor = '#334155',
  mutedColor = '#94a3b8',
  primaryColor = '#f8fafc',
}: ProceduralNarrativeModuleProps): React.JSX.Element {
  const [phase, setPhase] = useState<ModulePhase>('SCENARIO');
  const [selectedChoice, setSelectedChoice] = useState<NarrativeChoiceKey | null>(null);
  const [outcomeSummary, setOutcomeSummary] = useState<NarrativeOutcomeSummary | null>(null);
  const [pendingResolve, setPendingResolve] = useState<PendingResolve | null>(null);
  const [bonusLine, setBonusLine] = useState<string | null>(null);

  const optionDVariant = getOptionDVariant(node.choiceD);
  const choices: { key: NarrativeChoiceKey; option: NarrativeChoiceOption; showLockIcon: boolean }[] = [
    { key: 'A', option: node.choiceA, showLockIcon: false },
    { key: 'B', option: node.choiceB, showLockIcon: true },
    ...(node.choiceC ? [{ key: 'C' as const, option: node.choiceC, showLockIcon: true }] : []),
    ...(node.choiceD ? [{ key: 'D' as const, option: node.choiceD, showLockIcon: false }] : []),
  ];

  const selectedOption = choices.find((entry) => entry.key === selectedChoice)?.option;
  const tensionMechanicLabel = formatTensionMechanicLabel(node.proceduralMeta?.tensionMechanic);

  const showOutcome = (
    choice: NarrativeChoiceKey,
    status: CheckStatus = 'SUCCESS',
    options?: { tensionBonusCredits?: number },
  ) => {
    const summary = buildProceduralOutcomeSummary(node, choice, status, options);
    const bonusReward = node.proceduralMeta?.bonusReward;
    const showBonus = status === 'SUCCESS' && choice !== 'D' && bonusReward != null;
    setOutcomeSummary(summary);
    setBonusLine(showBonus ? formatBonusLine(bonusReward) : null);
    setPendingResolve({ choice, status, options });
    setPhase('OUTCOME');
  };

  const handleContinue = () => {
    if (!pendingResolve) return;
    onResolve(pendingResolve.choice, pendingResolve.status, pendingResolve.options);
  };

  const handleConfirm = () => {
    if (!selectedChoice || !selectedOption) return;
    if (selectedOption.locked) return;

    if (selectedChoice === 'A') {
      setPhase('TENSION');
      return;
    }

    finishWithResult(selectedChoice, selectedOption.successText);
  };

  const finishWithResult = (
    choice: NarrativeChoiceKey,
    _resultText: string,
    status: CheckStatus = 'SUCCESS',
    options?: { tensionBonusCredits?: number },
  ) => {
    showOutcome(choice, status, options);
  };

  const handleTensionSuccess = (result?: { bonusCredits?: number }) => {
    finishWithResult('A', node.choiceA.successText, 'SUCCESS', {
      tensionBonusCredits: result?.bonusCredits ?? 0,
    });
  };

  const handleTensionFailure = () => {
    finishWithResult('A', node.choiceA.failureText, 'FAILURE');
  };

  const confirmLabel = (() => {
    if (!selectedChoice) return '[ CONFIRM RESOLVER ]';
    if (selectedChoice === 'A') return '[ ENGAGE TENSION PROTOCOL ]';
    if (selectedChoice === 'D') {
      if (optionDVariant === 'Retreat') return '[ CONFIRM ABORT — RETURN TO MAP ]';
      return '[ CONFIRM BRUTE FORCE ]';
    }
    if (selectedChoice === 'B') return '[ CONFIRM CABAL BYPASS ]';
    if (selectedChoice === 'C') return '[ CONFIRM ITEM BYPASS ]';
    return '[ CONFIRM RESOLVER ]';
  })();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.docLabel, { color: mutedColor }]}>
          {phase === 'OUTCOME'
            ? 'EXPEDITION LOG // RESOLVE REPORT'
            : 'EXPEDITION LOG // PROCEDURAL ASSEMBLY'}
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: NARRATIVE_DIVIDER_COLOR }]} />

      {phase === 'SCENARIO' ? (
        <View style={styles.scenarioLayout}>
          <View style={styles.decisionDock}>
            <Text style={[styles.resolverHeader, { color: mutedColor }]}>
              SELECT EXPEDITION RESOLVER:
            </Text>
            <View style={styles.choiceCol}>
              {choices.map(({ key, option, showLockIcon }) => (
                <ResolverButton
                  key={key}
                  option={option}
                  selected={selectedChoice === key}
                  onPress={() => {
                    if (!option.locked) setSelectedChoice(key);
                  }}
                  borderColor={borderColor}
                  mutedColor={mutedColor}
                  primaryColor={primaryColor}
                  showLockIcon={showLockIcon}
                />
              ))}
              {selectedChoice === 'D' && optionDVariant ? (
                <Text style={[styles.optionDHint, { color: mutedColor }]}>
                  {optionDVariant === 'Retreat'
                    ? '>> RETREAT — aborts encounter and routes back to the ley-line grid.'
                    : '>> BRUTE FORCE — accepts guaranteed cost without tension protocol.'}
                </Text>
              ) : null}
            </View>
            <HapticPressable
              onPress={handleConfirm}
              disabled={selectedChoice == null || selectedOption?.locked === true}
              style={({ pressed }) => [
                styles.confirmBtn,
                {
                  borderColor: selectedChoice != null && !selectedOption?.locked
                    ? TERMINAL_ACCENT
                    : borderColor,
                  opacity: selectedChoice == null || selectedOption?.locked ? 0.4 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.confirmBtnText,
                  {
                    color: selectedChoice != null && !selectedOption?.locked
                      ? TERMINAL_ACCENT
                      : mutedColor,
                  },
                ]}
              >
                {confirmLabel}
              </Text>
            </HapticPressable>
          </View>
        </View>
      ) : null}

      {phase === 'TENSION' ? (
        <View style={styles.tensionArea}>
          <TensionMechanicHost
            tensionMechanic={node.proceduralMeta?.tensionMechanic ?? 'Mechanic_ScavengeBar'}
            onSuccess={handleTensionSuccess}
            onFailure={handleTensionFailure}
            defaultPenalty={node.proceduralMeta?.defaultPenalty}
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
          bonusLine={bonusLine}
          onContinue={handleContinue}
          borderColor={borderColor}
          mutedColor={mutedColor}
          primaryColor={primaryColor}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
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
    gap: 8,
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
  resolverHeader: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1,
  },
  choiceBtn: {
    borderWidth: 1,
    paddingVertical: NARRATIVE_CHOICE_PADDING_V,
    paddingHorizontal: NARRATIVE_CHOICE_PADDING_H,
    gap: 2,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  choiceBtnSelected: {
    backgroundColor: 'rgba(0, 255, 51, 0.08)',
  },
  choiceBtnLocked: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  choiceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockIcon: {
    fontSize: 8,
    lineHeight: 10,
  },
  choiceLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '600',
    flexShrink: 1,
  },
  choiceLabelLocked: {
    color: '#94a3b8',
  },
  choiceReq: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.4,
    lineHeight: 10,
  },
  choiceEffectLine: {
    fontFamily: 'monospace',
    fontSize: 6,
    lineHeight: 9,
  },
  optionDHint: {
    fontFamily: 'monospace',
    fontSize: 6,
    lineHeight: 10,
    letterSpacing: 0.4,
    paddingHorizontal: 2,
  },
  confirmBtn: {
    borderWidth: 1,
    paddingVertical: NARRATIVE_CHOICE_PADDING_V,
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  confirmBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
