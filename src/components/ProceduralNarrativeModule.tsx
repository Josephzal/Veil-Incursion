import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CityStreetNarrativeBg from '../../assets/narrative images/city-street.png';
import type { NarrativeChoiceKey, NarrativeChoiceOption, NarrativeEventNode } from '../types/game';
import { ENVIRONMENT_DISPLAY_LABEL } from '../types/sector';
import { isOpenSectorNarrative } from '../data/sectorNarrativeEngine';

const TERMINAL_ACCENT = '#00ff33';

type ModulePhase = 'SCENARIO' | 'RESULT';

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

interface ProceduralNarrativeModuleProps {
  node: NarrativeEventNode;
  onResolve: (choice: NarrativeChoiceKey) => void;
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
}: {
  option: NarrativeChoiceOption;
  selected: boolean;
  onPress: () => void;
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  cityStreets: boolean;
}): React.JSX.Element {
  const locked = option.locked === true;
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.choiceBtn,
        cityStreets && styles.choiceBtnCityStreets,
        selected && styles.choiceBtnSelected,
        {
          borderColor: selected ? TERMINAL_ACCENT : borderColor,
          opacity: locked ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.choiceLabel, { color: selected ? TERMINAL_ACCENT : primaryColor }]}>
        {option.label}
      </Text>
      <Text style={[styles.choiceReq, { color: mutedColor }]}>
        {locked && option.lockReason ? option.lockReason : `REQ: ${option.requirement}`}
      </Text>
      {option.effectPreview ? (
        <ChoiceEffectPreview preview={option.effectPreview} mutedColor={mutedColor} />
      ) : null}
    </Pressable>
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
  const [resultText, setResultText] = useState<string | null>(null);

  const showCityStreetBackground = node.environmentType != null || !isOpenSectorNarrative(node);
  const choices: { key: NarrativeChoiceKey; option: NarrativeChoiceOption }[] = [
    { key: 'A', option: node.choiceA },
    { key: 'B', option: node.choiceB },
    ...(node.choiceC ? [{ key: 'C' as const, option: node.choiceC }] : []),
    ...(node.choiceD ? [{ key: 'D' as const, option: node.choiceD }] : []),
  ];

  const handleConfirm = () => {
    if (!selectedChoice) return;
    const option = choices.find((entry) => entry.key === selectedChoice)?.option;
    if (!option) return;
    if (option.locked) return;

    setResultText(option.successText);
    setPhase('RESULT');
    setTimeout(() => onResolve(selectedChoice), 1400);
  };

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
            {node.environmentType
              ? `ENVIRONMENT LOG // ${ENVIRONMENT_DISPLAY_LABEL[node.environmentType].toUpperCase()}`
              : 'ENVIRONMENT LOG // SECTOR ARCHIVE'}
          </Text>
          <Text style={[styles.docTitle, { color: TERMINAL_ACCENT }]}>{node.title}</Text>
        </View>

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.docBody, { borderColor }]}>
            <Text style={[styles.scenarioText, { color: primaryColor }]}>{node.scenarioText}</Text>
            {node.hazardPreview ? (
              <Text style={styles.hazardText}>{node.hazardPreview}</Text>
            ) : null}
          </View>

          {phase === 'SCENARIO' ? (
            <View style={styles.choiceCol}>
              <Text style={[styles.resolverHeader, { color: mutedColor }]}>
                SELECT EXPEDITION RESOLVER:
              </Text>
              {choices.map(({ key, option }) => (
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
                />
              ))}
            </View>
          ) : null}

          {phase === 'RESULT' && resultText ? (
            <View style={[styles.resultBox, { borderColor: TERMINAL_ACCENT }]}>
              <Text style={[styles.resultText, { color: TERMINAL_ACCENT }]}>{resultText}</Text>
            </View>
          ) : null}
        </ScrollView>

        {phase === 'SCENARIO' ? (
          <View style={styles.footer}>
            <Pressable
              onPress={handleConfirm}
              disabled={selectedChoice == null}
              style={({ pressed }) => [
                styles.confirmBtn,
                {
                  borderColor: selectedChoice != null ? TERMINAL_ACCENT : borderColor,
                  opacity: selectedChoice == null ? 0.4 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.confirmBtnText, { color: selectedChoice != null ? TERMINAL_ACCENT : mutedColor }]}>
                [ CONFIRM RESOLVER ]
              </Text>
            </Pressable>
          </View>
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
  scrollBody: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 8,
  },
  footer: {
    flexShrink: 0,
    paddingTop: 6,
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
  choiceLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
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
});
