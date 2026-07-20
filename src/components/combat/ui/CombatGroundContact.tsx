import React from 'react';
import { StyleSheet, View } from 'react-native';
import { OTT } from '../../../constants/occultTacticalTerminalTheme';

interface CombatGroundContactProps {
  /** Soft active ring under the operative. */
  active?: boolean;
  /** Wider/fainter contact for hostiles. */
  hostile?: boolean;
}

/** Faint ground contact / shadow under arena units. */
export default function CombatGroundContact({
  active = false,
  hostile = false,
}: CombatGroundContactProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.shadow,
        hostile && styles.shadowHostile,
        active && styles.shadowActive,
      ]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    width: '42%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    opacity: 0.7,
  },
  shadowHostile: {
    width: '48%',
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  shadowActive: {
    width: '46%',
    height: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OTT.terminalGreenDim,
    backgroundColor: 'rgba(69, 247, 160, 0.08)',
    opacity: 0.85,
  },
});
