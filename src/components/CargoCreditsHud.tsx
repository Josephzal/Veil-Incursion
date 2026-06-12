import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import CreditIcon from '../../assets/images/item images/credit_icon.png';

const CREDITS_LABEL_FONT_SIZE = 8;

interface CargoCreditsHudProps {
  credits: number;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

export default function CargoCreditsHud({
  credits,
  accentColor = '#00ff33',
  style,
}: CargoCreditsHudProps): React.JSX.Element {
  return (
    <View style={[styles.root, style]} pointerEvents="none">
      <Image
        source={CreditIcon}
        resizeMode="contain"
        style={styles.icon}
      />
      <Text style={[styles.label, { color: accentColor }]}>CREDITS</Text>
      <Text style={[styles.value, { color: accentColor }]}>{credits}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    width: 12,
    height: 12,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: CREDITS_LABEL_FONT_SIZE,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  value: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
