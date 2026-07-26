import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import CreditIcon from '../../assets/images/item images/credit_icon.png';

interface CargoCreditsHudProps {
  credits: number;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

export default function CargoCreditsHud({
  credits,
  accentColor = '#62CDB5',
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
    gap: 5,
  },
  icon: {
    width: 14,
    height: 14,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  value: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});