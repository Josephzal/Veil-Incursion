import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ResourceImage from '../../assets/images/resource images/resource1.png';
import CargoPackingPanel from '../components/CargoPackingPanel';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import OperativeTelemetryBar from '../components/OperativeTelemetryBar';
import SelectionContinueButton from '../components/SelectionContinueButton';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import { HARVEST_YIELD_OPTIONS } from '../types/cargoGrid';
import type { HarvestYieldTier } from '../types/cargoGrid';

const TERMINAL_ACCENT = '#00ff33';

type HarvestPhase = 'SELECT' | 'PACK';

export default function ResourceHarvestScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    applyHarvestChoice,
    relocateCargoItem,
    appendRunLog,
    prepareHarvestAmbushEncounter,
  } = useRun();
  const { startPostCombatBoon, startCombat } = useGameFlow();
  const { completeCurrentNode } = useNodeProgression();
  const [phase, setPhase] = useState<HarvestPhase>('SELECT');
  const [selectedTier, setSelectedTier] = useState<HarvestYieldTier | null>(null);

  const handleConfirm = () => {
    if (!selectedTier || phase !== 'SELECT') return;
    const result = applyHarvestChoice(selectedTier);
    result.logLines.forEach((line) => appendRunLog(line));
    setPhase('PACK');
  };

  const handlePackingContinue = () => {
    if (runState.pendingAmbush) {
      prepareHarvestAmbushEncounter();
      startCombat();
      return;
    }

    const route = activeIncursion.pendingHarvestReturn;
    if (route === 'POST_COMBAT') {
      startPostCombatBoon();
      return;
    }
    completeCurrentNode(resultMessageForTier(selectedTier));
  };

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.screenBody}>
          <OperativeTelemetryBar />

          {phase === 'SELECT' ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.content}>
                <Image source={ResourceImage} style={styles.backgroundImage} resizeMode="cover" />
                <View style={styles.backgroundScrim} pointerEvents="none" />

                <View style={styles.contentForeground}>
                  <View style={[styles.docHeader, { borderBottomColor: theme.borderColor }]}>
                    <Text style={[styles.docLabel, { color: theme.mutedColor }]}>
                      OCCULT RESOURCE NODE // EXTRACTION RITUAL
                    </Text>
                    <Text style={styles.docTitle}>YIELD PROTOCOL SELECT</Text>
                  </View>

                  <View style={[styles.docBody, { borderColor: theme.borderColor }]}>
                    <Text style={[styles.scenarioText, { color: theme.primaryColor }]}>
                      Volatile Veil matter crystallized at this vector. Choose how aggressively to siphon — higher yield bleeds more resonance into the sector.
                    </Text>
                  </View>

                  <View style={styles.choiceCol}>
                    {HARVEST_YIELD_OPTIONS.map((option) => (
                      <Pressable
                        key={option.tier}
                        onPress={() => setSelectedTier(option.tier)}
                        style={({ pressed }) => [
                          styles.choiceBtn,
                          selectedTier === option.tier && styles.choiceBtnSelected,
                          {
                            borderColor: selectedTier === option.tier ? TERMINAL_ACCENT : theme.borderColor,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceLabel,
                            { color: selectedTier === option.tier ? TERMINAL_ACCENT : theme.primaryColor },
                          ]}
                        >
                          {`[ ${option.label} ]`}
                        </Text>
                        <Text style={[styles.choiceReq, { color: theme.mutedColor }]}>
                          {option.description}
                        </Text>
                      </Pressable>
                    ))}

                    <SelectionContinueButton
                      enabled={selectedTier != null}
                      onPress={handleConfirm}
                      borderColor={theme.borderColor}
                      mutedColor={theme.mutedColor}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.packBody}>
              <Image source={ResourceImage} style={styles.backgroundImage} resizeMode="cover" />
              <View style={styles.backgroundScrim} pointerEvents="none" />
              <View style={styles.contentForegroundPack}>
                <CargoPackingPanel
                  cargo={activeIncursion.cargo}
                  theme={theme}
                  onRelocateItem={relocateCargoItem}
                  onContinue={handlePackingContinue}
                  continueLabel="[ CONTINUE EXTRACTION ]"
                />
              </View>
            </View>
          )}
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

function resultMessageForTier(tier: HarvestYieldTier | null): string {
  switch (tier) {
    case 'QUICK':
      return 'Quick siphon complete — cargo staged.';
    case 'FULL':
      return 'Full extraction complete — cargo staged.';
    case 'DEEP_GORE':
      return 'Deep gore extraction complete — cargo staged.';
    default:
      return 'Resource harvest complete.';
  }
}

const styles = StyleSheet.create({
  screenBody: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, minHeight: 480, overflow: 'hidden' },
  backgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  backgroundScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 6, 8, 0.82)' },
  contentForeground: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
    padding: 14,
    paddingBottom: 24,
  },
  packBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  contentForegroundPack: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
    zIndex: 1,
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
  docBody: { borderWidth: 1, padding: 12, marginBottom: 12, backgroundColor: '#0a0b0f' },
  scenarioText: { fontFamily: 'monospace', fontSize: 10, lineHeight: 16, letterSpacing: 0.2 },
  choiceCol: { gap: 8 },
  choiceBtn: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#0a0b0f' },
  choiceBtnSelected: { backgroundColor: 'rgba(0, 255, 51, 0.08)' },
  choiceLabel: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  choiceReq: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.8, lineHeight: 11 },
});
