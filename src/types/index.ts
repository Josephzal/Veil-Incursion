export type CabalAlignment = 'TERRAN_GRID' | 'LEGION' | 'SOLARIS';
export type ClassBlueprint = 'AEGIS' | 'RIFTSHOT' | 'ENVOY';

export interface CredentialManifest {
  id: string;
  username: string;
  cabal_alignment: CabalAlignment;
  class: ClassBlueprint;
}

export interface LocationVectors {
  home_sector: string;
  current_node_lock: string;
  active_frequency: string;
}

export interface RegionalIncursionMatrix {
  [cityId: string]: number;
}

export interface CurrencyLedger {
  crypto_glimmer: number;
  cabal_tributes: number;
  frequency_tokens: number;
}

export interface ActiveSlots {
  weapon_id: string;
  frame_id: string;
  equipped_title_id: string;
}

export interface GambitCard {
  trigger: string;
  action: string;
}

export interface PayloadManifest {
  currencies: CurrencyLedger;
  active_slots: ActiveSlots;
  pvp_ai_gambit_deck: GambitCard[];
}

export interface OperativeProfile {
  operative_profile: {
    credentials: CredentialManifest;
    location_vectors: LocationVectors;
    regional_incursion: RegionalIncursionMatrix;
    payload_manifest: PayloadManifest;
  };
}