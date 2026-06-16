import * as Haptics from 'expo-haptics';

export function startVacuumHoldHaptics(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function tickVacuumHoldHaptics(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function stopVacuumHoldHaptics(): void {
  void Haptics.selectionAsync();
}

export function pulseResidueAbsorbed(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}
