/**
 * Phase 3M — weapon combat presentation public API.
 */

export {
  WEAPON_COMBAT_PRESENTATION_BY_FAMILY,
  getWeaponCombatPresentationProfile,
  listWeaponCombatPresentationProfiles,
} from './profiles';
export {
  buildWeaponCombatFeedbackHit,
  buildWeaponCombatFeedbackPacket,
  shouldPlayDamagingImpact,
  shouldPlayFleshCue,
} from './feedbackPacket';
export {
  getCombatPresentationSettings,
  patchCombatPresentationSettings,
  resetCombatPresentationSettings,
  subscribeCombatPresentationSettings,
  scalePresentationMs,
} from './presentationSettings';
export {
  validateWeaponCombatPresentation,
  formatWeaponCombatPresentationValidationReport,
} from './validation';
