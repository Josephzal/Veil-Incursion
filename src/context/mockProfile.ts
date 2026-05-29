import { OperativeProfile } from '../types';

export const mockOperativeProfile: OperativeProfile = {
  operative_profile: {
    credentials: {
      id: "op_964388439",
      username: "Vanguard_9",
      cabal_alignment: "TERRAN_GRID",
      class: "AEGIS"
    },
    location_vectors: {
      home_sector: "PACIFIC_NORTHWEST",
      current_node_lock: "SEATTLE CORE",
      active_frequency: "LOCAL_SEATTLE"
    },
    regional_incursion: {
      seattle: 1.0,
      tokyo: 0.45
    },
    payload_manifest: {
      currencies: {
        crypto_glimmer: 14500,
        cabal_tributes: 320,
        frequency_tokens: 2
      },
      active_slots: {
        weapon_id: "bastion_cleaver_v4",
        frame_id: "animated_cherry_blossom_01",
        equipped_title_id: "tokyo_tested_aegis"
      },
      pvp_ai_gambit_deck: [
        { trigger: "MATCH_START", action: "CAST_SHIELD" },
        { trigger: "ENEMY_HP_GT_70", action: "APPLY_RESONANCE_BURN" }
      ]
    }
  }
};