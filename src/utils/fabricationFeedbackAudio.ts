/**
 * Semantic Forge fabrication audio hooks.
 * No dedicated SFX assets are present in the repository yet — these are
 * integration points that remain silent until assets are wired.
 */

export type FabricationAudioCue =
  | 'fabrication_accept'
  | 'fabrication_converge'
  | 'fabrication_seal'
  | 'fabrication_complete';

export interface FabricationAudioHooks {
  play: (cue: FabricationAudioCue) => void;
}

/** No-op default — report missing assets rather than reusing combat SFX. */
export const fabricationAudioHooks: FabricationAudioHooks = {
  play: (_cue) => {
    // Intentionally silent until Black Market fabrication SFX are added.
  },
};
