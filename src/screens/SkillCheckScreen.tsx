import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import { AMBUSH_ENCOUNTERS_ENABLED } from '../data/featureFlags';
import { useRun } from '../context/RunContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';

const TERMINAL_ACCENT = '#00ff33';

type CalibrationPhase = 'READY' | 'PINBALL' | 'LOCKED';
type RollTier = 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'CRITICAL_DESYNC';

function resolveTier(roll: number, modifier: number): RollTier {
  const total = roll + modifier;
  if (roll === 1) return 'CRITICAL_DESYNC';
  if (total >= 18) return 'CRITICAL_SUCCESS';
  if (total >= 11) return 'SUCCESS';
  return 'FAILURE';
}

const TIER_LABEL: Record<RollTier, string> = {
  CRITICAL_SUCCESS: 'CRITICAL SUCCESS',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  CRITICAL_DESYNC: 'CRITICAL DE-SYNC',
};

export default function SkillCheckScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    getCurrentSkillCheck,
    applySkillCheckTier,
    appendRunLog,
    endRun,
    setPendingAmbush,
  } = useRun();
  const { startCombat, startGameOver } = useGameFlow();
  const { completeCurrentNode } = useNodeProgression();
  const event = getCurrentSkillCheck();

  const [phase, setPhase] = useState<CalibrationPhase>('READY');
  const [calibrationValue, setCalibrationValue] = useState(0);
  const [resultFlash, setResultFlash] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  const flickerAnim = useRef(new Animated.Value(0)).current;
  const pinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flickerAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 0.3, duration: 80, useNativeDriver: true }),
      ]),
    );
    if (phase === 'READY') loop.start();
    return () => loop.stop();
  }, [flickerAnim, phase]);

  if (!event) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={{ color: theme.mutedColor, fontFamily: 'monospace', padding: 20 }}>No calibration event loaded.</Text>
      </View>
    );
  }

  const handleCalibrate = () => {
    if (resolved || phase !== 'READY') return;

    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + event.modifier;
    const tier = resolveTier(roll, event.modifier);
    const targetValue = Math.min(Math.max(Math.round((total / 22) * 100), 5), 98);

    setPhase('PINBALL');
    pinAnim.setValue(0);

    Animated.timing(pinAnim, {
      toValue: 1,
      duration: 1400,
      easing: Easing.out(Easing.elastic(1.2)),
      useNativeDriver: false,
    }).start(() => {
      setCalibrationValue(targetValue);
      setPhase('LOCKED');
      resolveCalibration(tier, roll, total);
    });

    const listener = pinAnim.addListener(({ value }) => {
      const bounce = Math.abs(Math.sin(value * Math.PI * 8)) * (1 - value) * 40;
      setCalibrationValue(Math.min(Math.round(value * targetValue + bounce + Math.random() * 8), 99));
    });
    setTimeout(() => pinAnim.removeListener(listener), 1500);
  };

  const resolveCalibration = (tier: RollTier, roll: number, total: number) => {
    if (resolved) return;
    setResolved(true);
    setResultFlash(TIER_LABEL[tier]);

    appendRunLog(
      `>> Calibration d20: ${roll} (+${event.modifier} ${event.attribute}) = ${total} — ${TIER_LABEL[tier]}.`,
    );

    const logLines: Record<RollTier, string> = {
      CRITICAL_SUCCESS: '>> CRITICAL SUCCESS — powerful boon or +30 HP applied.',
      SUCCESS: '>> SUCCESS — +10 Max Stamina and +20 Stamina recovered.',
      FAILURE: '>> FAILURE — -15 Soul Anchor HP, -30 Max Stamina (corruption).',
      CRITICAL_DESYNC: '>> CRITICAL DE-SYNC — -25 HP and elite ambush triggered.',
    };

    applySkillCheckTier(tier, logLines[tier]);

    const projectedHp =
      tier === 'CRITICAL_DESYNC'
        ? runState.soulAnchorIntegrity - 25
        : tier === 'FAILURE'
          ? runState.soulAnchorIntegrity - 15
          : tier === 'CRITICAL_SUCCESS'
            ? Math.min(runState.soulAnchorIntegrity + 30, runState.maxSoulAnchor)
            : runState.soulAnchorIntegrity;

    setTimeout(() => {
      if (projectedHp <= 0 && tier !== 'CRITICAL_SUCCESS') {
        endRun('SOUL ANCHOR DESTROYED');
        startGameOver();
        return;
      }

      if (tier === 'CRITICAL_DESYNC' && AMBUSH_ENCOUNTERS_ENABLED) {
        setPendingAmbush(true);
        appendRunLog('>> ELITE AMBUSH — deploying to combat immediately.');
        startCombat();
        return;
      }

      if (tier === 'CRITICAL_DESYNC') {
        completeCurrentNode(`${TIER_LABEL[tier]} resolved.`);
        return;
      }

      completeCurrentNode(`${TIER_LABEL[tier]} resolved.`);
    }, 1800);
  };

  const flickerOpacity = flickerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.container}>
      <View style={[styles.header, { borderColor: theme.borderColor }]}>
        <Text style={[styles.headerText, { color: theme.mutedColor }]}>
          NODE {runState.currentNode + 1}/{runState.totalNodes} // SIGNAL CALIBRATION MATRIX
        </Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.narrativeBox, { borderColor: theme.borderColor, backgroundColor: '#0d0f14' }]}>
          <Text style={[styles.narrativeLabel, { color: theme.mutedColor }]}>MACRO EVENT</Text>
          <Text style={[styles.narrativeText, { color: theme.primaryColor }]}>{event.narrative}</Text>
        </View>

        <Animated.View style={[styles.calibrationBox, { borderColor: TERMINAL_ACCENT, opacity: phase === 'LOCKED' ? 1 : flickerOpacity }]}>
          <Text style={styles.calibrationLabel}>RIFT INTERFERENCE CALIBRATION</Text>
          <Text style={[styles.calibrationHint, { color: theme.mutedColor }]}>
            {phase === 'READY' ? 'Tap to engage pinball lock sequence' : phase === 'PINBALL' ? 'Calibrating...' : `Locked: ${calibrationValue}%`}
          </Text>

          <View style={[styles.sliderTrack, { borderColor: theme.borderColor }]}>
            <View style={[styles.sliderFill, { width: `${calibrationValue}%`, backgroundColor: resultFlash?.includes('SUCCESS') || resultFlash?.includes('CRITICAL SUCCESS') ? TERMINAL_ACCENT : resultFlash ? '#ef4444' : TERMINAL_ACCENT }]} />
            <View style={[styles.sliderPin, { left: `${Math.min(calibrationValue, 96)}%` }]} />
          </View>

          {phase === 'READY' && (
            <Pressable onPress={handleCalibrate} style={[styles.calibrateButton, { borderColor: TERMINAL_ACCENT }]}>
              <Text style={styles.calibrateButtonText}>[ ENGAGE CALIBRATION ]</Text>
            </Pressable>
          )}
        </Animated.View>

        {resultFlash && (
          <Text style={[styles.resultFlash, { color: resultFlash.includes('FAILURE') || resultFlash.includes('DE-SYNC') ? '#ef4444' : TERMINAL_ACCENT }]}>
            {resultFlash}
          </Text>
        )}
      </View>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  headerText: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.2, textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  narrativeBox: { borderWidth: 1, padding: 14, marginBottom: 20 },
  narrativeLabel: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1.4, marginBottom: 8 },
  narrativeText: { fontFamily: 'monospace', fontSize: 11, lineHeight: 17 },
  calibrationBox: { borderWidth: 2, padding: 16, backgroundColor: '#0a0b0f' },
  calibrationLabel: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: TERMINAL_ACCENT, letterSpacing: 1, marginBottom: 8 },
  calibrationHint: { fontFamily: 'monospace', fontSize: 9, marginBottom: 16 },
  sliderTrack: { height: 20, borderWidth: 1, backgroundColor: '#050608', position: 'relative', marginBottom: 16, overflow: 'hidden' },
  sliderFill: { height: '100%', opacity: 0.35 },
  sliderPin: { position: 'absolute', top: 2, width: 4, height: 14, backgroundColor: '#ffffff' },
  calibrateButton: { borderWidth: 2, paddingVertical: 12, alignItems: 'center' },
  calibrateButtonText: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: TERMINAL_ACCENT },
  resultFlash: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 20, letterSpacing: 1.5 },
});
