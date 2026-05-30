import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import PersistentTerminalLog from '../components/PersistentTerminalLog';
import { pickRandomTrinkets, TRINKET_POOL, useRun } from '../context/RunContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';

const TERMINAL_ACCENT = '#00ff33';

type CalibrationPhase = 'READY' | 'PINBALL' | 'LOCKED';

export default function SkillCheckScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, getCurrentSkillCheck, applySkillCheckResult, applyTrinket, appendRunLog, endRun, setPendingAmbush } = useRun();
  const { startCombat, startGameOver } = useGameFlow();
  const { completeCurrentNode } = useNodeProgression();
  const event = getCurrentSkillCheck();

  const [phase, setPhase] = useState<CalibrationPhase>('READY');
  const [calibrationValue, setCalibrationValue] = useState(0);
  const [resultFlash, setResultFlash] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  const flickerAnim = useRef(new Animated.Value(0)).current;
  const pinAnim = useRef(new Animated.Value(0)).current;
  const hiddenRollRef = useRef({ roll: 0, total: 0, success: false });

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
    const success = total >= event.dc;
    hiddenRollRef.current = { roll, total, success };

    const targetValue = Math.min(Math.max(Math.round((total / (event.dc + 5)) * 100), 5), 98);
    setPhase('PINBALL');
    pinAnim.setValue(0);

    Animated.sequence([
      Animated.timing(pinAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.elastic(1.2)),
        useNativeDriver: false,
      }),
    ]).start(() => {
      setCalibrationValue(targetValue);
      setPhase('LOCKED');
      resolveCalibration(success, roll, total, targetValue);
    });

    const listener = pinAnim.addListener(({ value }) => {
      const bounce = Math.abs(Math.sin(value * Math.PI * 8)) * (1 - value) * 40;
      const base = value * targetValue;
      setCalibrationValue(Math.min(Math.round(base + bounce + Math.random() * 8), 99));
    });

    setTimeout(() => pinAnim.removeListener(listener), 1500);
  };

  const resolveCalibration = (success: boolean, roll: number, total: number, finalValue: number) => {
    if (resolved) return;
    setResolved(true);

    appendRunLog(
      `>> Calibration d20: ${roll} (+${event.modifier} ${event.attribute}) = ${total} vs DC ${event.dc} — locked at ${finalValue}%.`,
    );

    if (success) {
      setResultFlash('CALIBRATION OPTIMAL');
      const hpGain = event.successReward.hp ?? 0;
      const stamGain = event.successReward.stamina ?? 0;
      applySkillCheckResult(hpGain, stamGain, `>> ${event.successReward.log}`);

      const trinket = pickRandomTrinkets(TRINKET_POOL, 1)[0];
      if (trinket) applyTrinket(trinket);

      setTimeout(() => completeCurrentNode(event.successReward.log), 1800);
    } else {
      setResultFlash('CRITICAL DE-SYNC / CONTAINMENT BREACH');
      const hpLoss = event.failurePenalty.hp ?? 0;
      const stamLoss = event.failurePenalty.stamina ?? 0;
      const projectedHp = runState.soulAnchorIntegrity - hpLoss;
      applySkillCheckResult(-hpLoss, -stamLoss, `>> ${event.failurePenalty.log}`);

      if (projectedHp <= 0) {
        appendRunLog('>> SOUL ANCHOR DESTROYED — run terminated.');
        setTimeout(() => { endRun('SOUL ANCHOR DESTROYED'); startGameOver(); }, 1800);
        return;
      }

      if (event.failurePenalty.ambush) {
        setPendingAmbush(true);
        appendRunLog('>> AMBUSH — hostile vector engaged.');
        setTimeout(() => startCombat(), 1800);
      } else {
        setTimeout(() => completeCurrentNode(event.failurePenalty.log), 1800);
      }
    }
  };

  const flickerOpacity = flickerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
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
            <View style={[styles.sliderFill, { width: `${calibrationValue}%`, backgroundColor: resultFlash?.includes('OPTIMAL') ? TERMINAL_ACCENT : resultFlash ? '#ef4444' : TERMINAL_ACCENT }]} />
            <View style={[styles.sliderPin, { left: `${Math.min(calibrationValue, 96)}%` }]} />
          </View>

          {phase === 'READY' && (
            <Pressable onPress={handleCalibrate} style={[styles.calibrateButton, { borderColor: TERMINAL_ACCENT }]}>
              <Text style={styles.calibrateButtonText}>[ ENGAGE CALIBRATION ]</Text>
            </Pressable>
          )}
        </Animated.View>

        {resultFlash && (
          <Text style={[styles.resultFlash, { color: resultFlash.includes('OPTIMAL') ? TERMINAL_ACCENT : '#ef4444' }]}>
            {resultFlash}
          </Text>
        )}
      </View>

      <PersistentTerminalLog />
    </View>
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
