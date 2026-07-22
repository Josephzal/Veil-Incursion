import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  type ImageSourcePropType,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import TerminalText from '../../TerminalText';

export type MediaStageFeedbackPhase =
  | 'idle'
  | 'accepted'
  | 'converging'
  | 'assembling'
  | 'sealing'
  | 'complete';

interface BlackMarketMediaStageProps {
  source?: ImageSourcePropType | null;
  classification?: string;
  compact?: boolean;
  /** When true and no source, show a restrained unavailable label. */
  showUnavailable?: boolean;
  children?: React.ReactNode;
  /** Fabrication seal sequence phase — decorative only. */
  feedbackPhase?: MediaStageFeedbackPhase;
  reducedMotion?: boolean;
  occult?: boolean;
}

/** Shared dossier media stage — registration frame + optional canonical artwork. */
export default function BlackMarketMediaStage({
  source,
  classification,
  compact = false,
  showUnavailable = false,
  children,
  feedbackPhase = 'idle',
  reducedMotion = false,
  occult = false,
}: BlackMarketMediaStageProps): React.JSX.Element {
  const assemble = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const sealFlash = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const ringSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      assemble.setValue(feedbackPhase === 'idle' ? 0 : 1);
      sealFlash.setValue(0);
      shake.setValue(0);
      lift.setValue(0);
      scan.setValue(0);
      ringSpin.setValue(0);
      return undefined;
    }

    if (feedbackPhase === 'assembling') {
      assemble.setValue(0);
      scan.setValue(0);
      ringSpin.setValue(0);
      Animated.parallel([
        Animated.timing(assemble, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(scan, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(ringSpin, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }

    if (feedbackPhase === 'sealing') {
      sealFlash.setValue(0);
      shake.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(sealFlash, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(sealFlash, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 40, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 40, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0.5, duration: 35, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
        ]),
      ]).start();
    }

    if (feedbackPhase === 'complete') {
      lift.setValue(0);
      Animated.sequence([
        Animated.timing(lift, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
      assemble.setValue(1);
    }

    if (feedbackPhase === 'idle') {
      assemble.setValue(0);
      sealFlash.setValue(0);
      shake.setValue(0);
      lift.setValue(0);
      scan.setValue(0);
      ringSpin.setValue(0);
    }

    return undefined;
  }, [assemble, feedbackPhase, lift, reducedMotion, ringSpin, scan, sealFlash, shake]);

  const assembling = feedbackPhase === 'assembling'
    || feedbackPhase === 'sealing'
    || feedbackPhase === 'complete';
  const fragmentOffset = assemble.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });
  const fragmentOpacity = assemble.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.25, 0.7, 1],
  });
  const scanY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [0, compact ? 110 : 140],
  });
  const shakeX = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-2, 0, 2],
  });
  const liftY = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });
  const ringRotate = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '10deg'],
  });

  const content = source ? (
    <Animated.View
      style={[
        styles.contentWrap,
        {
          opacity: assembling ? fragmentOpacity : 1,
          transform: [
            { translateX: shakeX },
            { translateY: Animated.add(liftY, fragmentOffset) },
          ],
        },
      ]}
    >
      {assembling && !reducedMotion ? (
        <>
          <Animated.View
            style={[
              styles.fragment,
              styles.fragmentA,
              {
                opacity: fragmentOpacity,
                transform: [{ translateX: fragmentOffset }],
              },
            ]}
          >
            <Image
              source={source}
              style={[styles.image, compact && styles.imageCompact]}
              resizeMode="contain"
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.fragment,
              styles.fragmentB,
              {
                opacity: fragmentOpacity,
                transform: [{ translateX: Animated.multiply(fragmentOffset, -1) }],
              },
            ]}
          >
            <Image
              source={source}
              style={[styles.image, compact && styles.imageCompact]}
              resizeMode="contain"
            />
          </Animated.View>
        </>
      ) : null}
      <Image
        source={source}
        style={[
          styles.image,
          compact && styles.imageCompact,
          assembling && !reducedMotion && styles.imageAssemblingBase,
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  ) : children ? (
    <Animated.View
      style={{
        opacity: assembling ? fragmentOpacity : 1,
        transform: [{ translateX: shakeX }, { translateY: liftY }],
      }}
    >
      {children}
    </Animated.View>
  ) : showUnavailable ? (
    <TerminalText size={7} letterSpacing={0.8} style={styles.unavailable}>
      VISUAL RECORD UNAVAILABLE
    </TerminalText>
  ) : null;

  return (
    <Animated.View
      style={[
        styles.stage,
        compact && styles.stageCompact,
        { transform: [{ translateX: shakeX }] },
      ]}
    >
      <View
        pointerEvents="none"
        accessible={false}
        {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
        style={[
          styles.glow,
          (feedbackPhase === 'assembling' || feedbackPhase === 'sealing') && styles.glowHot,
          occult && styles.glowOccult,
        ]}
      />
      <View style={[styles.bracket, styles.bracketTL]} />
      <View style={[styles.bracket, styles.bracketTR]} />
      <View style={[styles.bracket, styles.bracketBL]} />
      <View style={[styles.bracket, styles.bracketBR]} />

      <Animated.View
        pointerEvents="none"
        accessible={false}
        {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
        style={[
          styles.calLayer,
          assembling && { transform: [{ rotate: ringRotate }] },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 200 160">
          <Circle
            cx="100"
            cy="80"
            r="54"
            stroke={
              feedbackPhase === 'sealing' || feedbackPhase === 'complete'
                ? 'rgba(105,200,173,0.45)'
                : 'rgba(137,170,163,0.12)'
            }
            strokeWidth="1"
            fill="none"
          />
          <Circle cx="100" cy="80" r="34" stroke="rgba(137,170,163,0.08)" strokeWidth="1" fill="none" />
          <Line x1="100" y1="18" x2="100" y2="34" stroke="rgba(137,170,163,0.18)" strokeWidth="1" />
          <Line x1="100" y1="126" x2="100" y2="142" stroke="rgba(137,170,163,0.18)" strokeWidth="1" />
          <Line x1="38" y1="80" x2="54" y2="80" stroke="rgba(137,170,163,0.18)" strokeWidth="1" />
          <Line x1="146" y1="80" x2="162" y2="80" stroke="rgba(137,170,163,0.18)" strokeWidth="1" />
        </Svg>
      </Animated.View>

      {classification ? (
        <TerminalText size={6.5} letterSpacing={0.85} style={styles.classCode}>
          {classification}
        </TerminalText>
      ) : null}

      {content}

      {!reducedMotion && (feedbackPhase === 'assembling' || feedbackPhase === 'converging') ? (
        <Animated.View
          pointerEvents="none"
          accessible={false}
          {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
          style={[styles.scanBand, { transform: [{ translateY: scanY }] }]}
        />
      ) : null}

      {!reducedMotion ? (
        <Animated.View
          pointerEvents="none"
          accessible={false}
          {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
          style={[styles.sealFlash, { opacity: sealFlash }]}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  stageCompact: {
    minHeight: 132,
    marginBottom: 12,
  },
  glow: {
    ...StyleSheet.absoluteFill,
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(circle at 50% 48%, rgba(86, 171, 146, 0.09), rgba(3, 8, 7, 0) 62%)',
      } as object,
      default: {
        backgroundColor: 'rgba(86, 171, 146, 0.04)',
      },
    }),
  },
  glowHot: {
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(circle at 50% 48%, rgba(142, 223, 198, 0.18), rgba(3, 8, 7, 0) 64%)',
      } as object,
      default: {
        backgroundColor: 'rgba(142, 223, 198, 0.08)',
      },
    }),
  },
  glowOccult: {
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(circle at 50% 48%, rgba(153, 136, 179, 0.12), rgba(3, 8, 7, 0) 64%)',
      } as object,
      default: {},
    }),
  },
  bracket: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: 'rgba(137, 170, 163, 0.35)',
    zIndex: 2,
  },
  bracketTL: { top: 8, left: 8, borderTopWidth: 1, borderLeftWidth: 1 },
  bracketTR: { top: 8, right: 8, borderTopWidth: 1, borderRightWidth: 1 },
  bracketBL: { bottom: 8, left: 8, borderBottomWidth: 1, borderLeftWidth: 1 },
  bracketBR: { bottom: 8, right: 8, borderBottomWidth: 1, borderRightWidth: 1 },
  calLayer: {
    ...StyleSheet.absoluteFill,
    opacity: 0.9,
  },
  classCode: {
    position: 'absolute',
    top: 12,
    right: 16,
    color: '#7a8f99',
    fontWeight: '700',
    zIndex: 3,
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  image: {
    width: 168,
    height: 132,
    maxWidth: '58%',
    zIndex: 1,
    ...Platform.select({
      web: {
        filter: 'drop-shadow(0 12px 22px rgba(0,0,0,0.6)) drop-shadow(0 0 11px rgba(105,200,173,0.08))',
      } as object,
      default: {},
    }),
  },
  imageCompact: {
    width: 132,
    height: 108,
  },
  imageAssemblingBase: {
    opacity: 0.35,
  },
  fragment: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fragmentA: {
    ...Platform.select({
      web: {
        clipPath: 'polygon(0 0, 48% 0, 42% 100%, 0 100%)',
      } as object,
      default: { opacity: 0.5 },
    }),
  },
  fragmentB: {
    ...Platform.select({
      web: {
        clipPath: 'polygon(52% 0, 100% 0, 100% 100%, 58% 100%)',
      } as object,
      default: { opacity: 0.5 },
    }),
  },
  scanBand: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    height: 2,
    backgroundColor: 'rgba(142, 223, 198, 0.45)',
    zIndex: 4,
  },
  sealFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(232, 248, 242, 0.14)',
    zIndex: 5,
  },
  unavailable: {
    color: '#6f8480',
    fontWeight: '700',
    zIndex: 1,
  },
});
