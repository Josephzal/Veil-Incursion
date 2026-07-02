import React from 'react';
import { Image, StyleSheet, View, type ImageResizeMode } from 'react-native';
import { CARGO_GRID_BACKGROUND, CARGO_GRID_BACKDROP_DIM } from '../../constants/cargoGridVisual';

interface CargoGridBackdropProps {
  /** contain preserves mat artwork; cover fills the host. */
  resizeMode?: ImageResizeMode;
}

/** Full-bleed tactical cargo mat behind the grid cells. */
export default function CargoGridBackdrop({
  resizeMode = 'cover',
}: CargoGridBackdropProps): React.JSX.Element {
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Image
        source={CARGO_GRID_BACKGROUND}
        style={styles.image}
        resizeMode={resizeMode}
      />
      <View style={styles.dimOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: CARGO_GRID_BACKDROP_DIM,
  },
});
