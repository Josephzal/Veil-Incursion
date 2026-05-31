import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CheckStatus, NarrativeEventNode } from '../types/game';

const TERMINAL_ACCENT = '#00ff33';
const TARGET_MIN = 0.6;
const TARGET_MAX = 0.8;

type StepperPhase = 'SCENARIO' | 'SKILL_CHECK' | 'RESULT';

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
  const [resultText, setResultText] = useState<string | null>(null);
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

  const handleChoice = (choice: 'A' | 'B') => {
    setSelectedChoice(choice);
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
    const choiceDef = selectedChoice === 'A' ? node.choiceA : node.choiceB;
    const text = inZone ? choiceDef.successText : choiceDef.failureText;

    setResultText(text);
    setPhase('RESULT');

    setTimeout(() => {
      onComplete({ choice: selectedChoice, status });
    }, 2000);
  };

  return (
    <View style={[styles.root, { borderColor }]}>
      <View style={[styles.docHeader, { borderBottomColor: borderColor }]}>
        <Text style={[styles.docLabel, { color: mutedColor }]}>AGENCY NARRATIVE DOCUMENT // {node.id.toUpperCase()}</Text>
        <Text style={[styles.docTitle, { color: TERMINAL_ACCENT }]}>{node.title}</Text>
      </View>

      <View style={[styles.docBody, { borderColor }]}>
        <Text style={[styles.scenarioText, { color: primaryColor }]}>{node.scenarioText}</Text>
      </View>

      {phase === 'SCENARIO' && (
        <View style={styles.choiceCol}>
          <Pressable
            onPress={() => handleChoice('A')}
            style={({ pressed }) => [styles.choiceBtn, { borderColor: TERMINAL_ACCENT, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.choiceLabel, { color: TERMINAL_ACCENT }]}>{node.choiceA.label}</Text>
            <Text style={[styles.choiceReq, { color: mutedColor }]}>REQ: {node.choiceA.requirement}</Text>
          </Pressable>
          <Pressable
            onPress={() => handleChoice('B')}
            style={({ pressed }) => [styles.choiceBtn, { borderColor: borderColor, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.choiceLabel, { color: primaryColor }]}>{node.choiceB.label}</Text>
            <Text style={[styles.choiceReq, { color: mutedColor }]}>REQ: {node.choiceB.requirement}</Text>
          </Pressable>
        </View>
      )}

      {phase === 'SKILL_CHECK' && (
        <View style={[styles.calibrationBox, { borderColor: TERMINAL_ACCENT }]}>
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
      )}

      {phase === 'RESULT' && resultText && (
        <View style={[styles.resultBox, { borderColor: resultText.includes('FAILURE') || resultText.includes('FAIL') ? '#ef4444' : TERMINAL_ACCENT }]}>
          <Text style={[styles.resultText, { color: resultText.includes('FAILURE') || resultText.includes('FAIL') ? '#ef4444' : TERMINAL_ACCENT }]}>
            {resultText}
          </Text>
          <Text style={[styles.resultSub, { color: mutedColor }]}>Returning to ley-line grid...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 2, padding: 14, backgroundColor: '#050608' },
  docHeader: { borderBottomWidth: 1, paddingBottom: 8, marginBottom: 10 },
  docLabel: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 1, marginBottom: 4 },
  docTitle: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  docBody: { borderWidth: 1, padding: 12, marginBottom: 12, backgroundColor: '#0a0b0f' },
  scenarioText: { fontFamily: 'monospace', fontSize: 10, lineHeight: 16, letterSpacing: 0.2 },
  choiceCol: { gap: 8 },
  choiceBtn: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10 },
  choiceLabel: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  choiceReq: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.8 },
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
