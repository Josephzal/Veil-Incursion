import React from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import TurnOrderColumn from '../../../components/combat/readout/TurnOrderColumn';
import type { ClassType } from '../../../types/game';
import type { CombatTurnOrderSnapshot } from '../../../utils/combatTurnOrder';

interface TurnOrderSidebarProps {
  turnOrder?: CombatTurnOrderSnapshot | null;
  gridUnits: readonly { unitId: string; portraitSource: ImageSourcePropType }[];
  operativeClass?: ClassType;
  primaryColor: string;
  mutedColor: string;
}

/** Arena overlay — vertical turn order anchored to the right screen edge. */
export default function TurnOrderSidebar({
  turnOrder,
  gridUnits,
  operativeClass,
  primaryColor,
  mutedColor,
}: TurnOrderSidebarProps): React.JSX.Element {
  return (
    <View style={styles.sidebar} pointerEvents="box-none">
      <TurnOrderColumn
        turnOrder={turnOrder}
        gridUnits={gridUnits}
        operativeClass={operativeClass}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: '70%',
    width: 60,
    zIndex: 20,
    elevation: 20,
    pointerEvents: 'box-none',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
});
