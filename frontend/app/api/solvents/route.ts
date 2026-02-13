import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { solute_smiles, solute_name } = body;

    if (!solute_smiles) {
      return NextResponse.json(
        { error: "No solute SMILES provided" },
        { status: 400 },
      );
    }

    console.log("Requesting solvent analysis for:", {
      solute_smiles,
      solute_name,
    });

    // Send to backend /solvents endpoint
    const response = await fetch(`${BACKEND_URL}/solvents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        solute_smiles,
        solute_name: solute_name || null,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error response:", errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    console.log(
      "Solvent analysis complete:",
      data.rankings?.length,
      "solvents",
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("Solvents API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
