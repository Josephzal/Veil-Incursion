import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  Vibration,
  View,
  type ViewStyle,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import FieldPlate from '../runField/FieldPlate';
import SpectralSelectAura, {
  type SpectralAuraPhase,
} from '../runField/SpectralSelectAura';
import { RUN_FIELD } from '../../theme/runFieldTokens';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { pulseHubButton } from '../../utils/hubButtonHaptics';
import {
  releaseBoonHoldSfx,
  startBoonHoldSfx,
  stopBoonHoldSfx,
} from '../../utils/boonSelectionFeedbackAudio';
import { readPressableHover } from '../../utils/terminalHoverStyle';

const HOLD_MS = 1000;
const HOLD_SHAKE_MS = 70;

export interface RunEventChoiceCardProps {
  tierTag: string;
  name: string;
  tagline?: string;
  effectSummary: string;
  tradeoffSummary?: string;
  cardWidth: number | '100%';
  cardPadding: number;
  isDesktop: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  disabled: boolean;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  fontScale: number;
  scaleFont: (base: number) => number;
  /** Fires after a successful 1s hold-to-bind. */
  onPress: () => void;
  /** Occult offer variant — magenta haze when selected. */
  occult?: boolean;
  lockReason?: string;
}

function offerNameStyle(scaleFont: (base: number) => number): object {
  // RN lineHeight is always px — never pass CSS unitless ratios.
  if (Platform.OS === 'web') {
    return {
      fontSize: `clamp(${RUN_FIELD.type.offerNameMin}px, 1.3vw, ${RUN_FIELD.type.offerNameMax}px)`,
      lineHeight: `${Math.round(RUN_FIELD.type.offerNameMax * 1.2)}px`,
    };
  }
  const size = scaleFont(RUN_FIELD.type.offerName);
  return { fontSize: size, lineHeight: Math.round(size * 1.2) };
}

/**
 * Shared offer / choice card for boons, requisitions, and similar selections.
 * Hover wakes a spectral purple aura; hold 1s to bind (vibrate + burst).
 */
