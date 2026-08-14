import type { ClassGraftDefinition, EnvoyGraftId } from '../types/classGraft';
import {
  getUniversalGraftDefinition,
  listUniversalGraftsForClass,
} from './universalGraftRegistry';

/** Live compatibility view; legacy Envoy graft IDs are intentionally absent. */
export const ENVOY_GRAFT_DATABASE: Readonly<Record<string, ClassGraftDefinition>> =
  Object.freeze(Object.fromEntries(
    listUniversalGraftsForClass('ENVOY').map((definition) => [
      definition.id,
      definition as ClassGraftDefinition,
    ]),
  ));

export const ALL_ENVOY_GRAFT_IDS =
  Object.freeze(Object.keys(ENVOY_GRAFT_DATABASE)) as readonly EnvoyGraftId[];

export function getEnvoyGraftDefinition(id: EnvoyGraftId): ClassGraftDefinition {
  const definition = getUniversalGraftDefinition(id);
  if (!definition || definition.classId !== 'ENVOY') {
    throw new Error(`Unknown Envoy graft: ${String(id)}`);
  }
  return definition as ClassGraftDefinition;
}

/** Legacy random API retained as a deterministic catalog slice. */
export function pickRandomEnvoyGraftOffers(count = 3): EnvoyGraftId[] {
  return ALL_ENVOY_GRAFT_IDS.slice(0, Math.max(0, count));
}
