"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { PredictionResult, AnalysisResponse } from "@/lib/types";
import { API_BASE_URL } from "@/lib/constants";
import { toast } from "sonner";

interface BatchSmilesInputProps {
  task: "solpred" | "solscreen";
  onProcess: (
    data: PredictionResult[] | AnalysisResponse,
    taskType: "solpred" | "solscreen",
  ) => void;
  onClearResults: () => void; // ← ADD THIS LINE
  isProcessing: boolean;
  onProcessingStateChange: (processing: boolean) => void;
  clearTrigger: number;
}

export default function BatchSmilesInput({
  task,
  onProcess,
  onClearResults, // ← ADD THIS LINE
  isProcessing,
  onProcessingStateChange,
  clearTrigger,
}: BatchSmilesInputProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [hasSample, setHasSample] = useState(false);

  // Clear file when clearTrigger changes
  useEffect(() => {
    if (clearTrigger > 0) {
      setFile(null);
      setFileName("");
      setHasSample(false);
    }
  }, [clearTrigger]);

  const handleTrySample = async () => {
    if (hasSample) {
      setFile(null);
      setFileName("");
      setHasSample(false);
    } else {
      try {
        // Load sample file from public folder
        const sampleFileName =
          task === "solpred" ? "solpred_sample.csv" : "solscreen_sample.csv";
        const response = await fetch(`/${sampleFileName}`);

        if (!response.ok) {
          throw new Error(`Failed to load ${sampleFileName}`);
        }

        const blob = await response.blob();
        const file = new File([blob], sampleFileName, { type: "text/csv" });

        setFile(file);
        setFileName(file.name);
        setHasSample(true);
        toast.success(`Loaded ${sampleFileName}`);
      } catch (error) {
        console.error("Error loading sample file:", error);
        toast.error("Failed to load sample file");
      }
    }
  };

  const handleDownloadSample = async () => {
    try {
      // Download sample file from public folder
      const sampleFileName =
        task === "solpred" ? "solpred_sample.csv" : "solscreen_sample.csv";
      const response = await fetch(`/${sampleFileName}`);

      if (!response.ok) {
        throw new Error(`Failed to download ${sampleFileName}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = sampleFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${sampleFileName}`);
    } catch (error) {
      console.error("Error downloading sample file:", error);
      toast.error("Failed to download sample file");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setHasSample(false);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error("Please select a CSV file");
      return;
    }

    onProcessingStateChange(true);

    try {
      if (task === "solscreen") {
        // Solvent Screening: Parse CSV and use first row
        const text = await file.text();
        const lines = text.trim().split("\n");

        if (lines.length < 2) {
          throw new Error("CSV file must have at least one data row");
        }

        const headers = lines[0].split(",").map((h) => h.trim());
        const firstRow = lines[1].split(",").map((v) => v.trim());

        // Create object from headers and values
        const rowData: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowData[header] = firstRow[index] || "";
        });

        const soluteSmiles =
          rowData.Solute_SMILES ||
          rowData.solute_smiles ||
          rowData.SMILES_Solute;
        const soluteName =
          rowData.Solute_Name ||
          rowData.solute_name ||
          rowData.Compound_Name ||
          undefined;

        if (!soluteSmiles) {
          throw new Error(
            "CSV must contain a column named 'Solute_SMILES', 'solute_smiles', or 'SMILES_Solute'",
          );
        }
        console.log("Sending to API:", {
          solute_smiles: soluteSmiles,
          solute_name: soluteName,
          headers: headers,
          firstRow: firstRow,
          rowData: rowData,
        });

        // Call solvent screening endpoint
        const response = await fetch(`/api/solvents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            solute_smiles: soluteSmiles,
            solute_name: soluteName,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Solvent screening failed");
        }

        const data: AnalysisResponse = await response.json();
        console.log("Solvent screening data:", data);

        // No structure generation needed for solvent screening
        onProcess(data, task);
        toast.success(
          `Analyzed ${data.rankings.length} solvents for ${soluteName || soluteSmiles}`,
        );
      } else {
        // Solubility Prediction
        const formData = new FormData();
        formData.append("data", file);
        formData.append("method", task);

        const response = await fetch(`/api/predict`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Processing failed");
        }

        const data = await response.json();
        console.log("1. Raw prediction data:", data);

        // Generate structure images for all molecules
        const resultsWithImages = await Promise.all(
          data.map(async (result: any, index: number) => {
            let structureImage = undefined;

            try {
              const imgResponse = await fetch(`/api/generate-structure`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  smiles: result.solute_smiles,
                  size: 400,
                }),
              });

              if (imgResponse.ok) {
                const imgData = await imgResponse.json();

                if (imgData.success && imgData.structure_base64) {
                  structureImage = imgData.structure_base64;
                }
              }
            } catch (imgError) {
              console.error(
                `Failed to generate structure for ${result.solute_smiles}:`,
                imgError,
              );
            }

            return {
              ...result,
              structure_base64: structureImage,
            };
          }),
        );

        console.log("Results with images:", resultsWithImages);

        onProcess(resultsWithImages, task);

        toast.success(
          `Processed ${resultsWithImages.length} compound${resultsWithImages.length > 1 ? "s" : ""} successfully`,
        );
      }
    } catch (error) {
      console.error("Error processing CSV:", error);

      // ← ADD THESE 2 LINES - Clear results on error
      onClearResults();

      toast.error(
        `Error: ${error instanceof Error ? error.message : "Failed to process CSV file"}`,
      );
    } finally {
      onProcessingStateChange(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* File Upload Area */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-foreground">
            CSV file
          </label>
          <Button
            onClick={handleTrySample}
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs font-medium gap-1.5 border-primary text-primary hover:bg-primary/10 hover:text-primary bg-primary/5"
          >
            <FileText className="w-3 h-3" />
            {hasSample ? "Clear sample" : "Try sample"}
          </Button>
        </div>
        <div className="relative">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-upload"
            disabled={isProcessing}
          />
          <label
            htmlFor="csv-upload"
            className="block w-full px-4 py-6 border-2 border-dashed border-border rounded-md hover:border-primary/60 transition-all duration-300 cursor-pointer bg-muted/20 text-center"
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl">📁</span>
              <span className="text-sm font-medium text-foreground">
                {fileName || "Click to upload CSV"}
              </span>
              <span className="text-xs text-muted-foreground">
                {task === "solscreen"
                  ? "CSV with Solute_Name and Solute_SMILES columns"
                  : "or drag and drop"}
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Download Sample Button */}
      <Button
        onClick={handleDownloadSample}
        variant="outline"
        className="w-full bg-muted text-foreground hover:bg-muted/80 border-border"
      >
        <Download className="w-4 h-4 mr-2" />
        Download sample CSV
      </Button>

      {/* Process Button */}
      <Button
        onClick={handleProcess}
        disabled={isProcessing || !file}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 rounded-md transition-all duration-300 disabled:opacity-50"
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {task === "solscreen" ? "Analyzing..." : "Processing..."}
          </span>
        ) : task === "solscreen" ? (
          "Screen solvents"
        ) : (
          "Predict solubility"
        )}
      </Button>
    </div>
  );
}
