/**
 * Player-local Longsword Warden smear / audio.
 * Contact burst + incision + Fracture live on the enemy portrait center host.
 */

import {
  WARDEN_STRIKE_TIMELINE_MS,
  WARDEN_STRIKE_VFX_LAYER_TOGGLES,
  replayWardenStrikeFixture,
  subscribeWardenStrikePresentation,
  type WardenStrikePresentationPhase,
} from '../../data/wardenStrikePresentation';
import { playCombatPresentationCue, unlockCombatPresentationAudio } from '../../utils/combatPresentationAudio';
import {
  PLAYER_POSE_ALIGN_DEBUG,
  buildLongswordSweptBladeSamples,
  computeAnatomyRegisteredLayouts,
  setPoseAlignDebugForcedPose,
  type PoseFootprintBox,
} from '../../utils/combatPoseRegistration';
import { scalePresentationMs } from '../../data/weaponCombatPresentation/presentationSettings';
import { getCombatPresentationSettings } from '../../data/weaponCombatPresentation/presentationSettings';
import LongswordSwingTrail from './LongswordSwingTrail';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface LongswordWardenStrikePlayerFxProps {
  box: PoseFootprintBox;
}

export default function LongswordWardenStrikePlayerFx({
  box,
}: LongswordWardenStrikePlayerFxProps): React.JSX.Element | null {
  const [, setPhase] = useState<WardenStrikePresentationPhase>('idle');
  const [trailActive, setTrailActive] = useState(false);
  const [reducedFlash, setReducedFlash] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const smearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smearClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fixtureLabel, setFixtureLabel] = useState<string | null>(null);

  const layouts = useMemo(
    () => computeAnatomyRegisteredLayouts(box),
    [box.height, box.width],
  );

  useEffect(() => subscribeWardenStrikePresentation((event) => {
    setPhase(event.phase);
    setReducedFlash(event.reducedFlash);
    setReducedMotion(event.reducedMotion);
    const src = event.result.resultSource ?? '';
    setFixtureLabel(src.startsWith('fixture:') ? src.slice('fixture:'.length) : (
      event.result.replayOnly ? (src || 'REPLAY') : null
    ));

    const motionSpeed = Math.min(1, getCombatPresentationSettings().combatSpeed);

    if (event.phase === 'anticipation') {
      if (smearTimerRef.current) clearTimeout(smearTimerRef.current);
      if (smearClearRef.current) clearTimeout(smearClearRef.current);
      smearTimerRef.current = null;
      smearClearRef.current = null;
      setTrailActive(false);
      setPoseAlignDebugForcedPose('attack');
      const delay = scalePresentationMs(WARDEN_STRIKE_TIMELINE_MS.smearStart, motionSpeed);
      smearTimerRef.current = setTimeout(() => {
        setTrailActive(true);
        if (!event.reducedMotion) {
          try {
            unlockCombatPresentationAudio();
            const missed = event.result.outcome === 'EVADE' || event.result.outcome === 'MISS';
            if (missed) {
              playCombatPresentationCue('sfx.aegis.miss');
            } else {
              // Metal woosh + body thud together — shortly after lunge begins (smear beat).
              playCombatPresentationCue('sfx.aegis.longsword_swing');
              playCombatPresentationCue('sfx.aegis.longsword_body');
            }
          } catch {
            // Presentation must never block combat.
          }
        }
        const trailLife = scalePresentationMs(WARDEN_STRIKE_TIMELINE_MS.trailLifetime, motionSpeed);
        smearClearRef.current = setTimeout(() => {
          setTrailActive(false);
          smearClearRef.current = null;
        }, trailLife);
      }, delay);
    } else if (event.phase === 'contact') {
      if (WARDEN_STRIKE_VFX_LAYER_TOGGLES.recoilIsolationMode) {
        setPoseAlignDebugForcedPose('idle');
      } else {
        setPoseAlignDebugForcedPose('attack');
      }
    } else if (
      event.phase === 'release'
      || event.phase === 'feedback'
      || event.phase === 'hold'
      || event.phase === 'recovery'
    ) {
      if (!WARDEN_STRIKE_VFX_LAYER_TOGGLES.recoilIsolationMode) {
        setPoseAlignDebugForcedPose('attack');
      }
    } else if (event.phase === 'done') {
      setPoseAlignDebugForcedPose('idle');
      setFixtureLabel(null);
      setTimeout(() => {
        setPoseAlignDebugForcedPose(null);
      }, 0);
    }
  }), []);

  useEffect(() => () => {
    if (smearTimerRef.current) clearTimeout(smearTimerRef.current);
    if (smearClearRef.current) clearTimeout(smearClearRef.current);
    setPoseAlignDebugForcedPose(null);
  }, []);

  const bladeSamples = useMemo(() => {
    if (!layouts) return [];
    return buildLongswordSweptBladeSamples(layouts.idle, layouts.attack, 4);
  }, [layouts]);

  if (box.width <= 0 || box.height <= 0) return null;

  const showTrail = trailActive && WARDEN_STRIKE_VFX_LAYER_TOGGLES.swingTrail;

  return (
    <View style={[StyleSheet.absoluteFill, styles.smearPlane]} pointerEvents="box-none">
      {fixtureLabel ? (
        <Text style={styles.fixtureBanner}>{`REPLAY WS ${fixtureLabel.toUpperCase()}`}</Text>
      ) : null}
      {showTrail ? (
        <LongswordSwingTrail
          samples={bladeSamples}
          active={showTrail}
          reducedFlash={reducedFlash}
          reducedMotion={reducedMotion}
          actorBoxWidth={box.width}
        />
      ) : null}
      {PLAYER_POSE_ALIGN_DEBUG ? (
        <View style={styles.fixtureRow} pointerEvents="box-none">
          {([
            ['cleanHit', 'HIT'],
            ['fractureHit', 'FX'],
            ['miss', 'MISS'],
            ['farTarget', 'FAR'],
            ['smearIsolation', 'SMR'],
          ] as const).map(([id, label]) => (
            <Pressable
              key={id}
              style={styles.fixtureBtn}
              onPress={() => {
                replayWardenStrikeFixture(id);
              }}
            >
              <Text style={styles.fixtureBtnText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  smearPlane: {
    zIndex: 1,
  },
  fixtureBanner: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    color: '#9ff5d0',
    fontSize: 10,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 30,
  },
  fixtureRow: {
    position: 'absolute',
    right: 4,
    top: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 2,
    maxWidth: 160,
    zIndex: 21,
  },
  fixtureBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(159,245,208,0.45)',
  },
  fixtureBtnText: {
    color: '#9ff5d0',
    fontSize: 9,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    fontWeight: '700',
  },
});
