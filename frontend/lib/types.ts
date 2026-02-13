// Backend request/response types
export interface PredictionRequest {
  solute_smiles: string;
  solvent_smiles: string;
  temperature_k: number;
}

export interface PredictionResponse {
  predicted_logs: number;
  temperature_k: number;
  warning?: string;
}

export interface AnalysisRequest {
  solute_smiles: string;
  solute_name?: string;
}

export interface SolventRanking {
  rank: number;
  solvent_name: string;
  solvent_smiles: string;
  predicted_logs: number;
}

export interface AnalysisResponse {
  solute_smiles: string;
  solute_name?: string;
  ranking_temperature_k: number;
  rankings: SolventRanking[];
  static_heatmap_base64: string;
  dynamic_heatmap_base64: string;
}

// Frontend display types (extended for rich metadata)
export interface PredictionResult extends PredictionResponse {
  solute_smiles: string;
  solvent_smiles: string;
  structure_base64?: string; // Add this line

  // Optional metadata fields (from CSV)
  compound_name?: string;
  solvent_name?: string;
  cas?: string;
  pubchem_cid?: string;
  fda_approved?: string;
  source?: string;

  // Ground truth data (if available in CSV)
  actual_logs?: number;
  solubility_mole_fraction?: number;
  solubility_mol_l?: number;
}

// Row metadata for internal processing
export interface RowMetadata {
  compound_name?: string;
  solvent_name?: string;
  cas?: string;
  pubchem_cid?: string;
  fda_approved?: string;
  source?: string;
  actual_logs?: number;
  solubility_mole_fraction?: number;
  solubility_mol_l?: number;
}
