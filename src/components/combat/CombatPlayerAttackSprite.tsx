import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  FRONTLINE_MELEE_SPRITE_HOLD_MS,
  FRONTLINE_MELEE_SPRITE_IN_MS,
  FRONTLINE_MELEE_SPRITE_OUT_MS,
  RANGED_ATTACK_SPRITE_HOLD_MS,
  RANGED_ATTACK_SPRITE_IN_MS,
  RANGED_ATTACK_SPRITE_OUT_MS,
} from './combatEnemyBarLayout';
import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import {
  computeFootprintAttackLayout,
  computeFootprintIdleLayout,
  type FootprintBox,
} from '../../utils/combatPlayerPortrait';
import {
  AEGIS_LONGSWORD_POSE_REGISTRATION,
  PLAYER_POSE_ALIGN_DEBUG,
  computeAnatomyRegisteredLayouts,
  getPoseAlignDebugForcedPose,
  mapRegisteredSourcePointToActorBox,
  subscribePoseAlignDebugForcedPose,
  usesAnatomyPoseRegistration,
  type RegisteredPoseKind,
} from '../../utils/combatPoseRegistration';
import PlayerPoseAlignOverlay from './PlayerPoseAlignOverlay';
import LongswordWardenStrikePlayerFx from './LongswordWardenStrikePlayerFx';
import {
  WARDEN_STRIKE_TIMELINE_MS,
  WARDEN_STRIKE_VFX_LAYER_TOGGLES,
  WARDEN_STRIKE_WRAPPER_MOTION_MS,
  getWardenStrikeActiveApproachGeometry,
  lockWardenApproachGeometry,
  shouldSuppressWardenPrimedIdleAura,
  subscribeWardenStrikePresentation,
} from '../../data/wardenStrikePresentation';
import {
  buildWardenApproachGeometrySnapshot,
  clearWardenPlayerArtBox,
  registerWardenPlayerArtBox,
  setLastWardenApproachDelta,
} from '../../data/wardenStrikeApproach';
import { scalePresentationMs } from '../../data/weaponCombatPresentation/presentationSettings';
import { getCombatPresentationSettings } from '../../data/weaponCombatPresentation/presentationSettings';

const LINEAR = Easing.linear;
const PRIMED_GLOW = '#ff00ff';
/** Forceful short melee dash ease. */
const DASH_EASING = Easing.bezier(0.2, 0.9, 0.2, 1);

type WaapiAnimation = {
  cancel: () => void;
  finished: Promise<unknown>;
};

function resolveWebElement(node: unknown): HTMLElement | null {
  if (node == null || typeof node !== 'object') return null;
  const anyNode = node as {
    animate?: unknown;
    style?: CSSStyleDeclaration;
    getNode?: () => unknown;
    _nativeNode?: unknown;
  };
  if (typeof anyNode.animate === 'function' && anyNode.style) {
    return anyNode as unknown as HTMLElement;
  }
  if (typeof anyNode.getNode === 'function') {
    return resolveWebElement(anyNode.getNode());
  }
  if (anyNode._nativeNode) {
    return resolveWebElement(anyNode._nativeNode);
  }
  return null;
}

export type CombatPlayerAttackSpriteHandle = {
  executeAttackAnimation: () => Promise<void>;
  executeRangedAttackAnimation: () => Promise<void>;
};

interface CombatPlayerAttackSpriteProps {
  idleSource: ImageSourcePropType;
  attackSource: ImageSourcePropType;
  operativeClass?: ClassType;
  weaponFamilyId?: WeaponFamilyId | null;
  /** Magenta primed glow — shares idle footprint. */
  primedGlowOpacity: SharedValue<number>;
  /** Red damage wash opacity — tinted silhouette, not a box fill. */
  damageRedOpacity?: SharedValue<number>;
}

