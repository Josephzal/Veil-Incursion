import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useHubLayout } from '../../context/HubLayoutContext';

interface HubViewportProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Master containment field — centers and caps hub content at activeViewportWidth. */
export default function HubViewport({ children, style }: HubViewportProps): React.JSX.Element {
  const { isDesktop, activeViewportWidth } = useHubLayout();

  return (
    <View
      style={[
        styles.host,
        isDesktop && {
          width: '100%',
          maxWidth: activeViewportWidth,
          alignSelf: 'center',
        },
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
});
