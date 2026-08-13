/**
 * Skill-check tier resolution — HP/stamina/ambush effects only.
 * Legacy mid-run combat-trinket grants were retired (Core Loop Stage II-A).
 */
import { AMBUSH_ENCOUNTERS_ENABLED } from './featureFlags';

export type SkillCheckTier = 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'CRITICAL_DESYNC';

export interface SkillCheckRunSlice {
  maxStamina: number;
  maxSoulAnchor: number;
  soulAnchorIntegrity: number;
  currentStamina: number;
  pendingAmbush: boolean;
}

export function applySkillCheckTierEffects(
  prev: SkillCheckRunSlice,
  tier: SkillCheckTier,
  options?: { ambushEnabled?: boolean },
): SkillCheckRunSlice {
  let maxStamina = prev.maxStamina;
  let maxSoulAnchor = prev.maxSoulAnchor;
  let soulAnchorIntegrity = prev.soulAnchorIntegrity;
  let currentStamina = prev.currentStamina;
  let pendingAmbush = prev.pendingAmbush;
  const ambushEnabled = options?.ambushEnabled ?? AMBUSH_ENCOUNTERS_ENABLED;

  switch (tier) {
    case 'CRITICAL_SUCCESS':
      // Base reward only — no legacy combat-trinket grant.
      soulAnchorIntegrity = Math.min(soulAnchorIntegrity + 30, maxSoulAnchor);
      break;
    case 'SUCCESS':
      maxStamina += 10;
      currentStamina = Math.min(currentStamina + 20, maxStamina);
      break;
    case 'FAILURE':
      soulAnchorIntegrity = Math.max(soulAnchorIntegrity - 15, 0);
      maxStamina = Math.max(maxStamina - 30, 20);
      currentStamina = Math.min(currentStamina, maxStamina);
      break;
    case 'CRITICAL_DESYNC':
      soulAnchorIntegrity = Math.max(soulAnchorIntegrity - 25, 0);
      if (ambushEnabled) pendingAmbush = true;
      break;
    default:
      break;
  }

  return {
    maxStamina,
    maxSoulAnchor,
    soulAnchorIntegrity,
    currentStamina,
    pendingAmbush,
  };
}
