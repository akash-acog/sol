// Sample data for testing
export const SAMPLE_CSV_CONTENT = `Solute_Name,Solute_SMILES,Solvent_Name,Solvent_SMILES,Temperature_K
Aspirin,CC(=O)Oc1ccccc1C(=O)O,Water,O,298.15
Caffeine,CN1C=NC2=C1C(=O)N(C(=O)N2C)C,Ethanol,CCO,298.15
Ibuprofen,CC(C)Cc1ccc(cc1)C(C)C(=O)O,Methanol,CO,298.15
Paracetamol,CC(=O)Nc1ccc(O)cc1,Water,O,310.15
Benzene,c1ccccc1,Toluene,Cc1ccccc1,298.15`;

export const SAMPLE_SINGLE_SMILES = "CC(=O)Oc1ccccc1C(=O)O";
export const SAMPLE_SINGLE_NAME = "Aspirin";
export const SAMPLE_SOLVENT_SMILES = "O";
export const SAMPLE_SOLVENT_NAME = "Water";
export const SAMPLE_TEMPERATURE = 298.15;

// API endpoint
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// CMC Solubility Scale
export const CMC_SCALE = {
  "-6 to -5": {
    label: "Practically Insoluble",
    color: "bg-red-600",
    textColor: "text-red-600",
  },
  "-5 to -3": {
    label: "Poorly Soluble",
    color: "bg-orange-500",
    textColor: "text-orange-500",
  },
  "-3 to -1": {
    label: "Moderate",
    color: "bg-yellow-500",
    textColor: "text-yellow-500",
  },
  "-1 to 0.5": {
    label: "Good",
    color: "bg-green-400",
    textColor: "text-green-400",
  },
  "0.5+": {
    label: "Excellent",
    color: "bg-green-700",
    textColor: "text-green-700",
  },
};

// Helper function to get CMC status
export function getCMCStatus(logS: number) {
  if (logS >= -6 && logS < -5) return CMC_SCALE["-6 to -5"];
  if (logS >= -5 && logS < -3) return CMC_SCALE["-5 to -3"];
  if (logS >= -3 && logS < -1) return CMC_SCALE["-3 to -1"];
  if (logS >= -1 && logS <= 0.5) return CMC_SCALE["-1 to 0.5"];
  if (logS > 0.5) return CMC_SCALE["0.5+"];
  return CMC_SCALE["-6 to -5"]; // Default fallback
}
