import React from 'react';
import { StyleSheet, View } from 'react-native';
import EnvoyWardOverlay from './EnvoyWardOverlay';
import { useCombatEnemyChromeOptional } from '../../context/CombatEnemyChromeContext';
import ParryMatrixOverlay from './ParryMatrixOverlay';
import ParrySuccessBurstOverlay from './ParrySuccessBurstOverlay';

/** Full-screen parry layer — dim scrim + centered matrix over arena and command deck. */
export default function CombatParryScreenOverlay(): React.JSX.Element | null {
  const ctx = useCombatEnemyChromeOptional();
  if (!ctx) return null;

  const { ui, handlersRef, parryBurstLiveRef, parryChromeTick } = ctx;
  void parryChromeTick;

  const {
    parryVisible,
    wardVisible,
    envoyWardSpeed,
    parrySuccess,
    parryFailure,
    parrySuccessBurstVisible,
    parryBurstArena,
  } = ui;

  const burstLive = parryBurstLiveRef.current;
  const showParryBurst = (burstLive.active && burstLive.arena != null)
    || (parrySuccessBurstVisible && parryBurstArena != null);
  const parryBurstLayout = burstLive.active && burstLive.arena != null
    ? burstLive.arena
    : parryBurstArena;
  const parryBurstKey = burstLive.epoch;

  if (!parryVisible && !wardVisible && !showParryBurst) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none" collapsable={false}>
      {wardVisible ? (
        <EnvoyWardOverlay
          visible
          expansionSpeed={envoyWardSpeed}
          onRelease={(ratio) => handlersRef.current.onEnvoyWardRelease(ratio)}
        />
      ) : null}
      {parryVisible && handlersRef.current.parryShrinkScale ? (
        <ParryMatrixOverlay
          visible
          shrinkScale={handlersRef.current.parryShrinkScale}
          success={parrySuccess}
          failure={parryFailure}
          onTap={(tapX, tapY) => handlersRef.current.onParryTap(tapX, tapY)}
          onArenaLayout={(layout) => handlersRef.current.registerParryArena(layout)}
        />
      ) : null}
      {showParryBurst && parryBurstLayout ? (
        <View style={styles.burstHost} pointerEvents="none">
          <View
            style={{
              width: parryBurstLayout.width,
              height: parryBurstLayout.height,
            }}
          >
            <ParrySuccessBurstOverlay
              key={parryBurstKey}
              burstEpoch={parryBurstKey}
              arena={parryBurstLayout}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
  },
  burstHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
