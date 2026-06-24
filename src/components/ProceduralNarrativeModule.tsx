import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import HapticPressable from './HapticPressable';
import CityStreetNarrativeBg from '../../assets/narrative images/city-street.png';
import LandscapeSplitPane from './layout/LandscapeSplitPane';
import type { NarrativeChoiceKey, NarrativeChoiceOption, NarrativeEventNode, CheckStatus } from '../types/game';
import { isOpenSectorNarrative } from '../data/sectorNarrativeEngine';
import TensionMechanicHost from './narrative/tension/TensionMechanicHost';
import NarrativeOutcomePanel from './narrative/NarrativeOutcomePanel';
import { formatTensionMechanicLabel } from './narrative/tension/tensionMechanicTypes';
import {
  buildProceduralOutcomeSummary,
  formatBonusLine,
} from '../data/narrative/narrativeOutcomeSummary';
import type { NarrativeOutcomeSummary } from '../data/narrative/narrativeOutcomeSummary';

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
  splitLayout?: boolean;
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
  cityStreets,
  showLockIcon = false,
}: {
  option: NarrativeChoiceOption;
  selected: boolean;
  onPress: () => void;
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  cityStreets: boolean;
  showLockIcon?: boolean;
}): React.JSX.Element {
  const locked = option.locked === true;
  return (
    <HapticPressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.choiceBtn,
        cityStreets && styles.choiceBtnCityStreets,
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
  splitLayout = false,
  borderColor = '#334155',
  mutedColor = '#94a3b8',
  primaryColor = '#f8fafc',
}: ProceduralNarrativeModuleProps): React.JSX.Element {
  const [phase, setPhase] = useState<ModulePhase>('SCENARIO');
  const [selectedChoice, setSelectedChoice] = useState<NarrativeChoiceKey | null>(null);
  const [outcomeSummary, setOutcomeSummary] = useState<NarrativeOutcomeSummary | null>(null);
  const [pendingResolve, setPendingResolve] = useState<PendingResolve | null>(null);
  const [bonusLine, setBonusLine] = useState<string | null>(null);

  const showCityStreetBackground = node.interactionMode === 'procedural' || !isOpenSectorNarrative(node);
  const isBruteForceA = node.proceduralMeta?.engineVersion === 'assembly-v2';
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
      if (isBruteForceA) {
        finishWithResult('A', selectedOption.successText);
        return;
      }
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
    if (selectedChoice === 'A') {
      return isBruteForceA ? '[ CONFIRM BRUTE FORCE ]' : '[ ENGAGE TENSION PROTOCOL ]';
    }
    if (selectedChoice === 'D') {
      if (optionDVariant === 'Retreat') return '[ CONFIRM ABORT — RETURN TO MAP ]';
      return '[ CONFIRM BRUTE FORCE ]';
    }
    if (selectedChoice === 'B') return '[ CONFIRM CABAL BYPASS ]';
    if (selectedChoice === 'C') return '[ CONFIRM ITEM BYPASS ]';
    return '[ CONFIRM RESOLVER ]';
  })();

  const { height: windowHeight } = useWindowDimensions();
  const flavorMaxHeight = Math.round(windowHeight * 0.36);

  const scenarioStory = (
    <ScrollView
      style={splitLayout ? styles.flavorScrollFill : [styles.flavorScroll, { maxHeight: flavorMaxHeight }]}
      contentContainerStyle={styles.flavorScrollContent}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.docBody, { borderColor }]}>
        <Text style={[styles.scenarioText, { color: primaryColor }]}>{node.scenarioText}</Text>
        {node.hazardPreview ? (
          <Text style={styles.hazardText}>{node.hazardPreview}</Text>
        ) : null}
      </View>
    </ScrollView>
  );

  const scenarioChoices = (
    <View style={styles.choicePane}>
      <View style={styles.choiceSection}>
        <Text style={[styles.resolverHeader, { color: mutedColor }]}>
          SELECT EXPEDITION RESOLVER:
        </Text>
        <ScrollView
          style={styles.choiceScroll}
          contentContainerStyle={styles.choiceCol}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
              cityStreets={showCityStreetBackground}
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
        </ScrollView>
      </View>

      <View style={styles.footer}>
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
  );

  return (
    <View style={[styles.root, showCityStreetBackground && styles.rootWithCityBackground]}>
      {showCityStreetBackground ? (
        <>
          <Image source={CityStreetNarrativeBg} style={styles.cityBackgroundImage} resizeMode="cover" />
          <View style={styles.cityBackgroundScrim} pointerEvents="none" />
        </>
      ) : null}

      <View style={[styles.shell, showCityStreetBackground && styles.shellCityStreets]}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <Text style={[styles.docLabel, { color: mutedColor }]}>
            {phase === 'OUTCOME'
              ? 'EXPEDITION LOG // RESOLVE REPORT'
              : 'EXPEDITION LOG // PROCEDURAL ASSEMBLY'}
          </Text>
          <Text style={[styles.docTitle, { color: TERMINAL_ACCENT }]}>{node.title}</Text>
        </View>

        {phase === 'SCENARIO' ? (
          splitLayout ? (
            <LandscapeSplitPane
              style={styles.splitPane}
              primary={scenarioStory}
              secondary={scenarioChoices}
              primaryStyle={styles.splitPrimary}
              secondaryStyle={styles.splitSecondary}
            />
          ) : (
            <>
              {scenarioStory}
              {scenarioChoices}
            </>
          )
        ) : null}

        {phase === 'TENSION' ? (
          <View style={styles.tensionArea}>
            <TensionMechanicHost
              tensionMechanic={node.proceduralMeta?.tensionMechanic}
              onSuccess={handleTensionSuccess}
              onFailure={handleTensionFailure}
              defaultPenalty={node.proceduralMeta?.defaultPenalty}
              fallbackLabel={tensionMechanicLabel}
              penaltyPreview={node.hazardPreview}
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
            cityStreets={showCityStreetBackground}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  rootWithCityBackground: {
    position: 'relative',
  },
  cityBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cityBackgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  shell: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  shellCityStreets: {
    paddingHorizontal: 14,
  },
  header: {
    flexShrink: 0,
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 8,
  },
  flavorScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  flavorScrollFill: {
    flex: 1,
    minHeight: 0,
  },
  flavorScrollContent: {
    paddingBottom: 4,
  },
  splitPane: {
    flex: 1,
    minHeight: 0,
  },
  splitPrimary: {
    minHeight: 0,
  },
  splitSecondary: {
    minHeight: 0,
  },
  choicePane: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'space-between',
  },
  choiceSection: {
    flex: 1,
    minHeight: 0,
    marginTop: 8,
    gap: 4,
  },
  choiceScroll: {
    flex: 1,
    minHeight: 0,
  },
  tensionArea: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  resultArea: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  footer: {
    flexShrink: 0,
    paddingTop: 8,
    paddingBottom: 4,
  },
  docLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
  },
  docTitle: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  docBody: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  scenarioText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
  },
  hazardText: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
    color: '#fbbf24',
    letterSpacing: 0.6,
  },
  choiceCol: {
    gap: 6,
  },
  resolverHeader: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 2,
  },
  choiceBtn: {
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 2,
  },
  choiceBtnCityStreets: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  choiceBtnSelected: {
    backgroundColor: 'rgba(0, 255, 51, 0.08)',
  },
  choiceBtnLocked: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  choiceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockIcon: {
    fontSize: 10,
    lineHeight: 12,
  },
  choiceLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  choiceLabelLocked: {
    color: '#94a3b8',
  },
  choiceReq: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.4,
    lineHeight: 11,
  },
  choiceEffectLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 10,
  },
  optionDHint: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.4,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  confirmBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  resultBox: {
    borderWidth: 1,
    padding: 14,
  },
  resultText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  bonusText: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 8,
    letterSpacing: 0.4,
  },
});
