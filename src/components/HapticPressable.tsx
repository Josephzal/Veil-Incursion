import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { pulseHubButton } from '../utils/hubButtonHaptics';

export type HapticPressableProps = PressableProps & {
  /** Fire standard button haptic on press-in. Default true. */
  haptic?: boolean;
};

/** Pressable that pulses hub haptics on press-in when interactive. */
const HapticPressable = React.forwardRef<React.ElementRef<typeof Pressable>, HapticPressableProps>(
  function HapticPressable(
    { haptic = true, onPressIn, onPress, disabled, ...props },
    ref,
  ) {
    return (
      <Pressable
        ref={ref}
        {...props}
        disabled={disabled}
        onPress={onPress}
        onPressIn={(event) => {
          if (haptic && !disabled && (onPress != null || onPressIn != null)) {
            pulseHubButton();
          }
          onPressIn?.(event);
        }}
      />
    );
  },
);

export default HapticPressable;
