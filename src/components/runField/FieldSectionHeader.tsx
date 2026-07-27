import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { RUN_FIELD } from '../../theme/runFieldTokens';

interface FieldSectionHeaderProps {
  label: string;
  meta?: string;
  style?: StyleProp<ViewStyle>;
}

/** Quiet section label + optional meta — hierarchy without bordering every block. */
export default function FieldSectionHeader({
  label,
  meta,
  style,
}: FieldSectionHeaderProps): React.JSX.Element {
  return (
    <View style={[styles.root, style]}>
      <Text style={styles.label}>{label}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 6,
    flexShrink: 0,
  },
  label: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.eyebrow,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: RUN_FIELD.textSecondary,
  },
  meta: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.micro,
    fontWeight: '500',
    color: RUN_FIELD.textDim,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: RUN_FIELD.line,
    width: '100%',
  },
});