/** Idle/attack crossfade with a locked art box so portrait swaps never resize the frame. */
const CombatPlayerAttackSprite = forwardRef<CombatPlayerAttackSpriteHandle, CombatPlayerAttackSpriteProps>(
  function CombatPlayerAttackSprite({
    idleSource,
    attackSource,
    operativeClass = 'AEGIS',
    weaponFamilyId = null,
    primedGlowOpacity,
    damageRedOpacity,
  }, ref) {
    const idleOpacity = useSharedValue(1);
    const attackOpacity = useSharedValue(0);
    const anticipateX = useSharedValue(0);
    const anticipateRot = useSharedValue(0);
    const approachX = useSharedValue(0);
    const approachY = useSharedValue(0);
    const primedAuraGate = useSharedValue(1);
    const artBoxRef = useRef<View>(null);
    const motionWrapperRef = useRef<View>(null);
    const runningRef = useRef(false);
    const waapiAnimRef = useRef<WaapiAnimation | null>(null);
    const attackPaintAtRef = useRef<number | null>(null);
    const [footprintBox, setFootprintBox] = useState<FootprintBox>({ width: 0, height: 0 });
    const [forcedPose, setForcedPose] = useState(getPoseAlignDebugForcedPose);
    const [activePose, setActivePose] = useState<RegisteredPoseKind>('idle');
    const [wardenOwnsArt, setWardenOwnsArt] = useState(false);
    const [wardenHideIdlePortrait, setWardenHideIdlePortrait] = useState(false);
    /** When true, WAAPI owns the wrapper transform — Reanimated must stay at identity. */
    const [waapiOwnsMotion, setWaapiOwnsMotion] = useState(false);

    const anatomyRegistered = usesAnatomyPoseRegistration(weaponFamilyId);

    const anatomyLayouts = useMemo(
      () => (anatomyRegistered ? computeAnatomyRegisteredLayouts(footprintBox) : null),
      [anatomyRegistered, footprintBox.height, footprintBox.width],
    );

    const cancelWaapiMotion = useCallback(() => {
      try {
        waapiAnimRef.current?.cancel();
      } catch {
        // ignore
      }
      waapiAnimRef.current = null;
      const el = resolveWebElement(motionWrapperRef.current);
      if (el?.style) {
        el.style.transform = '';
      }
      setWaapiOwnsMotion(false);
    }, []);

    const publishArtBox = useCallback(() => {
      if (footprintBox.width <= 0 || footprintBox.height <= 0) return;
      const node = artBoxRef.current as (View & {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      }) | null;
      node?.measureInWindow?.((x, y, width, height) => {
        registerWardenPlayerArtBox(
          { x, y, width, height },
          { width: footprintBox.width, height: footprintBox.height },
        );
      });
    }, [footprintBox.height, footprintBox.width]);

    useEffect(() => {
      if (!anatomyRegistered) return undefined;
      return subscribePoseAlignDebugForcedPose(setForcedPose);
    }, [anatomyRegistered]);

    useEffect(() => {
      if (!anatomyRegistered) return undefined;
      publishArtBox();
      const handle = setInterval(publishArtBox, 480);
      return () => {
        clearInterval(handle);
        clearWardenPlayerArtBox();
      };
    }, [anatomyRegistered, publishArtBox]);

    useEffect(() => {
      if (!anatomyRegistered) return undefined;
      return subscribeWardenStrikePresentation((event) => {
        const settings = getCombatPresentationSettings();
        // Match presentation schedule — never accelerate Warden motion above authored ms.
        const motionSpeed = Math.min(1, settings.combatSpeed);
        const scaleMs = (ms: number) => scalePresentationMs(ms, motionSpeed);

        const suppressAura = shouldSuppressWardenPrimedIdleAura()
          && !WARDEN_STRIKE_VFX_LAYER_TOGGLES.primedIdleAuraForceShow;
        const owns = event.phase !== 'done' && event.phase !== 'idle';
        setWardenOwnsArt(owns && suppressAura);
        setWardenHideIdlePortrait(owns && suppressAura && event.phase !== 'done');

        if (event.phase === 'anticipation' || event.phase === 'release'
          || event.phase === 'contact' || event.phase === 'hold'
          || event.phase === 'recovery') {
          primedAuraGate.value = (suppressAura || shouldSuppressWardenPrimedIdleAura()) ? 0 : 1;
        }

        const snapHome = () => {
          cancelAnimation(approachX);
          cancelAnimation(approachY);
          cancelAnimation(anticipateX);
          cancelAnimation(anticipateRot);
          approachX.value = 0;
          approachY.value = 0;
          anticipateX.value = 0;
          anticipateRot.value = 0;
        };

        if (event.phase === 'done') {
          cancelWaapiMotion();
          primedAuraGate.value = 1;
          setWardenOwnsArt(false);
          setWardenHideIdlePortrait(false);
          snapHome();
          cancelAnimation(idleOpacity);
          cancelAnimation(attackOpacity);
          idleOpacity.value = 1;
          attackOpacity.value = 0;
          setActivePose('idle');
          if (
            typeof performance !== 'undefined'
            && attackPaintAtRef.current != null
            && typeof __DEV__ !== 'undefined'
            && __DEV__
          ) {
            const measuredMs = performance.now() - attackPaintAtRef.current;
            // eslint-disable-next-line no-console
            console.info('[WARDEN RENDERED DURATION]', {
              measuredAttackToIdleMs: Math.round(measuredMs),
              holdMs: WARDEN_STRIKE_WRAPPER_MOTION_MS.holdMs,
              motionTotalMs: WARDEN_STRIKE_WRAPPER_MOTION_MS.homeHoldMs
                + WARDEN_STRIKE_WRAPPER_MOTION_MS.outMs
                + WARDEN_STRIKE_WRAPPER_MOTION_MS.holdMs
                + WARDEN_STRIKE_WRAPPER_MOTION_MS.returnMs,
            });
          }
          attackPaintAtRef.current = null;
          return;
        }

        // Intermediate phases must NOT touch the wrapper transform — one sequence owns it.
        if (event.phase !== 'anticipation') return;

        cancelWaapiMotion();
        primedAuraGate.value = WARDEN_STRIKE_VFX_LAYER_TOGGLES.primedIdleAuraForceShow ? 1 : 0;
        publishArtBox();
        snapHome();
        attackPaintAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();

        // Immutable approach geometry — locked once for this player action.
        let delta = { x: 0, y: 0 };
        const existing = event.result.approachGeometry
          ?? getWardenStrikeActiveApproachGeometry();
        if (existing) {
          delta = existing.translationLocal;
          lockWardenApproachGeometry(existing);
        } else if (event.result.approachDelta) {
          delta = event.result.approachDelta;
          if (anatomyLayouts && footprintBox.width > 0) {
            const hilt = mapRegisteredSourcePointToActorBox(
              anatomyLayouts.attack,
              AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponHilt,
            );
            const tip = mapRegisteredSourcePointToActorBox(
              anatomyLayouts.attack,
              AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponTip,
            );
            const snapshot = buildWardenApproachGeometrySnapshot({
              targetId: event.result.targetId,
              hiltLocal: hilt,
              tipLocal: tip,
              approachDeltaOverride: delta,
            });
            if (snapshot) lockWardenApproachGeometry(snapshot);
          }
        } else if (anatomyLayouts && footprintBox.width > 0) {
          const hilt = mapRegisteredSourcePointToActorBox(
            anatomyLayouts.attack,
            AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponHilt,
          );
          const tip = mapRegisteredSourcePointToActorBox(
            anatomyLayouts.attack,
            AEGIS_LONGSWORD_POSE_REGISTRATION.attack.weaponTip,
          );
          const snapshot = buildWardenApproachGeometrySnapshot({
            targetId: event.result.targetId,
            hiltLocal: hilt,
            tipLocal: tip,
            approachDeltaOverride: event.result.replayOnly
              ? { x: Math.min(96, footprintBox.width * 0.32), y: -6 }
              : null,
          });
          if (snapshot) {
            delta = lockWardenApproachGeometry(snapshot).translationLocal;
          }
        }
        setLastWardenApproachDelta(delta);

        const homeMs = scaleMs(WARDEN_STRIKE_WRAPPER_MOTION_MS.homeHoldMs);
        const outMs = scaleMs(WARDEN_STRIKE_WRAPPER_MOTION_MS.outMs);
        const holdMs = scaleMs(WARDEN_STRIKE_WRAPPER_MOTION_MS.holdMs);
        const returnMs = scaleMs(WARDEN_STRIKE_WRAPPER_MOTION_MS.returnMs);
        const totalMs = homeMs + outMs + holdMs + returnMs;

        if (event.reducedMotion) {
          // Instant out / hold / snap-home — still never mid-action idle.
          approachX.value = delta.x;
          approachY.value = delta.y;
          return;
        }

        // Web: one WAAPI keyframe sequence so intermediate paints are real screen positions.
        // Double-rAF lets the home-aligned attack pose paint once before motion starts.
        if (Platform.OS === 'web') {
          const startWaapi = () => {
            const el = resolveWebElement(motionWrapperRef.current);
            if (!el || typeof el.animate !== 'function') {
              approachX.value = withSequence(
                withTiming(0, { duration: homeMs }),
                withTiming(delta.x, { duration: outMs, easing: DASH_EASING }),
                withTiming(delta.x, { duration: holdMs }),
                withTiming(0, { duration: returnMs, easing: Easing.inOut(Easing.cubic) }),
              );
              approachY.value = withSequence(
                withTiming(0, { duration: homeMs }),
                withTiming(delta.y, { duration: outMs, easing: DASH_EASING }),
                withTiming(delta.y, { duration: holdMs }),
                withTiming(0, { duration: returnMs, easing: Easing.inOut(Easing.cubic) }),
              );
              return;
            }
            setWaapiOwnsMotion(true);
            const tHome = homeMs / totalMs;
            const tContact = (homeMs + outMs) / totalMs;
            const tReturn = (homeMs + outMs + holdMs) / totalMs;
            const anim = el.animate(
              [
                { transform: 'translate(0px, 0px)', offset: 0 },
                { transform: 'translate(0px, 0px)', offset: tHome },
                { transform: `translate(${delta.x}px, ${delta.y}px)`, offset: tContact },
                { transform: `translate(${delta.x}px, ${delta.y}px)`, offset: tReturn },
                { transform: 'translate(0px, 0px)', offset: 1 },
              ],
              {
                duration: totalMs,
                easing: 'linear',
                fill: 'forwards',
              },
            ) as WaapiAnimation;
            waapiAnimRef.current = anim;
            void anim.finished.then(() => {
              if (waapiAnimRef.current !== anim) return;
              el.style.transform = 'translate(0px, 0px)';
              approachX.value = 0;
              approachY.value = 0;
            }).catch(() => {
              // cancelled
            });
          };
          requestAnimationFrame(() => {
            requestAnimationFrame(startWaapi);
          });
          return;
        }

        // Native: one Reanimated sequence — never restarted by later phases.
        approachX.value = withSequence(
          withTiming(0, { duration: homeMs }),
          withTiming(delta.x, { duration: outMs, easing: DASH_EASING }),
          withTiming(delta.x, { duration: holdMs }),
          withTiming(0, { duration: returnMs, easing: Easing.inOut(Easing.cubic) }),
        );
        approachY.value = withSequence(
          withTiming(0, { duration: homeMs }),
          withTiming(delta.y, { duration: outMs, easing: DASH_EASING }),
          withTiming(delta.y, { duration: holdMs }),
          withTiming(0, { duration: returnMs, easing: Easing.inOut(Easing.cubic) }),
        );
      });
    }, [
      anatomyLayouts,
      anatomyRegistered,
      anticipateRot,
      anticipateX,
      approachX,
      approachY,
      attackOpacity,
      cancelWaapiMotion,
      footprintBox.width,
      idleOpacity,
      primedAuraGate,
      publishArtBox,
    ]);

    useEffect(() => () => {
      cancelWaapiMotion();
      clearWardenPlayerArtBox();
    }, [cancelWaapiMotion]);

    useEffect(() => {
      if (!anatomyRegistered) return;
      if (forcedPose === 'idle') {
        cancelAnimation(idleOpacity);
        cancelAnimation(attackOpacity);
        idleOpacity.value = 1;
        attackOpacity.value = 0;
        setActivePose('idle');
      } else if (forcedPose === 'attack') {
        cancelAnimation(idleOpacity);
        cancelAnimation(attackOpacity);
        idleOpacity.value = 0;
        attackOpacity.value = 1;
        setActivePose('attack');
      }
    }, [anatomyRegistered, attackOpacity, forcedPose, idleOpacity]);

    const onArtBoxLayout = useCallback((event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setFootprintBox((prev) => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ));
    }, []);

    const runCrossfade = useCallback(
      (inMs: number, holdMs: number, outMs: number) =>
        new Promise<void>((resolve) => {
          if (forcedPose != null) {
            resolve();
            return;
          }
          runningRef.current = true;
          cancelAnimation(idleOpacity);
          cancelAnimation(attackOpacity);
          setActivePose('attack');

          const finish = () => {
            runningRef.current = false;
            setActivePose('idle');
            resolve();
          };

          idleOpacity.value = withSequence(
            withTiming(0, { duration: inMs, easing: LINEAR }),
            withDelay(holdMs, withTiming(0, { duration: 0 })),
            withTiming(1, { duration: outMs, easing: LINEAR }, () => runOnJS(finish)()),
          );

          attackOpacity.value = withSequence(
            withTiming(1, { duration: inMs, easing: LINEAR }),
            withDelay(holdMs, withTiming(1, { duration: 0 })),
            withTiming(0, { duration: outMs, easing: LINEAR }),
          );

          const totalMs = inMs + holdMs + outMs;
          setTimeout(() => {
            if (runningRef.current) finish();
          }, totalMs + 16);
        }),
      [attackOpacity, forcedPose, idleOpacity],
    );

    const runMeleeCrossfade = useCallback(
      () => runCrossfade(
        FRONTLINE_MELEE_SPRITE_IN_MS,
        FRONTLINE_MELEE_SPRITE_HOLD_MS,
        FRONTLINE_MELEE_SPRITE_OUT_MS,
      ),
      [runCrossfade],
    );

    const runRangedCrossfade = useCallback(
      () => runCrossfade(
        RANGED_ATTACK_SPRITE_IN_MS,
        RANGED_ATTACK_SPRITE_HOLD_MS,
        RANGED_ATTACK_SPRITE_OUT_MS,
      ),
      [runCrossfade],
    );

    useImperativeHandle(
      ref,
      () => ({
        executeAttackAnimation: runMeleeCrossfade,
        executeRangedAttackAnimation: runRangedCrossfade,
      }),
      [runMeleeCrossfade, runRangedCrossfade],
    );

    const idleStyle = useAnimatedStyle(() => ({
      opacity: idleOpacity.value,
    }));

    const attackStyle = useAnimatedStyle(() => ({
      opacity: attackOpacity.value,
    }));

    const primedGlowStyle = useAnimatedStyle(() => ({
      opacity: primedAuraGate.value * primedGlowOpacity.value * 0.38,
    }));

    const hasDistinctAttackArt = idleSource !== attackSource;

    const damageRedIdleStyle = useAnimatedStyle(() => ({
      opacity: (damageRedOpacity?.value ?? 0) * idleOpacity.value,
    }));

    const damageRedAttackStyle = useAnimatedStyle(() => ({
      opacity: (damageRedOpacity?.value ?? 0) * (
        hasDistinctAttackArt ? attackOpacity.value : idleOpacity.value
      ),
    }));

    const presentationStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: approachX.value + anticipateX.value },
        { translateY: approachY.value },
        { scale: 1 },
        { rotate: `${anticipateRot.value}deg` },
      ],
    }));
    const idleLayerStyle = computeFootprintIdleLayout(footprintBox, operativeClass, weaponFamilyId);
    const attackLayerStyle = computeFootprintAttackLayout(footprintBox, operativeClass, weaponFamilyId);
    const showAlignOverlay = PLAYER_POSE_ALIGN_DEBUG
      && usesAnatomyPoseRegistration(weaponFamilyId)
      && anatomyLayouts != null;
    const footOrigin = anatomyLayouts
      ? {
          transformOrigin: `${anatomyLayouts.anchor.x}px ${anatomyLayouts.anchor.y}px` as const,
        }
      : undefined;

    return (
      <View
        ref={artBoxRef}
        collapsable={false}
        style={styles.artBox}
        onLayout={onArtBoxLayout}
        pointerEvents={PLAYER_POSE_ALIGN_DEBUG && usesAnatomyPoseRegistration(weaponFamilyId) ? 'box-none' : 'none'}
      >
        {/*
          Plain wrapper owns WAAPI translate on web. Reanimated approach stays at
          identity while waapiOwnsMotion so the two systems never fight.
        */}
        <View
          ref={motionWrapperRef}
          collapsable={false}
          style={styles.innerVisual}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              anatomyRegistered && !waapiOwnsMotion ? presentationStyle : null,
              footOrigin,
            ]}
            pointerEvents="box-none"
          >
            {/* Gate every primed idle layer from owning Warden active state. */}
            {!wardenOwnsArt ? (
              <Animated.View style={[idleLayerStyle, primedGlowStyle]} pointerEvents="none">
                <Animated.Image
                  source={idleSource}
                  resizeMode="contain"
                  style={[styles.fill, styles.auraScale, { tintColor: PRIMED_GLOW }]}
                />
              </Animated.View>
            ) : null}
            {!wardenHideIdlePortrait ? (
              <Animated.Image
                source={idleSource}
                resizeMode="contain"
                style={[idleLayerStyle, idleStyle, styles.poseIdleZ]}
              />
            ) : null}
            {/* Smear mounts under the attack pose (zIndex) but above the arena background. */}
            {anatomyRegistered ? (
              <LongswordWardenStrikePlayerFx box={footprintBox} />
            ) : null}
            {hasDistinctAttackArt ? (
              <Animated.Image
                source={attackSource}
                resizeMode="contain"
                style={[attackLayerStyle, attackStyle, styles.poseAttackZ]}
              />
            ) : null}
            {/* Red damage wash — tinted silhouette only (follows pose alpha). */}
            {damageRedOpacity ? (
              <>
                <Animated.Image
                  source={idleSource}
                  resizeMode="contain"
                  tintColor="#b91c1c"
                  style={[idleLayerStyle, damageRedIdleStyle, styles.damageRedZ]}
                />
                {hasDistinctAttackArt ? (
                  <Animated.Image
                    source={attackSource}
                    resizeMode="contain"
                    tintColor="#b91c1c"
                    style={[attackLayerStyle, damageRedAttackStyle, styles.damageRedZ]}
                  />
                ) : null}
              </>
            ) : null}
          </Animated.View>
        </View>
        {showAlignOverlay && anatomyLayouts ? (
          <PlayerPoseAlignOverlay
            box={footprintBox}
            idle={anatomyLayouts.idle}
            attack={anatomyLayouts.attack}
            anchor={anatomyLayouts.anchor}
            activePose={forcedPose ?? activePose}
          />
        ) : null}
      </View>
    );
  },
);

export default CombatPlayerAttackSprite;

const styles = StyleSheet.create({
  artBox: {
    width: '100%',
    height: '100%',
    minHeight: 120,
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  innerVisual: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'visible',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  auraScale: {
    transform: [{ scale: 1.08 }],
  },
  poseIdleZ: {
    zIndex: 2,
  },
  poseAttackZ: {
    zIndex: 4,
  },
  damageRedZ: {
    zIndex: 5,
  },
});
