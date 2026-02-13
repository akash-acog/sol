"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import OutputGrid from "@/components/output-grid";
import Header from "@/components/header";
import { PredictionResult, AnalysisResponse } from "@/lib/types";

export default function Home() {
  const [results, setResults] = useState<
    PredictionResult[] | AnalysisResponse | null
  >(() => {
    if (typeof window !== "undefined") {
      const savedResults = sessionStorage.getItem("solubilityResults");
      if (savedResults) {
        try {
          return JSON.parse(savedResults);
        } catch (e) {
          console.error("Failed to parse saved results:", e);
        }
      }
    }
    return null;
  });

  const [resultType, setResultType] = useState<
    "prediction" | "screening" | null
  >(() => {
    if (typeof window !== "undefined") {
      const savedType = sessionStorage.getItem("solubilityResultType");
      if (savedType) {
        return savedType as "prediction" | "screening";
      }
    }
    return null;
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Save results to sessionStorage whenever they change
  useEffect(() => {
    if (results) {
      sessionStorage.setItem("solubilityResults", JSON.stringify(results));
    } else {
      sessionStorage.removeItem("solubilityResults");
    }
  }, [results]);

  // Save result type to sessionStorage
  useEffect(() => {
    if (resultType) {
      sessionStorage.setItem("solubilityResultType", resultType);
    } else {
      sessionStorage.removeItem("solubilityResultType");
    }
  }, [resultType]);

  const handleProcess = (
    data: PredictionResult[] | AnalysisResponse,
    taskType: "solpred" | "solscreen",
  ) => {
    console.log("Processing data:", { taskType, dataType: typeof data, data });
    setResults(data);
    setResultType(taskType === "solpred" ? "prediction" : "screening");
  };

  const handleClearResults = () => {
    setResults(null);
    setResultType(null);
    sessionStorage.removeItem("solubilityResults");
    sessionStorage.removeItem("solubilityResultType");
  };

  const handleProcessingStateChange = (processing: boolean) => {
    setIsProcessing(processing);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Full-width Header */}
      <Header />

      {/* Main Content: Side-by-side Layout */}
      <div className="flex flex-1 overflow-hidden gap-6 p-6">
        <div className="w-1/4 bg-card border border-border rounded-lg p-8 overflow-auto">
          <Sidebar
            onProcess={handleProcess}
            onClearResults={handleClearResults}
            isProcessing={isProcessing}
            onProcessingStateChange={handleProcessingStateChange}
          />
        </div>

        <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
          <OutputGrid
            results={results}
            resultType={resultType}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    </div>
  );
}
