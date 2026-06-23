import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';

export type ShakeIntensity = 'light' | 'heavy' | 'micro';

export type CombatHapticType = 'impactLight' | 'impactHeavy' | 'notificationError';

let hitstopUntilMs = 0;
let shakeHandler: ((intensity: ShakeIntensity) => void) | null = null;

export function registerCombatJuiceShake(handler: (intensity: ShakeIntensity) => void): void {
  shakeHandler = handler;
}

export function unregisterCombatJuiceShake(): void {
  shakeHandler = null;
}

export function triggerHitstop(ms: number): void {
  hitstopUntilMs = Math.max(hitstopUntilMs, Date.now() + ms);
}

export function isHitstopActive(): boolean {
  return Date.now() < hitstopUntilMs;
}

export async function triggerHaptic(type: CombatHapticType): Promise<void> {
  try {
    if (type === 'impactLight') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    if (type === 'impactHeavy') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    Vibration.vibrate(type === 'impactHeavy' ? 18 : type === 'notificationError' ? 14 : 6);
  }
}

export function triggerShake(intensity: ShakeIntensity): void {
  shakeHandler?.(intensity);
}
