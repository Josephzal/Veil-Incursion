import { FactionType } from './game';

/** Legacy alias — Cabal alignment maps 1:1 to persistent faction type. */
export type CabalAlignment = FactionType;

export interface OperativeProfile {
  operative_profile: {
    credentials: {
      id: string;
      username: string;
      cabal_alignment: CabalAlignment;
      class: string;
    };
    location_vectors: {
      home_sector: string;
      current_node_lock: string;
      active_frequency: string;
    };
    regional_incursion: Record<string, number>;
    payload_manifest: {
      currencies: {
        crypto_glimmer: number;
        cabal_tributes: number;
        frequency_tokens: number;
      };
      active_slots: {
        weapon_id: string;
        frame_id: string;
        equipped_title_id: string;
      };
      pvp_ai_gambit_deck: Array<{ trigger: string; action: string }>;
    };
  };
}
