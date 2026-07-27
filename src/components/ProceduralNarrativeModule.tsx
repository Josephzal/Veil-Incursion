import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import FieldPlate from './runField/FieldPlate';
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
  NARRATIVE_CHOICE_PADDING_H,
  NARRATIVE_CHOICE_PADDING_V,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../constants/narrativeLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { RUN_FIELD } from '../theme/runFieldTokens';
import { readPressableHover } from '../utils/terminalHoverStyle';

const TERMINAL_ACCENT = RUN_FIELD.mint;
const LOCK_ICON_COLOR = RUN_FIELD.danger;

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
  fontSize,
  lineHeight,
}: {
  preview: NonNullable<NarrativeChoiceOption['effectPreview']>;
  mutedColor: string;
  fontSize: number;
  lineHeight: number;
}): React.JSX.Element | null {
  if (preview.guaranteed) {
    return (
      <Text style={[styles.choiceEffectLine, { color: mutedColor, fontSize, lineHeight }]}>
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

/** Screen-level CONFIRM rail state — parent owns bottom-right placement. */
export interface NarrativeConfirmRailState {
  canConfirm: boolean;
  primaryDanger: boolean;
  onConfirm: () => void;
}

interface ProceduralNarrativeModuleProps {
  node: NarrativeEventNode;
  onResolve: (
    choice: NarrativeChoiceKey,
    status?: CheckStatus,
    options?: { tensionBonusCredits?: number },
  ) => void;
  /** Reports SCENARIO confirm controls for the screen action rail; null when not applicable. */
  onConfirmRailChange?: (state: NarrativeConfirmRailState | null) => void;
  borderColor?: string;
  mutedColor?: string;
  primaryColor?: string;
}

interface ResolverButtonProps {
  option: NarrativeChoiceOption;
  selected: boolean;
  onPress: () => void;
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  showLockIcon?: boolean;
  minHeight: number;
  labelFontSize: number;
  labelLineHeight: number;
  subtextFontSize: number;
  subtextLineHeight: number;
  lockIconSize: number;
}

function ResolverButton({
  option,
  selected,
  onPress,
  mutedColor,
  primaryColor,
  showLockIcon = false,
  minHeight,
  labelFontSize,
  labelLineHeight,
  subtextFontSize,
  subtextLineHeight,
  lockIconSize,
}: Omit<ResolverButtonProps, 'borderColor'> & { borderColor?: string }): React.JSX.Element {
  const locked = option.locked === true;
  return (
    <HapticPressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: locked }}
      style={(state) => {
        const hovered = !locked && (readPressableHover(state) || state.pressed);
        return [
          { opacity: locked ? 0.72 : 1 },
          hovered && !selected ? { transform: [{ translateY: -1 }] } : null,
        ];
      }}
    >
      {(state) => {
        const hovered = !locked && !selected && (readPressableHover(state) || state.pressed);
        const plateState = locked
          ? 'locked'
          : selected
            ? 'selected'
            : hovered
              ? 'hover'
              : 'idle';
        return (
          <FieldPlate
            density="wash"
            tone="mint"
            state={plateState}
            brackets={false}
            contentStyle={{
              minHeight,
              paddingVertical: NARRATIVE_CHOICE_PADDING_V + 4,
              paddingHorizontal: NARRATIVE_CHOICE_PADDING_H + 4,
              gap: 4,
            }}
          >
            <View style={styles.choiceLabelRow}>
              {locked && showLockIcon ? (
                <Text
                  style={[styles.lockIcon, { color: LOCK_ICON_COLOR, fontSize: lockIconSize, lineHeight: lockIconSize + 2 }]}
                  accessibilityLabel="Locked"
                >
                  🔒
                </Text>
              ) : null}
              <Text
                style={[
                  styles.choiceLabel,
                  {
                    color: selected || hovered ? TERMINAL_ACCENT : primaryColor,
                    fontSize: labelFontSize,
                    lineHeight: labelLineHeight,
                  },
                  locked && styles.choiceLabelLocked,
                ]}
              >
                {option.label}
              </Text>
            </View>
            <Text
              style={[
                styles.choiceReq,
                {
                  color: locked ? RUN_FIELD.textDim : mutedColor,
                  fontSize: subtextFontSize,
                  lineHeight: subtextLineHeight,
                },
              ]}
            >
              {locked && option.lockReason ? option.lockReason : `REQ: ${option.requirement}`}
            </Text>
            {option.effectPreview ? (
              <ChoiceEffectPreview
                preview={option.effectPreview}
                mutedColor={mutedColor}
                fontSize={subtextFontSize}
                lineHeight={subtextLineHeight}
              />
            ) : null}
          </FieldPlate>
        );
      }}
    </HapticPressable>
  );
}

export default function ProceduralNarrativeModule({
  node,
  onResolve,
  onConfirmRailChange,
  borderColor = '#334155',
  mutedColor = '#94a3b8',
  primaryColor = '#f8fafc',
}: ProceduralNarrativeModuleProps): React.JSX.Element {
  const {
    isDesktop,
    scaleFont,
    scaleSize,
    scaleSpacing,
  } = useResponsiveLayout();

  const [phase, setPhase] = useState<ModulePhase>('SCENARIO');
  const [selectedChoice, setSelectedChoice] = useState<NarrativeChoiceKey | null>(null);
  const [outcomeSummary, setOutcomeSummary] = useState<NarrativeOutcomeSummary | null>(null);
  const [pendingResolve, setPendingResolve] = useState<PendingResolve | null>(null);
  const [bonusLine, setBonusLine] = useState<string | null>(null);

  const typography = useMemo(() => ({
    resolverHeaderSize: scaleFont(7),
    resolverHeaderLineHeight: scaleFont(10),
    choiceLabelSize: scaleFont(9),
    choiceLabelLineHeight: scaleFont(13),
    choiceSubtextSize: scaleFont(7),
    choiceSubtextLineHeight: scaleFont(11),
    hintSize: scaleFont(7),
    hintLineHeight: scaleFont(11),
    choiceMinHeight: isDesktop ? scaleSize(64) : scaleSize(48),
    choiceGap: isDesktop ? scaleSpacing(12) : scaleSpacing(6),
    lockIconSize: scaleSize(20),
  }), [isDesktop, scaleFont, scaleSize, scaleSpacing]);

  const optionDVariant = getOptionDVariant(node.choiceD);
  const choices: { key: NarrativeChoiceKey; option: NarrativeChoiceOption; showLockIcon: boolean }[] = [
    { key: 'A', option: node.choiceA, showLockIcon: false },
    { key: 'B', option: node.choiceB, showLockIcon: true },
    ...(node.choiceC ? [{ key: 'C' as const, option: node.choiceC, showLockIcon: true }] : []),
    ...(node.choiceD ? [{ key: 'D' as const, option: node.choiceD, showLockIcon: false }] : []),
  ];

  const selectedOption = choices.find((entry) => entry.key === selectedChoice)?.option;
  const tensionMechanicLabel = formatTensionMechanicLabel(node.proceduralMeta?.tensionMechanic);
  const canConfirm = selectedChoice != null && selectedOption?.locked !== true;

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

  const finishWithResult = useCallback((
    choice: NarrativeChoiceKey,
    _resultText: string,
    status: CheckStatus = 'SUCCESS',
    options?: { tensionBonusCredits?: number },
  ) => {
    showOutcome(choice, status, options);
  }, [node]);

  const handleConfirm = useCallback(() => {
    if (!selectedChoice || !selectedOption) return;
    if (selectedOption.locked) return;

    if (selectedChoice === 'A') {
      // Plain stash / no assigned mechanic — resolve success without a minigame.
      if (!node.proceduralMeta?.tensionMechanic) {
        finishWithResult('A', node.choiceA.successText, 'SUCCESS');
        return;
      }
      setPhase('TENSION');
      return;
    }

    finishWithResult(selectedChoice, selectedOption.successText);
  }, [selectedChoice, selectedOption, node, finishWithResult]);

  const handleTensionSuccess = (result?: { bonusCredits?: number }) => {
    finishWithResult('A', node.choiceA.successText, 'SUCCESS', {
      tensionBonusCredits: result?.bonusCredits ?? 0,
    });
  };

  const handleTensionFailure = () => {
    finishWithResult('A', node.choiceA.failureText, 'FAILURE');
  };

  const primaryDanger = selectedChoice === 'D' && optionDVariant === 'Retreat';

  useEffect(() => {
    if (!onConfirmRailChange) return;
    if (phase !== 'SCENARIO') {
      onConfirmRailChange(null);
      return;
    }
    onConfirmRailChange({
      canConfirm,
      primaryDanger,
      onConfirm: handleConfirm,
    });
  }, [onConfirmRailChange, phase, canConfirm, primaryDanger, handleConfirm]);

  useEffect(() => () => {
    onConfirmRailChange?.(null);
  }, [onConfirmRailChange]);

  if (phase === 'TENSION') {
    return (
      <View style={styles.tensionRoot}>
        <TensionMechanicHost
          tensionMechanic={node.proceduralMeta?.tensionMechanic}
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
    );
  }

  if (phase === 'OUTCOME' && outcomeSummary) {
    return (
      <View style={styles.tensionRoot}>
        <NarrativeOutcomePanel
          summary={outcomeSummary}
          bonusLine={bonusLine}
          onContinue={handleContinue}
          borderColor={borderColor}
          mutedColor={mutedColor}
          primaryColor={primaryColor}
        />
      </View>
    );
  }

  return (
    <FieldPlate
      density="light"
      brackets
      style={styles.scenarioShell}
      contentStyle={[styles.scenarioContent, { padding: NARRATIVE_UNIFIED_PANEL_PADDING }]}
    >
      <View style={[styles.resolverBlock, { gap: typography.choiceGap, marginBottom: scaleSpacing(12) }]}>
        <Text
          style={[
            styles.resolverHeader,
            {
              color: mutedColor,
              fontSize: typography.resolverHeaderSize,
              lineHeight: typography.resolverHeaderLineHeight,
            },
          ]}
        >
          [ DYNAMIC RESOLVERS ]
        </Text>
        <View style={[styles.choiceCol, { gap: typography.choiceGap }]}>
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
              minHeight={typography.choiceMinHeight}
              labelFontSize={typography.choiceLabelSize}
              labelLineHeight={typography.choiceLabelLineHeight}
              subtextFontSize={typography.choiceSubtextSize}
              subtextLineHeight={typography.choiceSubtextLineHeight}
              lockIconSize={typography.lockIconSize}
            />
          ))}
        </View>
        <View style={styles.optionDHintSlot}>
          {selectedChoice === 'D' && optionDVariant ? (
            <Text
              style={[
                styles.optionDHint,
                {
                  color: mutedColor,
                  fontSize: typography.hintSize,
                  lineHeight: typography.hintLineHeight,
                },
              ]}
            >
              {optionDVariant === 'Retreat'
                ? '>> RETREAT — aborts encounter and routes back to the ley-line grid.'
                : '>> BRUTE FORCE — accepts guaranteed cost without tension protocol.'}
            </Text>
          ) : null}
        </View>
      </View>
    </FieldPlate>
  );
}

