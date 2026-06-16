import React from 'react';
import { Image, StyleSheet } from 'react-native';
import CanisterImage from '../../../assets/images/item images/canister.png';

/** Metal shell only — glass fill is rendered by VeilVacuumBar in front. */
export default function VeilResidueCanisterShell(): React.JSX.Element {
  return (
    <Image
      source={CanisterImage}
      resizeMode="stretch"
      style={styles.shell}
    />
  );
}

const styles = StyleSheet.create({
  shell: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
});
