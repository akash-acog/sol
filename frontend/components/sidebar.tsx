"use client";

import { useState } from "react";
import InputTabs from "./input-tabs";
import { Settings2, RotateCcw } from "lucide-react";
import { PredictionResult, AnalysisResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SidebarProps {
  onProcess: (
    data: PredictionResult[] | AnalysisResponse,
    taskType: "solpred" | "solscreen",
  ) => void;
  onClearResults: () => void;
  isProcessing: boolean;
  onProcessingStateChange: (processing: boolean) => void;
}

export default function Sidebar({
  onProcess,
  onClearResults,
  isProcessing,
  onProcessingStateChange,
}: SidebarProps) {
  const [task, setTask] = useState<"solpred" | "solscreen">("solpred");
  const [clearTrigger, setClearTrigger] = useState(0);

  const handleClearAll = () => {
    onClearResults();
    setClearTrigger((prev) => prev + 1);
  };

  return (
    <>
      {/* SECTION 1: Header with Clear All Button */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Input</h2>
          </div>
          <Button
            onClick={handleClearAll}
            disabled={isProcessing}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs font-medium gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear all
          </Button>
        </div>
        {/* <p className="text-sm text-muted-foreground ml-2">
          Select input mode and provide your data
        </p> */}
      </div>

      {/* SECTION 2: Task Selection Dropdown */}
      <div className="space-y-2 mb-4">
        <Label
          htmlFor="task-select"
          className="text-sm font-semibold text-foreground"
        >
          Task
        </Label>
        <Select
          value={task}
          onValueChange={(value) => setTask(value as "solpred" | "solscreen")}
          disabled={isProcessing}
        >
          <SelectTrigger id="task-select">
            <SelectValue placeholder="Select task" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solpred">Solute solubility</SelectItem>
            <SelectItem value="solscreen">Solvent screening</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-2">
          {task === "solpred"
            ? "Predict solubility for specific solute-solvent pairs"
            : "Screen multiple solvents for a single solute"}
        </p>
      </div>

      {/* SECTION 3: Input Tabs (Single/Batch) */}
      <InputTabs
        task={task}
        onProcess={onProcess}
        onClearResults={onClearResults}
        isProcessing={isProcessing}
        onProcessingStateChange={onProcessingStateChange}
        clearTrigger={clearTrigger}
      />
    </>
  );
}
