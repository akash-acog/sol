"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play, FlaskConical, X } from "lucide-react";
import { PredictionResult, AnalysisResponse } from "@/lib/types";
import { API_BASE_URL } from "@/lib/constants";
import { toast } from "sonner";

interface SingleSmilesInputProps {
  task: "solpred" | "solscreen";
  onProcess: (
    data: PredictionResult[] | AnalysisResponse,
    taskType: "solpred" | "solscreen",
  ) => void;
  isProcessing: boolean;
  onProcessingStateChange: (processing: boolean) => void;
}

// Sample data
const SAMPLE_DATA = {
  name: "Acetaminophen",
  smiles: "CC(=O)NC1=CC=C(O)C=C1",
  solvent: "CCO",
  solventName: "Ethanol", // ← NEW: Added solvent name
  temperature: "300",
};

export default function SingleSmilesInput({
  task,
  onProcess,
  isProcessing,
  onProcessingStateChange,
}: SingleSmilesInputProps) {
  const [soluteName, setSoluteName] = useState("");
  const [soluteSmiles, setSoluteSmiles] = useState("");
  const [solventSmiles, setSolventSmiles] = useState("");
  const [solventName, setSolventName] = useState(""); // ← NEW: Added solvent name state
  const [temperature, setTemperature] = useState("300");

  // Check if any field has content (not just sample data)
  const hasContent = () => {
    if (task === "solpred") {
      return (
        soluteName.trim() !== "" ||
        soluteSmiles.trim() !== "" ||
        solventSmiles.trim() !== "" ||
        solventName.trim() !== "" || // ← NEW: Include solvent name in check
        temperature !== "300"
      );
    } else {
      // solscreen
      return soluteName.trim() !== "" || soluteSmiles.trim() !== "";
    }
  };

  const handleTrySample = () => {
    if (hasContent()) {
      // Clear all fields
      setSoluteName("");
      setSoluteSmiles("");
      setSolventSmiles("");
      setSolventName(""); // ← NEW: Clear solvent name
      setTemperature("300");
      toast.info("Cleared all inputs");
    } else {
      // Load sample
      setSoluteName(SAMPLE_DATA.name);
      setSoluteSmiles(SAMPLE_DATA.smiles);
      if (task === "solpred") {
        setSolventSmiles(SAMPLE_DATA.solvent);
        setSolventName(SAMPLE_DATA.solventName); // ← NEW: Load sample solvent name
        setTemperature(SAMPLE_DATA.temperature);
      }
      toast.success(`Loaded ${SAMPLE_DATA.name} sample`);
    }
  };

  const handleSubmit = async () => {
    if (!soluteSmiles.trim()) {
      toast.error("Please enter solute SMILES");
      return;
    }

    if (task === "solpred" && !solventSmiles.trim()) {
      toast.error("Please enter solvent SMILES");
      return;
    }

    if (task === "solpred") {
      const tempK = parseFloat(temperature);
      if (isNaN(tempK) || tempK <= 0) {
        toast.error("Please enter a valid temperature");
        return;
      }
    }

    onProcessingStateChange(true);

    try {
      if (task === "solpred") {
        // Solubility Prediction - Create CSV file from input
        // ← NEW: Added Solvent column in CSV
        const csvContent = `Compound_Name,SMILES_Solute,Solvent,SMILES_Solvent,Temperature_K
${soluteName.trim() || ""},${soluteSmiles.trim()},${solventName.trim() || ""},${solventSmiles.trim()},${temperature}`;

        const blob = new Blob([csvContent], { type: "text/csv" });
        const file = new File([blob], "single_prediction.csv", {
          type: "text/csv",
        });

        const formData = new FormData();
        formData.append("data", file);
        formData.append("method", "solpred");

        const response = await fetch(`/api/predict`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Prediction failed");
        }

        const data = await response.json();
        console.log("Prediction response:", data);

        // Data comes back as array, take first item
        const prediction = Array.isArray(data) ? data[0] : data;

        // Generate structure image
        let structureImage = undefined;
        try {
          const imgResponse = await fetch(`/api/generate-structure`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              smiles: soluteSmiles.trim(),
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
          console.error("Failed to generate structure:", imgError);
        }

        const result: PredictionResult = {
          ...prediction,
          structure_base64: structureImage,
        };

        onProcess([result], task);
        toast.success("Prediction completed successfully");
      } else {
        // Solvent Screening - No structure generation needed
        const response = await fetch(`/api/solvents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            solute_smiles: soluteSmiles.trim(),
            solute_name: soluteName.trim() || undefined,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Solvent screening failed");
        }

        const data: AnalysisResponse = await response.json();

        onProcess(data, task);
        toast.success(`Analyzed ${data.rankings.length} solvents successfully`);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error(
        `Failed to process request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      onProcessingStateChange(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Try Sample Button */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="solute-name">
            Solute name {task === "solscreen" ? "(Recommended)" : "(Optional)"}
          </Label>

          <Button
            onClick={handleTrySample}
            variant="outline"
            size="sm"
            disabled={isProcessing}
            className="h-7 px-2.5 text-xs font-medium gap-1.5 border-primary text-primary hover:bg-primary/10 hover:text-primary bg-primary/5"
          >
            {hasContent() ? (
              <>
                <X className="w-3.5 h-3.5" />
                Clear
              </>
            ) : (
              <>
                <FlaskConical className="w-3.5 h-3.5" />
                Try sample
              </>
            )}
          </Button>
        </div>
        <Input
          id="solute-name"
          placeholder="e.g., Acetaminophen"
          value={soluteName}
          onChange={(e) => setSoluteName(e.target.value)}
          disabled={isProcessing}
        />
        {task === "solscreen" && (
          <p className="text-xs text-muted-foreground mt-1">
            Providing a name helps identify the solute in results
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="solute-smiles">Solute SMILES</Label>
        <Input
          id="solute-smiles"
          placeholder="e.g., CC(=O)NC1=CC=C(O)C=C1"
          value={soluteSmiles}
          onChange={(e) => setSoluteSmiles(e.target.value)}
          disabled={isProcessing}
          type="text"
          className="font-mono text-sm"
        />
      </div>

      {task === "solpred" && (
        <>
          {/* ← NEW: Solvent Name Field */}
          <div className="space-y-2">
            <Label htmlFor="solvent-name">Solvent name (Optional)</Label>
            <Input
              id="solvent-name"
              placeholder="e.g., Ethanol"
              value={solventName}
              onChange={(e) => setSolventName(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="solvent-smiles">Solvent SMILES</Label>
            <Input
              id="solvent-smiles"
              placeholder="e.g., CCO (ethanol)"
              value={solventSmiles}
              onChange={(e) => setSolventSmiles(e.target.value)}
              disabled={isProcessing}
              type="text"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperature">Temperature (K)</Label>
            <Input
              id="temperature"
              type="number"
              step="1"
              placeholder="300"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              disabled={isProcessing}
            />
          </div>
        </>
      )}

      <Button onClick={handleSubmit} disabled={isProcessing} className="w-full">
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {task === "solpred" ? "Predicting..." : "Analyzing solvents..."}
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            {task === "solpred" ? "Predict solubility" : "Screen solvents"}
          </>
        )}
      </Button>
    </div>
  );
}
