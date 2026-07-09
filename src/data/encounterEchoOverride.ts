import type { EchoEliteTemplate } from '../types/echoElite';
import type { NodeContextModifiers } from '../types/worldState';
import { ECHO_ELITE_CATALOG, getEchoEliteTemplate } from './echoEliteCatalog';
import { spawnEchoEliteSquad } from './echoRecoveryEngine';
import { depthFromNodesCleared, getDistrictFromDepth } from './districtPacing';

export function echoEncounterId(templateId: string): string {
  return `echo:${templateId}`;
}

/** Resolves echo template from node context modifiers — Echo never enters origin roll. */
export function resolveEchoSpawnOverride(
  contextModifiers?: NodeContextModifiers | null,
): EchoEliteTemplate | null {
  const kind = contextModifiers?.echoEncounterKind;
  if (kind && kind !== 'HOSTILE_ECHO') return null;

  const templateId = contextModifiers?.echoTemplateId;
  if (!contextModifiers?.echoSignal || !templateId) return null;
  return getEchoEliteTemplate(templateId) ?? null;
}

export function verifyEchoSpawnPipeline(): void {
  for (const template of ECHO_ELITE_CATALOG) {
    const depth = template.allowedDepths[0] ?? 1;
    const nodeIndex = depth === 1 ? 3 : depth === 2 ? 18 : 33;
    const district = getDistrictFromDepth(depthFromNodesCleared(nodeIndex));
    const squad = spawnEchoEliteSquad(template, nodeIndex, district, 50);
    if (squad.length === 0) {
      throw new Error(`verifyEchoSpawnPipeline: empty squad for ${template.id}`);
    }
    if (squad.length !== template.roster.length) {
      throw new Error(
        `verifyEchoSpawnPipeline: roster size mismatch for ${template.id} (${squad.length} vs ${template.roster.length})`,
      );
    }
  }

  for (const template of ECHO_ELITE_CATALOG) {
    const resolved = resolveEchoSpawnOverride({
      depthStage: 'THRESHOLD',
      nodePressureBand: 'LOW',
      echoSignal: true,
      echoTemplateId: template.id,
      echoTier: template.tier,
    });
    if (!resolved || resolved.id !== template.id) {
      throw new Error(`verifyEchoSpawnPipeline: resolve failed for ${template.id}`);
    }
  }
}
