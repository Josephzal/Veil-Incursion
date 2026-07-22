import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import type { CabalEmployerId } from '../../../types/worldState';
import {
  resolveCabalTone,
  VEIL_BLACK_CHANNEL_TONE,
  type VeilTone,
} from '../../../theme/veilTerminalTokens';

type SealChannel = CabalEmployerId | 'BLACK_CHANNEL';

interface DossierCabalSealProps {
  channel: SealChannel;
}

function resolveTone(channel: SealChannel): VeilTone {
  if (channel === 'BLACK_CHANNEL') return VEIL_BLACK_CHANNEL_TONE;
  return resolveCabalTone(channel);
}

/**
 * Large, cropped Cabal containment geometry for the dossier upper-right.
 * Abstract registration only — not heraldry. Decorative.
 */
export default function DossierCabalSeal({ channel }: DossierCabalSealProps): React.JSX.Element {
  const tone = resolveTone(channel);
  const stroke = tone.accent;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={styles.host}
    >
      <Svg width="100%" height="100%" viewBox="0 0 180 180" opacity={0.035}>
        {channel === 'TERRAN_GRID' ? (
          <>
            <Line x1="18" y1="28" x2="148" y2="28" stroke={stroke} strokeWidth="1.2" />
            <Line x1="18" y1="28" x2="18" y2="142" stroke={stroke} strokeWidth="1.2" />
            <Line x1="18" y1="70" x2="118" y2="70" stroke={stroke} strokeWidth="1" />
            <Line x1="58" y1="28" x2="58" y2="118" stroke={stroke} strokeWidth="1" />
            <Line x1="98" y1="28" x2="98" y2="96" stroke={stroke} strokeWidth="1" />
            <Line x1="18" y1="110" x2="86" y2="110" stroke={stroke} strokeWidth="1" />
            {/* Displaced missing segment */}
            <Line x1="102" y1="112" x2="138" y2="112" stroke={stroke} strokeWidth="1" opacity={0.55} />
            <Rect x="132" y="24" width="10" height="10" stroke={stroke} strokeWidth="1" fill="none" />
          </>
        ) : null}

        {channel === 'LEGION' ? (
          <>
            <Circle cx="96" cy="88" r="62" stroke={stroke} strokeWidth="2.2" fill="none" strokeDasharray="190 40" />
            <Circle cx="96" cy="88" r="52" stroke={stroke} strokeWidth="1.2" fill="none" strokeDasharray="150 60" />
            <Line x1="34" y1="40" x2="34" y2="140" stroke={stroke} strokeWidth="2" />
            <Line x1="42" y1="40" x2="42" y2="140" stroke={stroke} strokeWidth="1" opacity={0.7} />
            <Rect x="118" y="52" width="28" height="36" stroke={stroke} strokeWidth="1.4" fill="none" />
          </>
        ) : null}

        {channel === 'SOLARIS' ? (
          <>
            <Circle cx="102" cy="78" r="58" stroke={stroke} strokeWidth="1.1" fill="none" />
            <Circle cx="96" cy="86" r="42" stroke={stroke} strokeWidth="1" fill="none" opacity={0.85} />
            <Circle cx="110" cy="70" r="24" stroke={stroke} strokeWidth="1" fill="none" opacity={0.7} />
            <Path d="M48 120 A54 54 0 0 1 150 96" stroke={stroke} strokeWidth="1" fill="none" />
            <Circle cx="148" cy="54" r="3" fill={stroke} opacity={0.8} />
          </>
        ) : null}

        {channel === 'BLACK_CHANNEL' ? (
          <>
            <Circle cx="100" cy="90" r="56" stroke={stroke} strokeWidth="1.2" fill="none" strokeDasharray="40 18 80 30" />
            <Circle cx="108" cy="96" r="56" stroke={stroke} strokeWidth="1" fill="none" opacity={0.45} />
            <Path d="M52 48 L128 48 L148 72 L128 140 L52 140 Z" stroke={stroke} strokeWidth="1.1" fill="none" />
            <Path
              d="M58 54 L122 56 L140 76 L122 132 L58 130 Z"
              stroke={stroke}
              strokeWidth="1"
              fill="none"
              opacity={0.4}
            />
            <Line x1="72" y1="70" x2="118" y2="118" stroke={stroke} strokeWidth="1" opacity={0.55} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: -28,
    top: -8,
    width: 200,
    height: 200,
    zIndex: 0,
    overflow: 'hidden',
  },
});
