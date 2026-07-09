import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import TacticalButton from './TacticalButton';
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
  NARRATIVE_TERMINAL_BODY_MIN_HEIGHT,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../constants/narrativeLayout';
import { DOSSIER_CTA_BG, DOSSIER_ROW_BG, dossierOpaqueCtaStyle } from '../constants/dossierSurface';
import DossierCardShell from './hub/DossierCardShell';
import { hubCtaButtonStyle } from '../constants/hubCta';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useRun } from '../context/RunContext';
import {
  canUseKeepsakeCounterfeitMandate,
} from '../data/expeditionKeepsakeContractEngine';

const TERMINAL_ACCENT = '#00ff33';
const LOCK_ICON_COLOR = '#ff453a';

type ModulePhase = 'SCENARIO' | 'TENSION' | 'OUTCOME';

interface PendingResolve {
  choice: NarrativeChoiceKey;
  status: CheckStatus;
  options?: { tensionBonusCredits?: number; counterfeitMandate?: boolean };
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
  borderColor,
  mutedColor,
  primaryColor,
  showLockIcon = false,
  minHeight,
  labelFontSize,
  labelLineHeight,
  subtextFontSize,
  subtextLineHeight,
  lockIconSize,
}: ResolverButtonProps): React.JSX.Element {
  const locked = option.locked === true;
  return (
    <HapticPressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.choiceBtn,
        { minHeight, paddingVertical: NARRATIVE_CHOICE_PADDING_V, paddingHorizontal: NARRATIVE_CHOICE_PADDING_H },
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
              color: selected && !locked ? TERMINAL_ACCENT : primaryColor,
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
            color: locked ? '#64748b' : mutedColor,
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
  const {
    isDesktop,
    scaleFont,
    scaleSize,
    scaleSpacing,
  } = useResponsiveLayout();
  const { activeIncursion } = useRun();

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
    bodyMinHeight: scaleSize(NARRATIVE_TERMINAL_BODY_MIN_HEIGHT),
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
  const counterfeitMandateAvailable = canUseKeepsakeCounterfeitMandate(activeIncursion.keepsakeRuntime)
    && node.choiceB.locked === true
    && (node.choiceB.lockReason ?? '').toUpperCase().includes('CABAL');

  const confirmButtonStyle = useMemo(
    () => [
      styles.confirmButton,
      hubCtaButtonStyle(TERMINAL_ACCENT, scaleSize, scaleSpacing, !canConfirm),
      dossierOpaqueCtaStyle(TERMINAL_ACCENT),
    ],
    [canConfirm, scaleSize, scaleSpacing],
  );

  const showOutcome = (
    choice: NarrativeChoiceKey,
    status: CheckStatus = 'SUCCESS',
    options?: { tensionBonusCredits?: number; counterfeitMandate?: boolean },
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
    options?: { tensionBonusCredits?: number; counterfeitMandate?: boolean },
  ) => {
    showOutcome(choice, status, options);
  };

  const handleCounterfeitMandate = () => {
    if (!counterfeitMandateAvailable) return;
    finishWithResult('B', node.choiceB.successText, 'SUCCESS', { counterfeitMandate: true });
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
    if (!selectedChoice) return '[ CONFIRM ]';
    if (selectedChoice === 'A') return '[ ENGAGE TENSION PROTOCOL ]';
    if (selectedChoice === 'D') {
      if (optionDVariant === 'Retreat') return '[ CONFIRM ABORT — RETURN TO MAP ]';
      return '[ CONFIRM BRUTE FORCE ]';
    }
    if (selectedChoice === 'B') return '[ CONFIRM CABAL BYPASS ]';
    if (selectedChoice === 'C') return '[ CONFIRM ITEM BYPASS ]';
    return '[ CONFIRM CHOICE ]';
  })();

  if (phase === 'TENSION') {
    return (
      <View style={styles.tensionRoot}>
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
    <DossierCardShell
      fillHeight
      padding={NARRATIVE_UNIFIED_PANEL_PADDING}
      style={styles.scenarioShell}
      contentStyle={styles.scenarioContent}
    >
      <View
        style={[
          styles.contentStage,
          { minHeight: typography.bodyMinHeight, marginBottom: scaleSpacing(12) },
        ]}
      >
        {phase === 'SCENARIO' ? (
          <View style={[styles.resolverBlock, { gap: typography.choiceGap }]}>
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
            {counterfeitMandateAvailable ? (
              <HapticPressable
                onPress={handleCounterfeitMandate}
                style={(state) => [
                  styles.mandateBtn,
                  { opacity: state.pressed ? 0.8 : 1, borderColor: '#f97316' },
                ]}
              >
                <Text style={[styles.mandateLabel, { fontSize: typography.choiceSubtextSize }]}>
                  [ COUNTERFEIT MANDATE — SPOOF CABAL AUTH (−25% REWARD) ]
                </Text>
              </HapticPressable>
            ) : null}
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
        ) : null}
      </View>

      <View style={styles.footerSlot}>
        {phase === 'SCENARIO' ? (
          <TacticalButton
            label={confirmLabel}
            active={canConfirm}
            disabled={!canConfirm}
            onPress={handleConfirm}
            accentColor={TERMINAL_ACCENT}
            mutedColor={mutedColor}
            variant="cta"
            style={confirmButtonStyle}
            labelSize={scaleFont(9)}
            labelLineHeight={scaleFont(12)}
          />
        ) : (
          <View style={[styles.footerSpacer, { minHeight: scaleSize(48) }]} pointerEvents="none" />
        )}
      </View>
    </DossierCardShell>
  );
}

const styles = StyleSheet.create({
  tensionRoot: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  scenarioShell: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  scenarioContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  contentStage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  footerSlot: {
    flexShrink: 0,
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  confirmButton: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    minWidth: 0,
  },
  footerSpacer: {
    width: '100%',
  },
  resolverBlock: {
    flex: 1,
    width: '100%',
    minHeight: 0,
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
    backgroundColor: DOSSIER_ROW_BG,
    justifyContent: 'center',
  },
  choiceBtnSelected: {
    backgroundColor: DOSSIER_CTA_BG,
  },
  choiceBtnLocked: {
    backgroundColor: DOSSIER_ROW_BG,
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
