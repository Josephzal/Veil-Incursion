import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import SanctuaryNarrativeBg from '../../assets/narrative images/sanctuary.png';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import OperativeTelemetryBar from '../components/OperativeTelemetryBar';

const TERMINAL_ACCENT = '#00ff33';

export default function RestScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, applyRestChoice } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const [chosen, setChosen] = useState<'REST' | 'REPAIR' | null>(null);

  const handleChoice = (type: 'REST' | 'REPAIR') => {
    if (chosen) return;
    setChosen(type);
    applyRestChoice(type);
    const msg = type === 'REST' ? 'Stamina reserves replenished.' : 'Soul anchor repaired.';
    setTimeout(() => completeCurrentNode(msg), 1200);
  };

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.screenBody}>
          <OperativeTelemetryBar />

          <View style={styles.content}>
            <Image
              source={SanctuaryNarrativeBg}
              style={styles.backgroundImage}
              resizeMode="cover"
            />
            <View style={styles.backgroundScrim} pointerEvents="none" />

            <View style={styles.contentForeground}>
              <View style={[styles.docHeader, { borderBottomColor: theme.borderColor }]}>
                <Text style={[styles.docLabel, { color: theme.mutedColor }]}>
                  AGENCY SANCTUARY DOCUMENT // REST NODE
                </Text>
                <Text style={styles.docTitle}>REST / SANCTUARY NODE</Text>
              </View>

              <View style={[styles.docBody, { borderColor: theme.borderColor }]}>
                <Text style={[styles.scenarioText, { color: theme.primaryColor }]}>
                  A quiet anchor chapel hums with stabilizing ley-energy. Choose how to recover before the next incursion vector.
                </Text>
                <View style={styles.statsBlock}>
                  <Text style={[styles.statLine, { color: theme.mutedColor }]}>
                    SOUL ANCHOR: {runState.soulAnchorIntegrity}/{runState.maxSoulAnchor}
                  </Text>
                  <Text style={[styles.statLine, { color: theme.mutedColor }]}>
                    STAMINA: {runState.currentStamina}/{runState.maxStamina}
                  </Text>
                </View>
              </View>

              <View style={styles.choiceCol}>
                <Pressable
                  onPress={() => handleChoice('REST')}
                  disabled={!!chosen}
                  style={({ pressed }) => [
                    styles.choiceBtn,
                    {
                      borderColor: TERMINAL_ACCENT,
                      opacity: chosen && chosen !== 'REST' ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.choiceLabel, { color: TERMINAL_ACCENT }]}>[ REST ]</Text>
                  <Text style={[styles.choiceReq, { color: theme.mutedColor }]}>Restore 40% Stamina</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleChoice('REPAIR')}
                  disabled={!!chosen}
                  style={({ pressed }) => [
                    styles.choiceBtn,
                    {
                      borderColor: theme.borderColor,
                      opacity: chosen && chosen !== 'REPAIR' ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.choiceLabel, { color: theme.primaryColor }]}>[ ATTUNE ]</Text>
                  <Text style={[styles.choiceReq, { color: theme.mutedColor }]}>Restore 25% Soul Anchor HP</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 6, 8, 0.8)',
  },
  contentForeground: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  docHeader: { borderBottomWidth: 1, paddingBottom: 8, marginBottom: 10 },
  docLabel: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 1, marginBottom: 4 },
  docTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: TERMINAL_ACCENT,
  },
  docBody: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#0a0b0f',
  },
  scenarioText: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  statsBlock: { marginTop: 10 },
  statLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  choiceCol: { gap: 8 },
  choiceBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#0a0b0f',
  },
  choiceLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  choiceReq: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
  },
});
