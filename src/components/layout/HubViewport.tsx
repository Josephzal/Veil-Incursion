import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useHubLayout } from '../../context/HubLayoutContext';

interface HubViewportProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Skip desktop max-width cap so content can fill the main rail (Veil Front). */
  fullBleed?: boolean;
}

/** Master containment field — centers and caps hub content at activeViewportWidth. */
export default function HubViewport({ children, style, fullBleed = false }: HubViewportProps): React.JSX.Element {
  const { isDesktop, activeViewportWidth } = useHubLayout();

  return (
    <View
      style={[
        styles.host,
        isDesktop && !fullBleed && {
          width: '100%',
          maxWidth: activeViewportWidth,
          alignSelf: 'center',
        },
        fullBleed && styles.fullBleed,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
  },
  fullBleed: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
});

