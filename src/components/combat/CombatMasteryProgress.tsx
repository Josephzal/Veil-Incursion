import React from 'react';
import { StyleSheet, View } from 'react-native';

interface CombatMasteryProgressProps {
  current: number;
  required: number;
  accent: string;
}

/** Pip row showing mastery buildup before the ultimate ping appears. */
export default function CombatMasteryProgress({
  current,
  required,
  accent,
}: CombatMasteryProgressProps): React.JSX.Element {
  return (
    <View style={styles.host}>
      <View style={styles.pipRow}>
        {Array.from({ length: required }, (_, index) => (
          <View
            key={`mastery-pip-${index}`}
            style={[
              styles.pip,
              { borderColor: accent },
              index < current ? { backgroundColor: accent, shadowColor: accent } : styles.pipEmpty,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
  },
  pipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    shadowOpacity: 0.65,
    shadowRadius: 4,
    elevation: 2,
  },
  pipEmpty: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
});
