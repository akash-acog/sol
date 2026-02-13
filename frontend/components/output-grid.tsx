"use client";

import { useState, useEffect } from "react";
import MoleculeTable from "./molecule-table";
import EmptyState from "./empty-state";
import SolventScreening from "./solvent-screening";
import { PredictionResult, AnalysisResponse } from "@/lib/types";

interface OutputGridProps {
  results: PredictionResult[] | AnalysisResponse | null;
  resultType: "prediction" | "screening" | null;
  isProcessing: boolean;
}

export default function OutputGrid({
  results,
  resultType,
  isProcessing,
}: OutputGridProps) {
  const [viewMode, setViewMode] = useState<"table" | "grid">(() => {
    // Initialize view from sessionStorage if available
    if (typeof window !== "undefined") {
      const savedView = sessionStorage.getItem("resultsView");
      return savedView === "grid" ? "grid" : "table";
    }
    return "table";
  });

  // Save view to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem("resultsView", viewMode);
  }, [viewMode]);

  // Show empty state when not processing and no results
  if (isProcessing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-lg font-semibold mt-4">Processing...</p>
          <p className="text-muted-foreground">
            Please wait while the results are being loaded.
          </p>
        </div>
      </div>
    );
  }

  if (!results) {
    return <EmptyState />;
  }

  // Solvent Screening Results - Use dedicated component
  if (resultType === "screening") {
    const screeningData = results as AnalysisResponse;
    return (
      <SolventScreening results={screeningData} isLoading={isProcessing} />
    );
  }

  // Solubility Prediction Results
  const predictionResults = results as PredictionResult[];

  if (!Array.isArray(predictionResults) || predictionResults.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Results content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "table" ? (
          <MoleculeTable results={predictionResults} />
        ) : (
          <div></div>
        )}
      </div>
    </div>
  );
}
