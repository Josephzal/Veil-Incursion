import React, { useEffect } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { TerminalTheme } from '../types/theme';

interface FactionBootLogoProps {
  theme: TerminalTheme;
  flashActive?: boolean;
}

export default function FactionBootLogo({ theme, flashActive = false }: FactionBootLogoProps): React.JSX.Element {
  const pulse = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!flashActive) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 280, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flashActive, pulse]);

  return (
    <View
      style={[
        styles.logoBox,
        {
          borderColor: theme.borderColor,
          borderWidth: theme.borderWidth,
          borderStyle: theme.borderStyle,
          backgroundColor: theme.backgroundColor,
        },
      ]}
    >
      <Animated.View style={{ opacity: flashActive ? pulse : 1 }}>
        <Text style={[styles.logoGlyph, { color: theme.primaryColor }]}>{theme.logoGlyph}</Text>
      </Animated.View>
      <Text style={[styles.bootLog, { color: theme.statusColor }]}>{theme.bootLog}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoBox: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  logoGlyph: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  bootLog: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.8,
    textAlign: 'center',
    lineHeight: 12,
  },
});
