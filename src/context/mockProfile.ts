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
      home_sector: "PACIFIC // US",
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
      stored_items: [
        { id: "reservoir_coil_mk2", designation: "RESERVOIR COIL MK2", category: "TRINKET" },
        { id: "void_filament_spool", designation: "VOID FILAMENT SPOOL", category: "MATERIAL" },
        { id: "tier1_cache_unopened", designation: "TIER-1 VEIL CACHE", category: "CACHE" },
        { id: "phase_thread_liner", designation: "PHASE-THREAD LINER", category: "MOD" },
      ],
      pvp_ai_gambit_deck: [
        { trigger: "MATCH_START", action: "CAST_SHIELD" },
        { trigger: "ENEMY_HP_GT_70", action: "APPLY_RESONANCE_BURN" }
      ]
    }
  }
};