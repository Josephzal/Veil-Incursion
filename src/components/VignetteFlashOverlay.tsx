import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface VignetteFlashOverlayProps {
  color: string;
  opacityAnim: Animated.Value;
}

export default function VignetteFlashOverlay({ color, opacityAnim }: VignetteFlashOverlayProps): React.JSX.Element {
  return (
    <Animated.View pointerEvents="none" style={[styles.overlayRoot, { opacity: opacityAnim }]}>
      <View style={[styles.vignetteEdge, styles.vignetteTop, { backgroundColor: color }]} />
      <View style={[styles.vignetteEdge, styles.vignetteBottom, { backgroundColor: color }]} />
      <View style={[styles.vignetteEdge, styles.vignetteEdgeSide, styles.vignetteLeft, { backgroundColor: color }]} />
      <View style={[styles.vignetteEdge, styles.vignetteEdgeSide, styles.vignetteRight, { backgroundColor: color }]} />
      <View style={[styles.vignetteCorner, styles.vignetteCornerTL, { backgroundColor: color }]} />
      <View style={[styles.vignetteCorner, styles.vignetteCornerTR, { backgroundColor: color }]} />
      <View style={[styles.vignetteCorner, styles.vignetteCornerBL, { backgroundColor: color }]} />
      <View style={[styles.vignetteCorner, styles.vignetteCornerBR, { backgroundColor: color }]} />
      <View style={[styles.vignetteFrameOuter, { borderColor: color, shadowColor: color }]} />
      <View style={[styles.vignetteFrameInner, { borderColor: color }]} />
      <View style={[styles.vignetteBloomHalo, { backgroundColor: color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  vignetteEdge: {
    position: 'absolute',
    opacity: 0.28,
  },
  vignetteEdgeSide: {
    opacity: 0.22,
  },
  vignetteTop: {
    top: 0,
    left: 0,
    right: 0,
    height: '38%',
  },
  vignetteBottom: {
    bottom: 0,
    left: 0,
    right: 0,
    height: '38%',
  },
  vignetteLeft: {
    top: 0,
    bottom: 0,
    left: 0,
    width: '32%',
  },
  vignetteRight: {
    top: 0,
    bottom: 0,
    right: 0,
    width: '32%',
  },
  vignetteCorner: {
    position: 'absolute',
    width: '46%',
    height: '46%',
    opacity: 0.34,
  },
  vignetteCornerTL: { top: 0, left: 0 },
  vignetteCornerTR: { top: 0, right: 0 },
  vignetteCornerBL: { bottom: 0, left: 0 },
  vignetteCornerBR: { bottom: 0, right: 0 },
  vignetteFrameOuter: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 8,
    opacity: 0.38,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 10,
  },
  vignetteFrameInner: {
    ...StyleSheet.absoluteFillObject,
    margin: 16,
    borderWidth: 2,
    opacity: 0.22,
  },
  vignetteBloomHalo: {
    ...StyleSheet.absoluteFillObject,
    margin: 36,
    borderRadius: 999,
    opacity: 0.08,
  },
});
