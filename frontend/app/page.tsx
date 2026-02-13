"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar";
import OutputGrid from "@/components/output-grid";
import Header from "@/components/header";
import { PredictionResult, AnalysisResponse } from "@/lib/types";

export default function Home() {
  // Simple state initialization without sessionStorage
  const [results, setResults] = useState<
    PredictionResult[] | AnalysisResponse | null
  >(null);

  const [resultType, setResultType] = useState<
    "prediction" | "screening" | null
  >(null);

  const [isProcessing, setIsProcessing] = useState(false);

  // Remove all useEffect hooks that save/load from sessionStorage

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
