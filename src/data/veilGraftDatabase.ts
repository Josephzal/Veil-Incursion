import type { VeilGraftDefinition, VeilGraftId } from '../types/veilGraft';
import {
  getUniversalGraftDefinition,
  listUniversalGraftsForClass,
} from './universalGraftRegistry';

/** Live Aegis compatibility view; all old mechanic graft IDs are retired. */
export const GRAFT_DATABASE: Readonly<Record<string, VeilGraftDefinition>> =
  Object.freeze(Object.fromEntries(
    listUniversalGraftsForClass('AEGIS').map((definition) => [
      definition.id,
      definition as VeilGraftDefinition,
    ]),
  ));

export const ALL_VEIL_GRAFT_IDS =
  Object.freeze(Object.keys(GRAFT_DATABASE)) as readonly VeilGraftId[];

export function getVeilGraftDefinition(id: VeilGraftId): VeilGraftDefinition {
  const definition = getUniversalGraftDefinition(id);
  if (!definition || definition.classId !== 'AEGIS') {
    throw new Error(`Unknown Aegis graft: ${String(id)}`);
  }
  return definition as VeilGraftDefinition;
}
