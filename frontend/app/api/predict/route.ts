import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Helper to safely parse numbers
const parseNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("data") as File;
    const method = formData.get("method") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Read and parse the CSV file
    const fileText = await file.text();
    const parsedCSV = Papa.parse(fileText, {
      header: true,
      skipEmptyLines: true,
    });

    const csvData = parsedCSV.data as any[];

    // Format data for backend according to sol/backend/main.py
    const backendPayload = csvData.map((row) => ({
      solute_smiles:
        row.SMILES_Solute || row.solute_smiles || row.Solute_SMILES, // ← UPDATED: Added Solute_SMILES
      solvent_smiles:
        row.SMILES_Solvent || row.solvent_smiles || row.Solvent_SMILES, // ← UPDATED: Added Solvent_SMILES
      temperature_k: parseFloat(
        row.Temperature_K || row.temperature_k || "298.15",
      ),
    }));

    console.log("Sending to backend:", backendPayload.slice(0, 2));

    // Send to backend as JSON array
    const response = await fetch(`${BACKEND_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error response:", errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status },
      );
    }

    const predictions = await response.json();
    console.log("Backend predictions:", predictions.slice(0, 2));

    // Merge CSV data with predictions
    const mergedData = predictions.map((pred: any, index: number) => {
      const csvRow = csvData[index] || {};

      return {
        // Prediction data from backend
        solute_smiles: backendPayload[index].solute_smiles,
        solvent_smiles: backendPayload[index].solvent_smiles,
        solvent_name:
          csvRow.Solvent_Name || csvRow.Solvent || csvRow.solvent_name || null, // ← FIXED: Added Solvent_Name
        temperature_k: pred.temperature_k,
        predicted_logs: pred.predicted_logs,
        warning: pred.warning,

        // CSV-only columns - PARSE NUMBERS PROPERLY
        compound_name: csvRow.Compound_Name || csvRow.compound_name || null,
        cas: csvRow.CAS || csvRow.cas || null,
        pubchem_cid: parseNumber(csvRow.PubChem_CID || csvRow.pubchem_cid),
        fda_approved: csvRow.FDA_Approved || csvRow.fda_approved || null,
        source: csvRow.Source || csvRow.source || null,
        actual_logs: parseNumber(csvRow["LogS(mol/L)"] || csvRow.actual_logs),
      };
    });

    console.log("Merged data sample:", mergedData.slice(0, 2));

    return NextResponse.json(mergedData);
  } catch (error) {
    console.error("Predict API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
