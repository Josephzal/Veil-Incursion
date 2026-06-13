import { Vibration } from 'react-native';

const HUB_BUTTON_HAPTIC_MS = 12;

export function pulseHubButton(): void {
  Vibration.vibrate(HUB_BUTTON_HAPTIC_MS);
}