const styles = StyleSheet.create({
  tensionRoot: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  scenarioShell: {
    width: '100%',
    alignSelf: 'flex-start',
  },
  scenarioContent: {
    width: '100%',
  },
  resolverBlock: {
    width: '100%',
  },
  tensionArea: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  optionDHintSlot: {
    minHeight: 24,
  },
  choiceCol: {
    width: '100%',
  },
  resolverHeader: {
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  choiceBtn: {
    borderWidth: 1,
    gap: 4,
    width: '100%',
    backgroundColor: RUN_FIELD.panelWash,
    justifyContent: 'center',
  },
  choiceBtnSelected: {
    backgroundColor: RUN_FIELD.mintSoft,
  },
  choiceBtnLocked: {
    backgroundColor: RUN_FIELD.panelWash,
  },
  mandateBtn: {
    borderWidth: 1,
    borderRadius: 3,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(124, 45, 18, 0.22)',
  },
  mandateLabel: {
    fontFamily: 'monospace',
    color: '#fdba74',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  choiceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockIcon: {
    fontWeight: '700',
  },
  choiceLabel: {
    fontFamily: 'monospace',
    fontWeight: '600',
    flexShrink: 1,
  },
  choiceLabelLocked: {
    color: '#94a3b8',
  },
  choiceReq: {
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },
  choiceEffectLine: {
    fontFamily: 'monospace',
    opacity: 0.72,
  },
  optionDHint: {
    fontFamily: 'monospace',
    letterSpacing: 0.4,
    paddingHorizontal: 2,
  },
});
