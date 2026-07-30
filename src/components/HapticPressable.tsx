import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { pulseHubButton } from '../utils/hubButtonHaptics';
import { playUiClick } from '../utils/uiFeedbackAudio';

export type HapticPressableProps = PressableProps & {
  /** Fire standard button haptic on press-in. Default true. */
  haptic?: boolean;
  /** Fire interface click SFX on press-in. Default true. */
  sfx?: boolean;
};

/** Pressable that pulses hub haptics on press-in when interactive. */
const HapticPressable = React.forwardRef<React.ElementRef<typeof Pressable>, HapticPressableProps>(
  function HapticPressable(
    { haptic = true, sfx = true, onPressIn, onPress, disabled, ...props },
    ref,
  ) {
    return (
      <Pressable
        ref={ref}
        {...props}
        disabled={disabled}
        onPress={onPress}
        onPressIn={(event) => {
          if (!disabled && (onPress != null || onPressIn != null)) {
            if (haptic) pulseHubButton();
            if (sfx) playUiClick();
          }
          onPressIn?.(event);
        }}
      />
    );
  },
);

export default HapticPressable;
