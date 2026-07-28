import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { OTT, OTT_LAYOUT } from '../../../constants/occultTacticalTerminalTheme';

/**
 * Global atmosphere — top/bottom vignette, faint mid wash, restrained scanlines.
 * Bottom console owns its own dock fade; this stays lighter mid-frame.
 */
export default function CombatHudAtmosphereOverlay(): React.JSX.Element {
  const uid = useId().replace(/:/g, '');
  const topId = `vignetteTop-${uid}`;
  const bottomId = `vignetteBottom-${uid}`;

  return (
    <View style={styles.root} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={topId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#050708" stopOpacity="0.55" />
            <Stop offset="0.45" stopColor="#050708" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#050708" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id={bottomId} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#000" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#000" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="14%" fill={`url(#${topId})`} />
        <Rect x="0" y="64%" width="100%" height="10%" fill={`url(#${bottomId})`} />
      </Svg>
      <View style={styles.gridWash} />
      <View style={styles.scanBandA} />
      <View style={styles.scanBandB} />
      <View style={styles.scanBandC} />
      <View style={[styles.frameCorner, styles.tl]} />
      <View style={[styles.frameCorner, styles.bl]} />
      <View style={[styles.frameCorner, styles.br]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
  },
  gridWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: OTT_LAYOUT.overlayOpacity,
    backgroundColor: OTT.gridLine,
  },
  scanBandA: {
    position: 'absolute',
    top: '22%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: OTT.scanline,
  },
  scanBandB: {
    position: 'absolute',
    top: '48%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: OTT.scanline,
  },
  scanBandC: {
    position: 'absolute',
    top: '74%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: OTT.scanline,
  },
  frameCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: OTT.cyanDim,
    opacity: 0.35,
  },
  tl: { top: 10, left: 10, borderTopWidth: 1, borderLeftWidth: 1 },
  bl: { bottom: 10, left: 10, borderBottomWidth: 1, borderLeftWidth: 1 },
  br: { bottom: 10, right: 10, borderBottomWidth: 1, borderRightWidth: 1 },
});