export default function RunEventChoiceCard({
  tierTag,
  name,
  tagline,
  effectSummary,
  tradeoffSummary,
  cardWidth,
  cardPadding,
  isDesktop,
  isSelected,
  isDimmed,
  disabled,
  fontScale,
  scaleFont,
  onPress,
  occult = false,
  lockReason,
}: RunEventChoiceCardProps): React.JSX.Element {
  const [holding, setHolding] = useState(false);
  /** Local bind latch so selected glow never dips for a frame before parent isSelected. */
  const [ritualBound, setRitualBound] = useState(isSelected);
  const [burstToken, setBurstToken] = useState(0);
  const holdAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const shakeLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const completedRef = useRef(false);
  const holdProgress = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const selectFlash = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const hapticTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const effectivelySelected = isSelected || ritualBound;
  const interactiveLocked = disabled || isDimmed || effectivelySelected;

  useEffect(() => {
    if (isSelected) {
      setRitualBound(true);
      holdProgress.setValue(1);
    }
  }, [holdProgress, isSelected]);

  /** Light breath only after bind — during hold the glow just grows with charge. */
  useEffect(() => {
    breathLoopRef.current?.stop();
    breathLoopRef.current = null;
    if (!effectivelySelected) {
      breath.stopAnimation();
      breath.setValue(0);
      return;
    }
    breath.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    breathLoopRef.current = loop;
    loop.start();
    return () => {
      breathLoopRef.current?.stop();
      breathLoopRef.current = null;
    };
  }, [breath, effectivelySelected]);

  const stopHaptics = () => {
    if (hapticTimerRef.current) {
      clearInterval(hapticTimerRef.current);
      hapticTimerRef.current = null;
    }
  };

  const stopShake = () => {
    shakeLoopRef.current?.stop();
    shakeLoopRef.current = null;
    shakeX.stopAnimation();
    shakeX.setValue(0);
  };

  const cancelHold = (resetProgress: boolean) => {
    holdAnimRef.current?.stop();
    holdAnimRef.current = null;
    setHolding(false);
    stopShake();
    stopHaptics();
    if (!completedRef.current) {
      releaseBoonHoldSfx('abort');
    }
    if (resetProgress && !completedRef.current && !ritualBound) {
      Animated.timing(holdProgress, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    }
  };

  const startHold = () => {
    if (interactiveLocked) return;
    completedRef.current = false;
    setHolding(true);
    holdProgress.stopAnimation();
    // Seed a faint hover glow, then ramp — no snap from zero.
    holdProgress.setValue(0.12);
    startBoonHoldSfx();

    stopShake();
    const shake = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeX, {
          toValue: 1.6,
          duration: HOLD_SHAKE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(shakeX, {
          toValue: -1.6,
          duration: HOLD_SHAKE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(shakeX, {
          toValue: 0.8,
          duration: HOLD_SHAKE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(shakeX, {
          toValue: 0,
          duration: HOLD_SHAKE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    shakeLoopRef.current = shake;
    shake.start();

    stopHaptics();
    Vibration.vibrate(12);
    hapticTimerRef.current = setInterval(() => {
      Vibration.vibrate(10);
    }, 160);

    const anim = Animated.timing(holdProgress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    holdAnimRef.current = anim;
    anim.start(({ finished }) => {
      holdAnimRef.current = null;
      if (!finished || completedRef.current) return;
      completedRef.current = true;
      // Latch selected visuals before clearing hold so glow never dips.
      setRitualBound(true);
      holdProgress.setValue(1);
      setHolding(false);
      stopShake();
      stopHaptics();
      releaseBoonHoldSfx('complete');
      setBurstToken((n) => n + 1);
      selectFlash.stopAnimation();
      selectFlash.setValue(0);
      Animated.timing(selectFlash, {
        toValue: 1,
        duration: 860,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      pulseHubButton();
      Vibration.vibrate([0, 18, 30, 22]);
      onPress();
    });
  };

  useEffect(() => () => {
    holdAnimRef.current?.stop();
    stopShake();
    stopHaptics();
    stopBoonHoldSfx();
  }, []);

  useEffect(() => {
    if (interactiveLocked) cancelHold(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lock edge only
  }, [interactiveLocked]);

  const cardFrameStyle: ViewStyle = {
    ...(isDesktop && typeof cardWidth === 'number' ? { width: cardWidth } : { width: '100%' }),
    flex: 1,
    alignSelf: 'stretch',
  };

  const classificationSize = scaleFont(Math.min(12, Math.max(11, RUN_FIELD.type.eyebrow)));
  const descriptorSize = scaleFont(RUN_FIELD.type.offerDescriptor);
  const effectSize = scaleFont(RUN_FIELD.type.offerEffect);
  const metaSize = scaleFont(Math.min(13, Math.max(11, RUN_FIELD.type.secondary)));
  const visualHeight = Math.min(120, Math.max(88, scaleFont(100)));
  const nameLineHeight = Platform.OS === 'web'
    ? Math.round(RUN_FIELD.type.offerNameMax * 1.2)
    : Math.round(scaleFont(RUN_FIELD.type.offerName) * 1.2);
  const nameSlotHeight = nameLineHeight * 2;
  const taglineLineHeight = Math.round(descriptorSize * 1.35);
  /** Always reserve two tagline lines so the visual well shares a Y across the spread. */
  const taglineSlotHeight = taglineLineHeight * 2;

  /** Hover/selected title always reads mint — occult supplies haze only, never the accent text color. */
  const hotColor = RUN_FIELD.mint;

  /** Perimeter glow grows with hold charge; after bind, breath modulates it lightly. */
  const edgeGlowOpacity = Animated.multiply(
    holdProgress.interpolate({
      inputRange: [0, 0.12, 1],
      outputRange: [0, 0.28, 1],
    }),
    breath.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.78],
    }),
  );
  const edgeHaloOpacity = Animated.multiply(
    holdProgress.interpolate({
      inputRange: [0, 0.12, 1],
      outputRange: [0, 0.18, 0.95],
    }),
    breath.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.72],
    }),
  );
  const edgeShadowRadius = Animated.add(
    holdProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [8, 24],
    }),
    breath.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 6],
    }),
  );
  /** Select-only purple outline: bursts outward then fully fades. */
  const flashOpacity = selectFlash.interpolate({
    inputRange: [0, 0.1, 0.4, 1],
    outputRange: [0, 1, 0.45, 0],
  });
  const flashScale = selectFlash.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.28],
  });
  const flashGlowOpacity = selectFlash.interpolate({
    inputRange: [0, 0.12, 0.5, 1],
    outputRange: [0, 0.75, 0.28, 0],
  });

  return (
    <View
      style={[
        cardFrameStyle,
        styles.pressableFill,
        isDimmed ? styles.dimmed : null,
      ]}
    >
      <HapticPressable
        haptic={false}
        sfx={!interactiveLocked}
        disabled={interactiveLocked}
        delayLongPress={10_000}
        onPressIn={startHold}
        onPressOut={() => cancelHold(true)}
        accessibilityRole="button"
        accessibilityState={{ selected: effectivelySelected, disabled: interactiveLocked }}
        accessibilityHint={
          effectivelySelected
            ? 'Offer bound'
            : 'Press and hold for one second to bind this offer'
        }
        style={(pressState) => {
          const hovered = !interactiveLocked
            && (readPressableHover(pressState) || pressState.pressed || holding);
          return [
            styles.pressableFill,
            hovered && !effectivelySelected ? styles.hoverLift : null,
          ];
        }}
      >
        {(pressState) => {
          const hovered = !interactiveLocked
            && (readPressableHover(pressState) || pressState.pressed || holding);
          // Keep FieldPlate off the mint "selected" fill — purple edge/aura carry the bind look.
          const plateState = interactiveLocked && !effectivelySelected
            ? 'locked'
            : holding || hovered || effectivelySelected
              ? 'hover'
              : 'idle';

          const auraPhase: SpectralAuraPhase = effectivelySelected
            ? 'selected'
            : holding
              ? 'holding'
              : hovered
                ? 'hover'
                : 'idle';

          const resolvedTitleColor = effectivelySelected || hovered || holding
            ? hotColor
            : RUN_FIELD.text;

          const hint = effectivelySelected
            ? 'BOUND'
            : holding
              ? 'BINDING…'
              : hovered
                ? 'HOLD'
                : null;

          const showGlow = holding || effectivelySelected || (hovered && !interactiveLocked);
          const hoverOnly = hovered && !holding && !effectivelySelected;

          return (
            <View style={styles.plateHost}>
              {/* Aura stays anchored — only the plate vibrates while holding. */}
              <SpectralSelectAura
                phase={auraPhase}
                charge={holdProgress}
                burstToken={burstToken}
              />
              {showGlow ? (
                <>
                  {/* Outer halo + edge glow — grow with hold, breathe once bound. */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.edgeHalo,
                      hoverOnly
                        ? styles.edgeHaloHover
                        : {
                            opacity: edgeHaloOpacity,
                            shadowRadius: edgeShadowRadius,
                          },
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.edgeRing,
                      hoverOnly
                        ? styles.edgeRingHover
                        : { opacity: edgeGlowOpacity },
                    ]}
                  />
                  {/* Bind confirm: purple outline bursts then fades; sustained glow remains. */}
                  {effectivelySelected ? (
                    <>
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.selectFlashGlow,
                          {
                            opacity: flashGlowOpacity,
                            transform: [{ scale: flashScale }],
                          },
                        ]}
                      />
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.selectFlashRing,
                          {
                            opacity: flashOpacity,
                            transform: [{ scale: flashScale }],
                          },
                        ]}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              <Animated.View
                style={[
                  styles.plateShakeHost,
                  { transform: [{ translateX: shakeX }] },
                ]}
              >
              <FieldPlate
                density="standard"
                tone={occult || hovered || holding || effectivelySelected ? 'occult' : 'neutral'}
                state={plateState}
                showSelectedMark={effectivelySelected}
                style={[
                  styles.plate,
                  (effectivelySelected || holding) ? styles.plateSelectedSpectral : null,
                ]}
                contentStyle={[styles.content, { padding: Math.min(cardPadding, 16) }]}
              >
                <View style={styles.tierRow}>
                  <Text
                    style={[
                      styles.tier,
                      { fontSize: classificationSize, color: RUN_FIELD.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {tierTag}
                  </Text>
                  {hint ? (
                    <Text
                      style={[
                        styles.selectHint,
                        { fontSize: classificationSize },
                        holding || effectivelySelected ? styles.selectHintHot : null,
                      ]}
                    >
                      {hint}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.copyBand}>
                  <View style={[styles.nameSlot, { height: nameSlotHeight }]}>
                    <Text
                      style={[
                        styles.name,
                        offerNameStyle(scaleFont),
                        { color: resolvedTitleColor },
                      ]}
                      numberOfLines={2}
                    >
                      {name}
                    </Text>
                  </View>
                  <View style={[styles.taglineSlot, { height: taglineSlotHeight }]}>
                    {tagline ? (
                      <Text
                        style={[
                          styles.tagline,
                          {
                            fontSize: descriptorSize,
                            lineHeight: taglineLineHeight,
                            color: RUN_FIELD.textSecondary,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {tagline}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={[styles.visualWell, { height: visualHeight }]}>
                  <View
                    style={[
                      styles.sigil,
                      occult || hovered || holding || effectivelySelected
                        ? styles.sigilOccult
                        : styles.sigilMint,
                      (effectivelySelected || hovered || holding) ? styles.sigilOccultHot : null,
                    ]}
                  />
                </View>

                <View style={styles.effectSurface}>
                  <Text
                    style={[
                      styles.effect,
                      {
                        fontSize: effectSize,
                        lineHeight: Math.round(effectSize * 1.4),
                        color: RUN_FIELD.text,
                      },
                    ]}
                    numberOfLines={6}
                  >
                    {effectSummary}
                  </Text>
                  {tradeoffSummary ? (
                    <Text
                      style={[
                        styles.tradeoff,
                        {
                          fontSize: metaSize,
                          lineHeight: Math.round(metaSize * 1.35),
                          color: RUN_FIELD.textSecondary,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {tradeoffSummary}
                    </Text>
                  ) : null}
                </View>
                {disabled && lockReason ? (
                  <Text style={[styles.lockReason, { fontSize: metaSize }]} numberOfLines={2}>
                    {lockReason}
                  </Text>
                ) : null}
              </FieldPlate>
              </Animated.View>
            </View>
          );
        }}
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressableFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  dimmed: {
    opacity: 0.42,
  },
  hoverLift: {
    transform: [{ translateY: -1 }],
  },
  plateHost: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  plateShakeHost: {
    flex: 1,
    width: '100%',
    zIndex: 1,
  },
  edgeHalo: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(230, 130, 210, 0.55)',
    shadowColor: 'rgb(245, 130, 215)',
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  edgeHaloHover: {
    opacity: 0.22,
    shadowRadius: 10,
    borderColor: 'rgba(210, 110, 195, 0.4)',
  },
  edgeRing: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    borderWidth: 2,
    borderColor: 'rgba(248, 150, 220, 0.92)',
    shadowColor: 'rgb(245, 120, 210)',
    shadowOpacity: 0.95,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  edgeRingHover: {
    opacity: 0.36,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 128, 210, 0.7)',
  },
  selectFlashGlow: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    borderWidth: 0,
    backgroundColor: 'rgba(200, 70, 170, 0.06)',
    shadowColor: 'rgb(255, 150, 230)',
    shadowOpacity: 1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  selectFlashRing: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    borderWidth: 2,
    borderColor: 'rgba(240, 150, 220, 0.95)',
    backgroundColor: 'transparent',
    shadowColor: 'rgb(255, 140, 220)',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  plate: {
    width: '100%',
    flex: 1,
    overflow: 'visible',
    zIndex: 1,
  },
  plateSelectedSpectral: {
    borderColor: 'rgba(226, 120, 204, 0.85)',
    shadowColor: 'rgb(210, 90, 190)',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  content: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexShrink: 0,
  },
  tier: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  selectHint: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: 'rgba(210, 120, 200, 0.92)',
    flexShrink: 0,
  },
  selectHintHot: {
    color: 'rgba(232, 160, 220, 1)',
  },
  copyBand: {
    flexShrink: 0,
    gap: 8,
  },
  nameSlot: {
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  taglineSlot: {
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  name: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tagline: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  visualWell: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RUN_FIELD.line,
    backgroundColor: 'rgba(5, 9, 10, 0.35)',
  },
  sigil: {
    width: 28,
    height: 28,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  sigilMint: {
    borderColor: 'rgba(99, 226, 177, 0.4)',
    backgroundColor: 'rgba(99, 226, 177, 0.07)',
  },
  sigilOccult: {
    borderColor: 'rgba(190, 82, 164, 0.45)',
    backgroundColor: 'rgba(190, 82, 164, 0.09)',
  },
  sigilHot: {
    borderColor: RUN_FIELD.mintBorderHot,
    backgroundColor: RUN_FIELD.mintSoft,
  },
  sigilOccultHot: {
    borderColor: 'rgba(210, 110, 200, 0.85)',
    backgroundColor: 'rgba(190, 82, 164, 0.22)',
  },
  effectSurface: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 8,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RUN_FIELD.line,
    backgroundColor: 'rgba(5, 9, 10, 0.28)',
  },
  effect: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  tradeoff: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '500',
  },
  lockReason: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: RUN_FIELD.danger,
    marginTop: 4,
    flexShrink: 0,
  },
});
