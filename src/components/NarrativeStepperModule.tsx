import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import CityStreetNarrativeBg from '../../assets/narrative images/city-street.png';
import SelectionContinueButton from './SelectionContinueButton';
import NarrativeOutcomePanel from './narrative/NarrativeOutcomePanel';
import { CheckStatus, NarrativeChoiceEffectPreview, NarrativeEventNode } from '../types/game';
import { isOpenSectorNarrative } from '../data/sectorNarrativeEngine';
import {
  buildLegacyOutcomeSummary,
  type NarrativeOutcomeSummary,
} from '../data/narrative/narrativeOutcomeSummary';

const TERMINAL_ACCENT = '#00ff33';
const TARGET_MIN = 0.6;
const TARGET_MAX = 0.8;

type StepperPhase = 'SCENARIO' | 'SKILL_CHECK' | 'OUTCOME';

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
  const [markerPct, setMarkerPct] = useState(0.5);

  const pinAnim = useRef(new Animated.Value(0)).current;
  const pinLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const markerPctRef = useRef(0.5);
  const lockedRef = useRef(false);

  useEffect(() => {
    const listener = pinAnim.addListener(({ value }) => {
      const pct = 0.05 + ((Math.sin(value * Math.PI * 2) + 1) / 2) * 0.9;
      markerPctRef.current = pct;
      setMarkerPct(pct);
    });
    return () => pinAnim.removeListener(listener);
  }, [pinAnim]);

  const startPinball = () => {
    lockedRef.current = false;
    pinAnim.setValue(0);
    pinLoopRef.current?.stop();
    pinLoopRef.current = Animated.loop(
      Animated.timing(pinAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    pinLoopRef.current.start();
  };

  useEffect(() => () => pinLoopRef.current?.stop(), []);

  const handleChoiceSelect = (choice: 'A' | 'B') => {
    setSelectedChoice(choice);
  };

  const handleScenarioContinue = () => {
    if (!selectedChoice) return;
    setPhase('SKILL_CHECK');
    startPinball();
  };

  const handleLockCalibration = () => {
    if (lockedRef.current || !selectedChoice) return;
    lockedRef.current = true;
    pinLoopRef.current?.stop();
    pinAnim.stopAnimation();

    const pct = markerPctRef.current;
    const inZone = pct >= TARGET_MIN && pct <= TARGET_MAX;
    const status: CheckStatus = inZone ? 'SUCCESS' : 'FAILURE';

    const summary = buildLegacyOutcomeSummary(node, selectedChoice, status);
    setOutcomeSummary(summary);
    setPendingResolve({ choice: selectedChoice, status });
    setPhase('OUTCOME');
  };

  const handleContinue = () => {
    if (!pendingResolve) return;
    onComplete(pendingResolve);
  };

  const showCityStreetBackground = isCityStreetsNarrative(node);
  const { height: windowHeight } = useWindowDimensions();
  const flavorMaxHeight = Math.round(windowHeight * 0.36);

  return (
    <View style={[styles.root, showCityStreetBackground && styles.rootWithCityBackground]}>
      {showCityStreetBackground ? (
        <>
          <Image
            source={CityStreetNarrativeBg}
            style={styles.cityBackgroundImage}
            resizeMode="cover"
          />
          <View style={styles.cityBackgroundScrim} pointerEvents="none" />
        </>
      ) : null}

      <View style={[styles.shell, showCityStreetBackground && styles.shellCityStreets]}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <Text style={[styles.docLabel, { color: mutedColor }]}>
            {`ANOMALY ENCOUNTER // ${node.id.toUpperCase()}`}
          </Text>
          <Text style={[styles.docTitle, { color: TERMINAL_ACCENT }]}>{node.title}</Text>
        </View>

        {phase === 'SCENARIO' ? (
          <>
            <ScrollView
              style={[styles.flavorScroll, { maxHeight: flavorMaxHeight }]}
              contentContainerStyle={styles.flavorScrollContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.docBody, { borderColor }]}>
                <Text style={[styles.scenarioText, { color: primaryColor }]}>{node.scenarioText}</Text>
              </View>
            </ScrollView>

            <View style={styles.choiceSection}>
              <View style={styles.choiceCol}>
                <Pressable
                  onPress={() => handleChoiceSelect('A')}
                  style={({ pressed }) => [
                    styles.choiceBtn,
                    showCityStreetBackground && styles.choiceBtnCityStreets,
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
                  <Text style={[styles.choiceReq, { color: mutedColor }]}>REQ: {node.choiceA.requirement}</Text>
                  {node.choiceA.effectPreview ? (
                    <ChoiceEffectPreview preview={node.choiceA.effectPreview} mutedColor={mutedColor} />
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={() => !node.choiceB.locked && handleChoiceSelect('B')}
                  disabled={node.choiceB.locked === true}
                  style={({ pressed }) => [
                    styles.choiceBtn,
                    showCityStreetBackground && styles.choiceBtnCityStreets,
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
                </Pressable>
              </View>
            </View>

            <View style={styles.footer}>
              <SelectionContinueButton
                enabled={selectedChoice != null}
                onPress={handleScenarioContinue}
                borderColor={borderColor}
                mutedColor={mutedColor}
              />
            </View>
          </>
        ) : null}

        {phase === 'SKILL_CHECK' ? (
          <View style={styles.tensionArea}>
            <View
              style={[
                styles.calibrationBox,
                { borderColor: TERMINAL_ACCENT },
                showCityStreetBackground && styles.panelCityStreets,
              ]}
            >
              <Text style={styles.calibrationTitle}>RIFT INTERFERENCE CALIBRATION MATRIX</Text>
              <Text style={[styles.calibrationHint, { color: mutedColor }]}>
                Lock marker inside green target zone (60%–80%)
              </Text>
              <View style={[styles.sliderTrack, { borderColor: borderColor }]}>
                <View style={[styles.targetZone, { left: `${TARGET_MIN * 100}%`, width: `${(TARGET_MAX - TARGET_MIN) * 100}%` }]} />
                <View style={[styles.marker, { left: `${Math.min(markerPct * 100, 97)}%` }]} />
              </View>
              <Pressable
                onPress={handleLockCalibration}
                style={({ pressed }) => [styles.lockBtn, { borderColor: TERMINAL_ACCENT, opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={styles.lockBtnText}>[ LOCK CALIBRATION ]</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'OUTCOME' && outcomeSummary ? (
          <NarrativeOutcomePanel
            summary={outcomeSummary}
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
    borderWidth: 2,
    padding: 14,
    backgroundColor: '#050608',
  },
  rootWithCityBackground: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    padding: 0,
    borderWidth: 0,
  },
  cityBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cityBackgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 6, 8, 0.69)',
  },
  shell: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
  },
  shellCityStreets: {
    padding: 14,
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
  flavorScrollContent: {
    paddingBottom: 4,
  },
  choiceSection: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    marginTop: 8,
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
  docLabel: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 1, marginBottom: 4 },
  docTitle: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  docBody: { borderWidth: 1, padding: 12, backgroundColor: '#0a0b0f' },
  scenarioText: { fontFamily: 'monospace', fontSize: 10, lineHeight: 16, letterSpacing: 0.2 },
  choiceCol: { gap: 6 },
  choiceBtn: { borderWidth: 1, paddingVertical: 5, paddingHorizontal: 8 },
  choiceBtnSelected: { backgroundColor: 'rgba(0, 255, 51, 0.08)' },
  choiceBtnCityStreets: { backgroundColor: '#0a0b0f' },
  panelCityStreets: { backgroundColor: '#0a0b0f' },
  choiceLabel: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  choiceReq: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.8, lineHeight: 10 },
  choiceEffectCol: { gap: 2, marginTop: 4 },
  choiceEffectLine: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.4, lineHeight: 10 },
  choiceEffectSuccess: { color: '#4ade80' },
  choiceEffectFailure: { color: '#f87171' },
  calibrationBox: { borderWidth: 2, padding: 12, marginTop: 4 },
  calibrationTitle: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: TERMINAL_ACCENT, letterSpacing: 0.8, marginBottom: 6 },
  calibrationHint: { fontFamily: 'monospace', fontSize: 8, marginBottom: 10 },
  sliderTrack: { height: 22, borderWidth: 1, backgroundColor: '#0d0f14', position: 'relative', marginBottom: 12, overflow: 'hidden' },
  targetZone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(0,255,51,0.28)' },
  marker: { position: 'absolute', top: 2, width: 3, height: 16, backgroundColor: '#ffffff', marginLeft: -1 },
  lockBtn: { borderWidth: 2, paddingVertical: 10, alignItems: 'center' },
  lockBtnText: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: TERMINAL_ACCENT },
  resultBox: { borderWidth: 2, padding: 12, marginTop: 8 },
  resultText: { fontFamily: 'monospace', fontSize: 9, lineHeight: 14, letterSpacing: 0.3, marginBottom: 6 },
  resultSub: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.5 },
});
