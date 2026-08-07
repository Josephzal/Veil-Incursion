import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

export const GROUP_ENEMY_WRAPPER_WIDTH = '90%' as const;
export const SOLO_ENEMY_WRAPPER_WIDTH = '100%' as const;
export const ENEMY_WRAPPER_ASPECT_RATIO = 1;

interface CombatEnemyWrapperProps {
  children?: React.ReactNode;
  /** Share of the row width — flex rows handle horizontal placement. */
  width?: `${number}%`;
  /** Lane depth scale applied inside the anchor (backline reads smaller). */
  scale?: number;
  zIndex?: number;
  style?: ViewStyle;
}

/** Responsive anchor for one hostile — attachments position relative to this box. */
export default function CombatEnemyWrapper({
  children,
  width = GROUP_ENEMY_WRAPPER_WIDTH,
  scale = 1,
  zIndex = 1,
  style,
}: CombatEnemyWrapperProps): React.JSX.Element {
  const scaled =
    scale !== 1
      ? ({
          transform: [{ scale }],
          // Keep vitals / feet planted so lane mates share one bar baseline.
          transformOrigin: 'bottom center',
        } as ViewStyle)
      : undefined;

  return (
    <View style={[styles.wrapper, { width, zIndex }, style]}>
      <View style={[styles.inner, scaled]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    aspectRatio: ENEMY_WRAPPER_ASPECT_RATIO,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    flexShrink: 0,
  },
  inner: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'visible',
  },
});
