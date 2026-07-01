import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { DOSSIER_BG, DOSSIER_BORDER } from '../../constants/dossierSurface';
import { viewShadow } from '../../utils/adaptiveStyles';

export { DOSSIER_BG, DOSSIER_BORDER };

interface DossierScanlineOverlayProps {
  patternId: string;
}

function DossierScanlineOverlay({ patternId }: DossierScanlineOverlayProps): React.JSX.Element {
  return (
    <View pointerEvents="none" style={styles.scanlineLayer}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id={patternId} width={1} height={4} patternUnits="userSpaceOnUse">
            <Rect width={1} height={1} fill="rgba(255, 255, 255, 0.35)" />
            <Rect y={1} width={1} height={3} fill="transparent" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
}

interface DossierCardShellProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  padding?: number;
  accentColor?: string;
  showAccentStripe?: boolean;
  fillHeight?: boolean;
}

/**
 * Dossier card chrome — scanlines live on the background layer only.
 * Foreground children should use DOSSIER_FOREGROUND for opaque UI surfaces.
 */
export default function DossierCardShell({
  children,
  style,
  contentStyle,
  padding = 16,
  accentColor,
  showAccentStripe = false,
  fillHeight = false,
}: DossierCardShellProps): React.JSX.Element {
  const scanlinePatternId = useId().replace(/:/g, '');
  const glowColor = accentColor ?? '#64748b';

  return (
    <View
      style={[
        fillHeight ? styles.fillOuter : styles.outer,
        style,
        {
          borderColor: DOSSIER_BORDER,
          ...(showAccentStripe && accentColor
            ? { borderLeftColor: accentColor, borderLeftWidth: 4 }
            : null),
          ...viewShadow({
            color: glowColor,
            opacity: 0.18,
            radius: 20,
            offset: { width: 0, height: 0 },
          }),
        },
      ]}
    >
      <View style={styles.backgroundLayer} pointerEvents="none">
        <DossierScanlineOverlay patternId={scanlinePatternId} />
      </View>
      <View style={[styles.content, { padding }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
  },
  fillOuter: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: DOSSIER_BG,
    zIndex: 0,
  },
  scanlineLayer: {
    ...StyleSheet.absoluteFill,
    opacity: 0.05,
  },
  content: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
});
