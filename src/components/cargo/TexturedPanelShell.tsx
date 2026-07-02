import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import CargoGridBackdrop from './CargoGridBackdrop';
import { viewShadow } from '../../utils/adaptiveStyles';

const PANEL_BORDER = '#1e293b';
const PANEL_BG = 'rgba(15, 23, 42, 0.85)';

interface TexturedPanelShellProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  padding?: number;
}

/** Slate panel with black cargo-mat texture — shared by safehouse and extraction screens. */
export default function TexturedPanelShell({
  children,
  style,
  contentStyle,
  padding = 24,
}: TexturedPanelShellProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.outer,
        {
          borderColor: PANEL_BORDER,
          ...viewShadow({
            color: '#020617',
            opacity: 0.35,
            radius: 10,
            offset: { width: 0, height: 2 },
          }),
        },
        style,
      ]}
    >
      <View pointerEvents="none" style={styles.backdropLayer}>
        <CargoGridBackdrop />
        <View style={styles.backdropDim} />
      </View>
      <View pointerEvents="none" style={styles.edgeHighlight} />
      <View style={[styles.content, { padding }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    minWidth: 0,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: PANEL_BG,
    borderWidth: 1,
  },
  backdropLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  backdropDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9, 9, 11, 0.72)',
  },
  edgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    zIndex: 1,
  },
  content: {
    position: 'relative',
    zIndex: 2,
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
