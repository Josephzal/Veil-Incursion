import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { RUN_FIELD } from '../../theme/runFieldTokens';
import FieldPlate from './FieldPlate';

export interface FieldMetricItem {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}

interface FieldMetricStripProps {
  items: FieldMetricItem[];
  style?: StyleProp<ViewStyle>;
}

/** Compact horizontal metrics — unstowed materials, HP, credits, etc. */
export default function FieldMetricStrip({
  items,
  style,
}: FieldMetricStripProps): React.JSX.Element {
  const visible = items.filter((item) => item.value);
  if (visible.length === 0) return <View />;

  return (
    <FieldPlate density="wash" brackets={false} style={[styles.wrap, style]} contentStyle={styles.row}>
      {visible.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <View style={styles.sep} /> : null}
          <View style={styles.cell}>
            <Text
              style={[
                styles.value,
                item.accent ? styles.valueAccent : null,
                item.danger ? styles.valueDanger : null,
              ]}
            >
              {item.value}
            </Text>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </FieldPlate>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
  },
  sep: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: RUN_FIELD.lineStrong,
  },
  value: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.metric,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: RUN_FIELD.text,
  },
  valueAccent: {
    color: RUN_FIELD.mint,
  },
  valueDanger: {
    color: RUN_FIELD.danger,
  },
  label: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.micro,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: RUN_FIELD.textSecondary,
  },
});
