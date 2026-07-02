import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import TexturedPanelShell from '../cargo/TexturedPanelShell';

interface SafehouseTexturedPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  padding?: number;
  flex?: number;
}

/** Safehouse column shell — black cargo mat texture with crisp slate border. */
export default function SafehouseTexturedPanel({
  children,
  style,
  contentStyle,
  padding = 24,
  flex,
}: SafehouseTexturedPanelProps): React.JSX.Element {
  return (
    <TexturedPanelShell
      padding={padding}
      contentStyle={contentStyle}
      style={[flex != null ? { flex } : null, style]}
    >
      {children}
    </TexturedPanelShell>
  );
}
