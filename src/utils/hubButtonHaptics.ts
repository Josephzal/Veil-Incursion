import { Vibration } from 'react-native';

const HUB_BUTTON_HAPTIC_MS = 12;
const COMBAT_TARGET_HAPTIC_MS = 14;
const CARGO_CLOSE_HAPTIC_MS = 10;
const CARGO_ITEM_SELECT_HAPTIC_MS = 9;
const CARGO_ITEM_PICKUP_HAPTIC_MS = 11;

export function pulseHubButton(): void {
  Vibration.vibrate(HUB_BUTTON_HAPTIC_MS);
}

export function pulseCombatTargetSelect(): void {
  Vibration.vibrate(COMBAT_TARGET_HAPTIC_MS);
}

export function pulseCargoOpen(): void {
  Vibration.vibrate(HUB_BUTTON_HAPTIC_MS);
}

export function pulseCargoClose(): void {
  Vibration.vibrate(CARGO_CLOSE_HAPTIC_MS);
}

export function pulseCargoItemSelect(): void {
  Vibration.vibrate(CARGO_ITEM_SELECT_HAPTIC_MS);
}

export function pulseCargoItemPickup(): void {
  Vibration.vibrate(CARGO_ITEM_PICKUP_HAPTIC_MS);
}

export function pulseCargoItemUse(): void {
  Vibration.vibrate([0, 14, 22, 18]);
}
