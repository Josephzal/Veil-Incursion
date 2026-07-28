import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { RUN_FIELD } from '../../theme/runFieldTokens';

/**
 * Corner registration marks matching in-run FieldPlate brackets
 * (e.g. Black Market cargo container). For hub right-rail dossiers.
 *
 * Renders above header/footer chrome (CTA strip) so all four corners read
 * as one frame; pointerEvents none so footer buttons stay clickable.
 */
export default function HubDossierCornerBrackets(): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={styles.host}
    >
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  corner: {
    position: 'absolute',
    width: RUN_FIELD.bracket.size,
    height: RUN_FIELD.bracket.size,
    borderColor: 'rgba(99, 226, 177, 0.28)',
  },
  tl: {
    top: RUN_FIELD.bracket.inset,
    left: RUN_FIELD.bracket.inset,
    borderTopWidth: RUN_FIELD.bracket.stroke,
    borderLeftWidth: RUN_FIELD.bracket.stroke,
  },
  tr: {
    top: RUN_FIELD.bracket.inset,
    right: RUN_FIELD.bracket.inset,
    borderTopWidth: RUN_FIELD.bracket.stroke,
    borderRightWidth: RUN_FIELD.bracket.stroke,
  },
  bl: {
    bottom: RUN_FIELD.bracket.inset,
    left: RUN_FIELD.bracket.inset,
    borderBottomWidth: RUN_FIELD.bracket.stroke,
    borderLeftWidth: RUN_FIELD.bracket.stroke,
  },
  br: {
    bottom: RUN_FIELD.bracket.inset,
    right: RUN_FIELD.bracket.inset,
    borderBottomWidth: RUN_FIELD.bracket.stroke,
    borderRightWidth: RUN_FIELD.bracket.stroke,
  },
});
