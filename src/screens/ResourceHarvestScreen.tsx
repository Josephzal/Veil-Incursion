import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import ResourceHarvestBg from '../../assets/images/location images/resource_harvest.png';
import CargoPackingPanel from '../components/CargoPackingPanel';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';

export default function ResourceHarvestScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    applyHarvestChoice,
    relocateCargoItem,
    discardCargoInstance,
    appendRunLog,
    prepareHarvestAmbushEncounter,
  } = useRun();
  const { startCombat } = useGameFlow();
  const { completeCurrentNode } = useNodeProgression();
  const harvestAppliedRef = useRef(false);

  useEffect(() => {
    if (harvestAppliedRef.current) return;
    if (activeIncursion.pendingHarvestReturn === 'RESOURCE_CACHE') return;
    harvestAppliedRef.current = true;
    const result = applyHarvestChoice('FULL');
    result.logLines.forEach((line) => appendRunLog(line));
  }, [activeIncursion.pendingHarvestReturn, appendRunLog, applyHarvestChoice]);

  const handlePackingContinue = () => {
    if (runState.pendingAmbush) {
      prepareHarvestAmbushEncounter();
      startCombat();
      return;
    }

    const route = activeIncursion.pendingHarvestReturn;
    if (route === 'RESOURCE_CACHE') {
      completeCurrentNode('Resource cache secured — cargo packed.');
      return;
    }
    if (route === 'POST_COMBAT') {
      completeCurrentNode('Harvest secured — returning to Ley-line grid.');
      return;
    }
    completeCurrentNode('Resource harvest complete.');
  };

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.screenBody}>
          <Image source={ResourceHarvestBg} style={styles.backgroundImage} resizeMode="cover" />
          <View style={styles.backgroundScrim} pointerEvents="none" />
          <View style={styles.contentForegroundPack}>
            <CargoPackingPanel
              cargo={activeIncursion.cargo}
              theme={theme}
              onRelocateItem={relocateCargoItem}
              onDiscardItem={discardCargoInstance}
              showCreditsHud={false}
              onContinue={handlePackingContinue}
              continueLabel={
                activeIncursion.pendingHarvestReturn === 'RESOURCE_CACHE'
                  ? '[ CONTINUE TO GRID ]'
                  : '[ CONTINUE RUN ]'
              }
            />
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
    overflow: 'hidden',
  },
  backgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  backgroundScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 6, 8, 0.72)' },
  contentForegroundPack: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
    zIndex: 1,
  },
});
