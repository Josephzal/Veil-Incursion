import type { RunWorldBrief } from '../types/runWorldBrief';
import type { ProceduralExplainabilitySummary, RunPressureScore, SectorAftermathModifier } from '../types/proceduralDirector';
import { formatActiveAftermathChips } from './proceduralAftermathEngine';
import { getCrisisThemeDefinition } from './crisisThemeCatalog';
import { getResourceDefinition } from './resourceRegistry';

const THEME_SIGNALS: Record<string, string[]> = {
  ANCHOR_BREACH: ['Anchor Signal', 'Anchor Vein', 'High-Risk Zone', 'Core Sick'],
  ECHO_OUTBREAK: ['Echo Residue', 'Mirror Combat', 'Resonant encounters', 'Echo Signal'],
  RESOURCE_BLOOM: ['High-Value Resource', 'Resource Bloom', 'Survey nodes', 'Sector materials'],
  FALSE_EXTRACTION_WAVE: ['Extraction', 'False Extraction', 'High-Risk Route', 'Degraded labels'],
  RIVAL_SALVAGE_RUSH: ['Rival Merc', 'Contested salvage', 'Elite patrols', 'High-Value nodes'],
  CONTAINMENT_FAILURE: ['Containment breach', 'High-Risk Zone', 'Unstable modifier', 'Intel contracts'],
  MIRROR_CONTAMINATION: ['Mirror Combat', 'Echo Signal', 'Degraded scanner', 'Resonant filament'],
  UNSTABLE_CARGO_SURGE: ['High-Risk + High-Value', 'Unstable cargo', 'Anomaly pressure', 'Breach Thread'],
};

const THEME_REWARDS: Record<string, string[]> = {
  ANCHOR_BREACH: ['Anchor Marrow', 'Sector identity mats', 'Rare loot'],
  ECHO_OUTBREAK: ['Resonant Filament', 'Echo-Glass', 'Anchor Marrow'],
  RESOURCE_BLOOM: ['Sector resources', 'High-value salvage', 'Rare loot'],
  FALSE_EXTRACTION_WAVE: ['Cinder Wire', 'Containment Seal', 'Cargo bonuses'],
  RIVAL_SALVAGE_RUSH: ['Rare loot', 'Intel cargo', 'Contested salvage'],
  CONTAINMENT_FAILURE: ['Containment Seal', 'Blacksite specimen', 'Intel'],
  MIRROR_CONTAMINATION: ['Resonant Filament', 'Echo-Glass', 'Breach Thread'],
  UNSTABLE_CARGO_SURGE: ['Unstable cargo', 'Breach Thread', 'Veil-Ash', 'Rare loot'],
};

const THEME_WARNINGS: Partial<Record<string, string>> = {
  ECHO_OUTBREAK: 'Scanner labels may repeat or degrade near Echo nodes.',
  FALSE_EXTRACTION_WAVE: 'Verify extraction routes before committing.',
  MIRROR_CONTAMINATION: 'Mirror encounters may duplicate hostile patterns.',
  UNSTABLE_CARGO_SURGE: 'Unstable cargo pressure increases along the route.',
  ANCHOR_BREACH: 'Anchor pressure rises on elite and gatekeeper vectors.',
};

export function buildProceduralExplainabilityText(
  brief: RunWorldBrief,
  pressure?: RunPressureScore,
  aftermathModifiers?: SectorAftermathModifier[],
): ProceduralExplainabilitySummary {
  const theme = brief.crisisTheme;
  const themeDef = getCrisisThemeDefinition(theme);
  const anchorName = brief.anchorInstance?.displayName ?? 'Sector instability';

  const expectedRewards = (THEME_REWARDS[theme] ?? []).map((label) => {
    const match = brief.resourceStress.highDemandResourceIds.find((id) => {
      try {
        return getResourceDefinition(id).shortName.toLowerCase().includes(label.toLowerCase().split(' ')[0]!);
      } catch {
        return false;
      }
    });
    if (match) {
      try {
        return getResourceDefinition(match).shortName;
      } catch {
        return label;
      }
    }
    return label;
  });

  const activeAftermath = formatActiveAftermathChips(aftermathModifiers ?? []);

  let warning = THEME_WARNINGS[theme];
  if (pressure?.label === 'CRITICAL') {
    warning = warning
      ? `${warning} Critical sector pressure — rewards elevated but danger is extreme.`
      : 'Critical sector pressure — proceed with caution.';
  }

  return {
    title: brief.crisisDisplayName || themeDef.displayName,
    cause: brief.crisisSummary || `${anchorName} is shaping conditions across ${brief.sectorDisplayName}.`,
    pressureChips: brief.threatProfile.pressureTags.length
      ? brief.threatProfile.pressureTags
      : themeDef.pressureTags,
    expectedSignals: THEME_SIGNALS[theme] ?? themeDef.nodeOverlays.map(String),
    expectedRewards,
    warning,
    pressureLabel: pressure?.label,
    activeAftermath: activeAftermath.length ? activeAftermath : undefined,
  };
}
