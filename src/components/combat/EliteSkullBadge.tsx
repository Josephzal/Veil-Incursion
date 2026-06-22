import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface EliteSkullBadgeProps {
  size?: number;
  style?: ViewStyle;
}

export default function EliteSkullBadge({ size = 16, style }: EliteSkullBadgeProps): React.JSX.Element {
  return (
    <View style={[styles.badge, { width: size + 6, height: size + 6 }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="11" fill="#1a0505" stroke="#ff4444" strokeWidth="1.5" />
        <Path
          d="M8 10c0-2.2 1.8-4 4-4s4 1.8 4 4v1H8v-1zm-1 3h2v2H7v-2zm8 0h2v2h-2v-2zm-6 3h4v2h-4v-2z"
          fill="#ff4444"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    left: -2,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
});
