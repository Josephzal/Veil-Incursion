import React from 'react';
import { StyleSheet, View } from 'react-native';
import TurnOrderColumn from '../../../components/combat/readout/TurnOrderColumn';
import type { ClassType } from '../../../types/game';
import type { CombatTurnOrderSnapshot } from '../../../utils/combatTurnOrder';
import type { ImageSourcePropType } from 'react-native';
import { useCombatDesktopLayout } from '../../../hooks/useCombatDesktopLayout';

interface TurnOrderSidebarProps {
  turnOrder?: CombatTurnOrderSnapshot | null;
  gridUnits: readonly { unitId: string; portraitSource: ImageSourcePropType }[];
  operativeClass?: ClassType;
  primaryColor: string;
  mutedColor: string;
  selectedUnitId?: string | null;
  onHostilePress?: (unitId: string) => void;
}

/**
 * Arena overlay — vertical middle of the arena, flush to the right screen edge.
 */
export default function TurnOrderSidebar({
  turnOrder,
  gridUnits,
  operativeClass,
  primaryColor,
  mutedColor,
  selectedUnitId,
  onHostilePress,
}: TurnOrderSidebarProps): React.JSX.Element {
  const { isCombatDesktop, scaleCombatSize } = useCombatDesktopLayout();

  return (
    <View style={styles.sidebar} pointerEvents="box-none">
      <View
        style={[
          styles.columnHost,
          isCombatDesktop ? { width: scaleCombatSize(80), paddingHorizontal: scaleCombatSize(6) } : null,
        ]}
        pointerEvents="box-none"
      >
        <TurnOrderColumn
          turnOrder={turnOrder}
          gridUnits={gridUnits}
          operativeClass={operativeClass}
          primaryColor={primaryColor}
          mutedColor={mutedColor}
          overlay
          selectedUnitId={selectedUnitId}
          onHostilePress={onHostilePress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    pointerEvents: 'box-none',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  columnHost: {
    width: 60,
    paddingHorizontal: 4,
    paddingRight: 8,
    alignItems: 'center',
  },
});
