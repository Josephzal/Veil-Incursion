import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { RUN_FIELD } from '../../theme/runFieldTokens';

export type FieldPlateDensity = 'strong' | 'standard' | 'light' | 'wash';
export type FieldPlateState = 'idle' | 'hover' | 'selected' | 'locked' | 'disabled' | 'danger';

interface FieldPlateProps {
  children: React.ReactNode;
  density?: FieldPlateDensity;
  /**
   * Material accent. Selection edges always use mint — occult only adds a faint
   * inner haze for supernatural offers, never replaces the selected state color.
   */
  tone?: 'neutral' | 'mint' | 'occult' | 'danger';
  state?: FieldPlateState;
  brackets?: boolean;
  /** Show a small SELECTED registration mark in the corner. */
  showSelectedMark?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

const DENSITY_BG: Record<FieldPlateDensity, string> = {
  strong: RUN_FIELD.panelStrong,
  standard: RUN_FIELD.panel,
  light: RUN_FIELD.panelLight,
  wash: RUN_FIELD.panelWash,
};

/**
 * Translucent field equipment plate — in-run surfaces only.
 * Mint communicates player selection; purple is secondary occult residue only.
 */
export default function FieldPlate({
  children,
  density = 'standard',
  tone = 'neutral',
  state = 'idle',
  brackets = true,
  showSelectedMark = false,
  style,
  contentStyle,
}: FieldPlateProps): React.JSX.Element {
  const selected = state === 'selected';
  const danger = state === 'danger';
  const locked = state === 'locked' || state === 'disabled';
  const hover = state === 'hover';
  const interactiveHot = selected || hover;

  const borderColor = danger
    ? RUN_FIELD.dangerBorder
    : interactiveHot
      ? (selected ? RUN_FIELD.mintBorderHot : RUN_FIELD.mintBorder)
      : RUN_FIELD.line;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: DENSITY_BG[density],
          borderColor,
          opacity: state === 'disabled' ? 0.55 : locked ? 0.82 : 1,
        },
        selected ? styles.selected : null,
        hover && !selected ? styles.hover : null,
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            } as object)
          : null,
        style,
      ]}
    >
      {!brackets ? <View style={styles.innerEdge} pointerEvents="none" /> : null}
      {brackets ? (
        <>
          <View
            style={[
              styles.corner,
              styles.tl,
              interactiveHot ? styles.cornerHot : null,
            ]}
            pointerEvents="none"
          />
          <View
            style={[
              styles.corner,
              styles.tr,
              interactiveHot ? styles.cornerHot : null,
            ]}
            pointerEvents="none"
          />
          <View style={[styles.corner, styles.bl]} pointerEvents="none" />
          <View style={[styles.corner, styles.br]} pointerEvents="none" />
        </>
      ) : null}
      {selected ? <View style={styles.mintHaze} pointerEvents="none" /> : null}
      {selected && tone === 'occult' ? (
        <View style={styles.occultHaze} pointerEvents="none" />
      ) : null}
      {selected && showSelectedMark ? (
        <View style={styles.selectedNotch} pointerEvents="none" />
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    overflow: 'visible',
    borderWidth: 1,
    borderRadius: 0,
  },
  innerEdge: {
    ...StyleSheet.absoluteFill,
    margin: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RUN_FIELD.innerHighlight,
  },
  content: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
  },
  corner: {
    position: 'absolute',
    width: RUN_FIELD.bracket.size,
    height: RUN_FIELD.bracket.size,
    borderColor: 'rgba(99, 226, 177, 0.28)',
    zIndex: 2,
  },
  cornerHot: {
    borderColor: RUN_FIELD.mintBorderHot,
  },
  tl: {
    top: RUN_FIELD.bracket.inset,
    left: RUN_FIELD.bracket.inset,
    borderTopWidth: RUN_FIELD.bracket.stroke,
    borderLeftWidth: RUN_FIELD.bracket.stroke,
  },
  tr: {
    top: RUN_FIELD.bracket.inset,
    right: RUN_FIELD.bracket.inset,
    borderTopWidth: RUN_FIELD.bracket.stroke,
    borderRightWidth: RUN_FIELD.bracket.stroke,
  },
  bl: {
    bottom: RUN_FIELD.bracket.inset,
    left: RUN_FIELD.bracket.inset,
    borderBottomWidth: RUN_FIELD.bracket.stroke,
    borderLeftWidth: RUN_FIELD.bracket.stroke,
  },
  br: {
    bottom: RUN_FIELD.bracket.inset,
    right: RUN_FIELD.bracket.inset,
    borderBottomWidth: RUN_FIELD.bracket.stroke,
    borderRightWidth: RUN_FIELD.bracket.stroke,
  },
  mintHaze: {
    ...StyleSheet.absoluteFill,
    backgroundColor: RUN_FIELD.mintSoft,
    opacity: 0.55,
    zIndex: 0,
  },
  occultHaze: {
    ...StyleSheet.absoluteFill,
    backgroundColor: RUN_FIELD.occultSoft,
    opacity: 0.45,
    zIndex: 0,
  },
  selectedNotch: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: RUN_FIELD.mint,
    backgroundColor: 'rgba(99, 226, 177, 0.25)',
    zIndex: 3,
  },
  selected: {
    shadowColor: RUN_FIELD.mint,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  hover: {
    shadowColor: RUN_FIELD.mint,
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
});
