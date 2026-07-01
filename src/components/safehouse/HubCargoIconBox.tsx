import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useHubTypography } from '../../hooks/useHubTypography';
import type { CargoItemId } from '../../types/cargoGrid';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';

interface HubCargoIconBoxProps {
  itemId: CargoItemId;
  borderColor: string;
  iconSize?: number;
  /** `stashRow` — right rail in loadout list; `tile` — square cell for grids. */
  variant?: 'stashRow' | 'tile';
}

/** Static cargo icon cell — matches loadout stash drag handle styling. */
export default function HubCargoIconBox({
  itemId,
  borderColor,
  iconSize: iconSizeProp,
  variant = 'stashRow',
}: HubCargoIconBoxProps): React.JSX.Element {
  const { iconSize: defaultIconSize } = useHubTypography();
  const iconSize = iconSizeProp ?? defaultIconSize;
  const boxSize = iconSize + 16;

  return (
    <View
      style={[
        variant === 'tile' ? styles.tileBox : styles.box,
        {
          borderColor,
          width: boxSize,
          ...(variant === 'tile' ? { height: boxSize } : null),
        },
      ]}
    >
      <Image
        source={resolveCargoItemIcon(itemId)}
        resizeMode="contain"
        style={{ width: iconSize, height: iconSize }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderLeftWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: '#0a0b0f',
    alignSelf: 'stretch',
  },
  tileBox: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: '#0a0b0f',
  },
});
