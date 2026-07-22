import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../../TerminalText';
import { VEIL, VEIL_MINT_TONE } from '../../../theme/veilTerminalTokens';
import StatusNode from './StatusNode';

interface LiveStatusProps {
  label: string;
  active?: boolean;
  size?: number;
}

/** Mint live-signal chip for genuinely active network states. */
export default function LiveStatus({
  label,
  active = true,
  size = 7,
}: LiveStatusProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <StatusNode
        tone={VEIL_MINT_TONE}
        state={active ? 'active' : 'idle'}
        size={4}
        glow={active}
      />
      <TerminalText
        size={size}
        letterSpacing={0.9}
        style={[styles.label, !active && styles.labelIdle]}
      >
        {label}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    color: VEIL.mint,
    fontWeight: '700',
  },
  labelIdle: {
    color: VEIL.textDim,
  },
});
