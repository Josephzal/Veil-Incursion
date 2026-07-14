import type { ActiveIncursionState } from '../types/game';
import type { CompositionRunState, EncounterRiskLabel } from '../types/encounterComposition';
import { getEncounterCompositionTemplate } from './encounterCompositionTemplateCatalog';
import { formatEncounterRiskLabel } from './encounterCompositionReadabilityEngine';

export interface EncounterCompositionDebriefSummary {
  hardestRiskCleared: EncounterRiskLabel | null;
  templatesCleared: string[];
  lines: string[];
}

function formatTemplateName(id: CompositionRunState['templatesCleared'][number]): string {
  return getEncounterCompositionTemplate(id).name;
}

/** Concise Encounter Highlights for debrief — skip when nothing meaningful happened. */
export function buildEncounterCompositionDebriefSummary(
  incursion: Pick<ActiveIncursionState, 'compositionRunState' | 'depthIdentity'>,
): EncounterCompositionDebriefSummary | null {
  const state = incursion.compositionRunState;
  if (!state) return null;

  const lines: string[] = [];

  if (state.hardestRiskCleared && state.hardestRiskCleared !== 'LOW_RISK' && state.hardestRiskCleared !== 'STANDARD') {
    lines.push(`Hardest clear: ${formatEncounterRiskLabel(state.hardestRiskCleared)}`);
  }

  const notableTemplates = state.templatesCleared.filter((id) => id !== 'SIMPLE_PATROL');
  for (const id of notableTemplates.slice(0, 4)) {
    const name = formatTemplateName(id);
    if (id === 'ARTILLERY_KILLBOX') {
      lines.push(`Cleared ${name}: elevated tech/material salvage`);
    } else if (id === 'ECHO_CONTAMINATED') {
      lines.push(`Cleared ${name}: Echo-Glass / Echo pressure`);
    } else if (id === 'ANCHOR_PATROL') {
      lines.push(`Cleared ${name}: Anchor Assault progress lane`);
    } else if (id === 'HIGH_RISK_CARGO_GUARD') {
      lines.push(`Cleared ${name}: high-value cargo pressure`);
    } else if (id === 'ELITE_NEST') {
      lines.push(`Cleared ${name}: elite reward profile`);
    } else if (id === 'BOSS_FORESHADOWING') {
      lines.push(`Cleared ${name}: Gatekeeper foreshadowing survived`);
    } else if (id === 'RESOURCE_GUARD') {
      lines.push(`Cleared ${name}: improved resource cache`);
    } else {
      lines.push(`Cleared ${name}`);
    }
  }

  if (state.highRiskClears > 0 || state.eliteClears > 0) {
    const bits: string[] = [];
    if (state.eliteClears > 0) bits.push(`${state.eliteClears} elite`);
    if (state.highRiskClears > 0) bits.push(`${state.highRiskClears} high-risk`);
    lines.push(`Elevated threat clears: ${bits.join(' / ')}`);
  }

  const overlayBits: string[] = [];
  if (state.anchorSignalClears > 0) overlayBits.push(`Anchor ×${state.anchorSignalClears}`);
  if (state.echoSignalClears > 0) overlayBits.push(`Echo ×${state.echoSignalClears}`);
  if (state.highValueClears > 0) overlayBits.push(`High-Value ×${state.highValueClears}`);
  if (overlayBits.length > 0) {
    lines.push(`Signal clears: ${overlayBits.join(' // ')}`);
  }

  const improvedTiers = state.rewardTiersCleared.filter((t) => t !== 'BASELINE');
  if (improvedTiers.length > 0) {
    lines.push(`Reward tiers hit: ${improvedTiers.join(', ').replace(/_/g, ' ')}`);
  }

  const falseExtract =
    state.falseExtractionSurvived
    || (incursion.depthIdentity?.twistedTemplatesCleared?.includes('FALSE_EXTRACTION_SIGNAL') ? 1 : 0);
  if (falseExtract > 0) {
    lines.push('Survived False Extraction Signal: extraction payout improved');
  }

  if (state.bossForeshadowClears > 0 && !notableTemplates.includes('BOSS_FORESHADOWING')) {
    lines.push('Boss foreshadowing cleared');
  }

  // Cap debrief noise.
  const capped = lines.slice(0, 6);
  if (capped.length === 0) return null;

  return {
    hardestRiskCleared: state.hardestRiskCleared,
    templatesCleared: state.templatesCleared.map(formatTemplateName),
    lines: capped,
  };
}
