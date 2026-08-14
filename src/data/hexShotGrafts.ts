import type { ClassGraftDefinition, HexShotGraftId } from '../types/classGraft';
import {
  getUniversalGraftDefinition,
  listUniversalGraftsForClass,
} from './universalGraftRegistry';

/** Live compatibility view; legacy Hex graft IDs are intentionally absent. */
export const HEX_SHOT_GRAFT_DATABASE: Readonly<Record<string, ClassGraftDefinition>> =
  Object.freeze(Object.fromEntries(
    listUniversalGraftsForClass('HEX_SHOT').map((definition) => [
      definition.id,
      definition as ClassGraftDefinition,
    ]),
  ));

export const ALL_HEX_SHOT_GRAFT_IDS =
  Object.freeze(Object.keys(HEX_SHOT_GRAFT_DATABASE)) as readonly HexShotGraftId[];

export function getHexShotGraftDefinition(id: HexShotGraftId): ClassGraftDefinition {
  const definition = getUniversalGraftDefinition(id);
  if (!definition || definition.classId !== 'HEX_SHOT') {
    throw new Error(`Unknown Hex Shot graft: ${String(id)}`);
  }
  return definition as ClassGraftDefinition;
}

/** Legacy random API retained as a deterministic catalog slice. */
export function pickRandomHexShotGraftOffers(count = 3): HexShotGraftId[] {
  return ALL_HEX_SHOT_GRAFT_IDS.slice(0, Math.max(0, count));
}
