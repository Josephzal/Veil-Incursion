import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import type { CabalEmployerId } from '../../../types/worldState';
import {
  resolveCabalTone,
  VEIL_BLACK_CHANNEL_TONE,
  type VeilTone,
} from '../../../theme/veilTerminalTokens';

export type CabalDossierChannel = CabalEmployerId | 'BLACK_CHANNEL';

interface CabalDossierMarkProps {
  channel: CabalDossierChannel;
  /** Changes when selected contract changes — triggers one registration settle. */
  settleKey: string;
  reduceMotion?: boolean;
}

function resolveTone(channel: CabalDossierChannel): VeilTone {
  if (channel === 'BLACK_CHANNEL') return VEIL_BLACK_CHANNEL_TONE;
  return resolveCabalTone(channel);
}

/**
 * Mid-dossier Cabal containment watermark.
 * One short registration settle on contract change; no looping motion.
 */
export default function CabalDossierMark({
  channel,
  settleKey,
  reduceMotion = false,
}: CabalDossierMarkProps): React.JSX.Element {
  const tone = resolveTone(channel);
  const stroke = tone.accent;
  const opacity = useRef(new Animated.Value(reduceMotion ? 0.045 : 0.012)).current;
  const shift = useRef(new Animated.Value(reduceMotion ? 0 : 3)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.045);
      shift.setValue(0);
      return undefined;
    }
    opacity.setValue(0.012);
    shift.setValue(3);
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0.045,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(shift, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [channel, opacity, reduceMotion, settleKey, shift]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={styles.host}
    >
      <Animated.View
        style={[
          styles.inner,
          {
            opacity,
            transform: [{ translateX: shift }, { translateY: Animated.multiply(shift, -0.35) }],
          },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 200 200">
          {channel === 'TERRAN_GRID' ? (
            <>
              <Line x1="24" y1="36" x2="158" y2="36" stroke={stroke} strokeWidth="1.2" />
              <Line x1="24" y1="36" x2="24" y2="156" stroke={stroke} strokeWidth="1.2" />
              <Line x1="24" y1="78" x2="128" y2="78" stroke={stroke} strokeWidth="1" />
              <Line x1="66" y1="36" x2="66" y2="132" stroke={stroke} strokeWidth="1" />
              <Line x1="108" y1="36" x2="108" y2="108" stroke={stroke} strokeWidth="1" />
              <Line x1="24" y1="120" x2="94" y2="120" stroke={stroke} strokeWidth="1" />
              <Line x1="112" y1="124" x2="152" y2="124" stroke={stroke} strokeWidth="1" opacity={0.55} />
              <Rect x="146" y="30" width="12" height="12" stroke={stroke} strokeWidth="1" fill="none" />
            </>
          ) : null}

          {channel === 'LEGION' ? (
            <>
              <Circle cx="108" cy="98" r="68" stroke={stroke} strokeWidth="2.2" fill="none" strokeDasharray="210 48" />
              <Circle cx="108" cy="98" r="56" stroke={stroke} strokeWidth="1.2" fill="none" strokeDasharray="165 70" />
              <Line x1="40" y1="46" x2="40" y2="156" stroke={stroke} strokeWidth="2.2" />
              <Line x1="50" y1="46" x2="50" y2="156" stroke={stroke} strokeWidth="1" opacity={0.65} />
              <Rect x="132" y="58" width="30" height="40" stroke={stroke} strokeWidth="1.4" fill="none" />
            </>
          ) : null}

          {channel === 'SOLARIS' ? (
            <>
              <Circle cx="114" cy="88" r="64" stroke={stroke} strokeWidth="1.1" fill="none" />
              <Circle cx="106" cy="96" r="46" stroke={stroke} strokeWidth="1" fill="none" opacity={0.85} />
              <Circle cx="122" cy="78" r="26" stroke={stroke} strokeWidth="1" fill="none" opacity={0.7} />
              <Path d="M52 132 A60 60 0 0 1 168 104" stroke={stroke} strokeWidth="1" fill="none" />
              <Circle cx="164" cy="60" r="3" fill={stroke} opacity={0.8} />
            </>
          ) : null}

          {channel === 'BLACK_CHANNEL' ? (
            <>
              <Circle cx="112" cy="100" r="62" stroke={stroke} strokeWidth="1.2" fill="none" strokeDasharray="44 20 90 34" />
              <Circle cx="120" cy="106" r="62" stroke={stroke} strokeWidth="1" fill="none" opacity={0.42} />
              <Path d="M56 52 L142 52 L164 78 L142 156 L56 156 Z" stroke={stroke} strokeWidth="1.1" fill="none" />
              <Path
                d="M64 60 L136 62 L156 84 L136 148 L64 146 Z"
                stroke={stroke}
                strokeWidth="1"
                fill="none"
                opacity={0.38}
              />
              <Line x1="80" y1="78" x2="132" y2="132" stroke={stroke} strokeWidth="1" opacity={0.5} />
            </>
          ) : null}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    // ~70% across dossier width, mid-body — cropped by right edge.
    right: -36,
    top: 250,
    width: 230,
    height: 230,
    zIndex: 0,
    overflow: 'hidden',
  },
  inner: {
    width: '100%',
    height: '100%',
  },
});
