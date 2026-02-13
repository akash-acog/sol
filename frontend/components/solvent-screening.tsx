"use client";

import { useMemo, useState, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { Loader2, Info } from "lucide-react";
import { ColDef } from "ag-grid-community";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImageDialog } from "./imageDialog";
import ViewToggleSolvent from "./view-toggle-solvent";
import ExcelExport from "./excel-export";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface SolventRanking {
  rank: number;
  solvent_name: string;
  solvent_smiles: string;
  predicted_logs: number;
  structure_base64?: string;
}

interface SolventScreeningResult {
  solute_smiles: string;
  solute_name?: string;
  ranking_temperature_k: number;
  rankings: SolventRanking[];
  temperatures?: number[];
  heatmap_data?: Array<{
    solvent: string;
    [key: string]: any;
  }>;
  static_heatmap_base64: string;
  dynamic_heatmap_base64: string;
}

interface SolventScreeningProps {
  results: SolventScreeningResult | null;
  isLoading: boolean;
}

/**
 * Get solubility CSS class based on LogS value
 * Ranges:
 * - 0.5 to 1.0+  : Excellent (Dark Green #006400)
 * - -1.0 to 0.5  : Good (Light Green #90ee90)
 * - -3.0 to -1.0 : Moderate (Gold #ffd700)
 * - -5.0 to -3.0 : Poorly Soluble (Dark Orange #ff8c00)
 * - -6.0 to -5.0 : Practically Insoluble (Dark Red #8b0000)
 */
function getSolubilityClass(logs: number): string {
  if (logs >= 0.5) return "solubility-excellent";
  if (logs >= -1.0) return "solubility-good";
  if (logs >= -3.0) return "solubility-moderate";
  if (logs >= -5.0) return "solubility-poor";
  return "solubility-insoluble";
}

// Helper function to normalize solvent names for matching
function normalizeSolventName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export default function SolventScreening({
  results,
  isLoading,
}: SolventScreeningProps) {
  const [view, setView] = useState<"heatmap" | "table">("heatmap");

  const [isEnhancedContrast, setIsEnhancedContrast] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    title: string;
    description: string;
  } | null>(null);

  // Set default temperature to 300K
  const [selectedTemperature, setSelectedTemperature] = useState<number>(300);

  const [tableMode, setTableMode] = useState<"single" | "multi">("single");

  useEffect(() => {
    if (results?.ranking_temperature_k) {
      setSelectedTemperature(300);
    }
    setView("heatmap");
  }, [results]);

  // Get available temperatures from heatmap_data
  const availableTemperatures = useMemo(() => {
    if (results?.temperatures) {
      return results.temperatures;
    }
    if (results?.heatmap_data && results.heatmap_data.length > 0) {
      const firstItem = results.heatmap_data[0];
      const tempKeys = Object.keys(firstItem)
        .filter((key) => key !== "solvent" && !isNaN(Number(key)))
        .map(Number)
        .sort((a, b) => a - b);
      return tempKeys;
    }
    return Array.from({ length: 21 }, (_, i) => 250 + i * 10);
  }, [results]);

  // For single temperature mode
  const filteredRankings = useMemo(() => {
    if (!results) return [];

    if (results.heatmap_data && results.heatmap_data.length > 0) {
      const tempKey = selectedTemperature.toString();

      const rankingsMap = new Map(
        results.rankings?.map((r) => [
          normalizeSolventName(r.solvent_name),
          {
            solvent_name: r.solvent_name,
            solvent_smiles: r.solvent_smiles,
            structure_base64: r.structure_base64,
          },
        ]) || [],
      );

      const rankingsWithLogS = results.heatmap_data
        .map((item) => {
          const normalizedKey = normalizeSolventName(item.solvent);
          const rankingData = rankingsMap.get(normalizedKey);

          return {
            solvent_name: rankingData?.solvent_name || item.solvent,
            solvent_smiles: rankingData?.solvent_smiles || "",
            structure_base64: rankingData?.structure_base64,
            predicted_logs:
              typeof item[tempKey] === "number"
                ? item[tempKey]
                : parseFloat(item[tempKey] || "0"),
          };
        })
        .filter((item) => !isNaN(item.predicted_logs));

      rankingsWithLogS.sort((a, b) => b.predicted_logs - a.predicted_logs);

      return rankingsWithLogS.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
    }

    return results.rankings || [];
  }, [results, selectedTemperature]);

  // Enhanced multi-temperature data
  const multiTempData = useMemo(() => {
    if (!results?.heatmap_data || !results?.rankings) return [];

    const rankingsMap = new Map(
      results.rankings.map((r) => [
        normalizeSolventName(r.solvent_name),
        {
          solvent_name: r.solvent_name,
          solvent_smiles: r.solvent_smiles,
          structure_base64: r.structure_base64,
        },
      ]),
    );

    return results.heatmap_data.map((item) => {
      const normalizedKey = normalizeSolventName(item.solvent);
      const rankingData = rankingsMap.get(normalizedKey);

      return {
        ...item,
        solvent_display: item.solvent,
        solvent_name: rankingData?.solvent_name || item.solvent,
        solvent_smiles: rankingData?.solvent_smiles || "",
        structure_base64: rankingData?.structure_base64,
      };
    });
  }, [results]);

  const openImageDialog = () => {
    if (!results) return;

    const imageUrl = isEnhancedContrast
      ? `data:image/png;base64,${results.dynamic_heatmap_base64}`
      : `data:image/png;base64,${results.static_heatmap_base64}`;

    setSelectedImage({
      url: imageUrl,
      title: isEnhancedContrast
        ? "Dynamic Heatmap (Enhanced Contrast)"
        : "Static Heatmap",
      description: isEnhancedContrast
        ? "Temperature-dependent solubility visualization with dynamic color scale"
        : "Solubility predictions across temperature range with clinical tiers",
    });
    setDialogOpen(true);
  };

  // Single temperature columns - Fixed width for SMILES column
  const columnDefs: ColDef<SolventRanking>[] = useMemo(
    () => [
      {
        headerName: "Rank",
        field: "rank",
        width: 80,
        sortable: true,
        cellClass: "font-semibold",
      },
      {
        headerName: "Solvent Name",
        field: "solvent_name",
        width: 200,
        filter: true,
        sortable: true,
      },
      {
        headerName: "SMILES",
        field: "solvent_smiles",
        width: 300,
        filter: true,
        cellClass: "font-mono text-xs",
      },
      {
        headerName: "Predicted LogS",
        field: "predicted_logs",
        width: 150,
        sortable: true,
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "N/A",
        cellClass: (params) => {
          const value = params.value;
          if (value === undefined || value === null) return "";
          return getSolubilityClass(value);
        },
      },
    ],
    [],
  );

  // Multi-temperature columns - Fixed width for SMILES column
  const multiTempColumnDefs: ColDef<any>[] = useMemo(() => {
    if (!results?.heatmap_data || availableTemperatures.length === 0) return [];

    const baseCols: ColDef<any>[] = [
      {
        headerName: "Solvent Name",
        field: "solvent_name",
        width: 200,
        filter: true,
        sortable: true,
        pinned: "left",
      },
      {
        headerName: "SMILES",
        field: "solvent_smiles",
        width: 300,
        filter: true,
        cellClass: "font-mono text-xs",
      },
    ];

    const tempCols: ColDef<any>[] = availableTemperatures.map((temp) => ({
      headerName: `Predicted LogS @ ${temp}K`,
      field: temp.toString(),
      width: 180,
      sortable: true,
      valueFormatter: (params) =>
        params.value != null ? params.value.toFixed(2) : "N/A",
      cellClass: (params) => {
        const value = params.value;
        if (value === undefined || value === null) return "";
        return getSolubilityClass(value);
      },
    }));

    return [...baseCols, ...tempCols];
  }, [results, availableTemperatures]);

  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
    }),
    [],
  );

  if (isLoading) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-lg font-semibold mt-4">Analyzing solvents...</p>
          <p className="text-muted-foreground">
            Generating rankings and heatmaps
          </p>
        </div>
      </main>
    );
  }

  if (!results) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            No results yet. Enter a solute SMILES and run solvent screening.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="rounded-lg">
          <p className="text-sm font-semibold text-[hsl(var(--info-foreground))]">
            Showing results for: {results.solute_name || results.solute_smiles}
          </p>
          <p className="text-xs text-[hsl(var(--info-foreground)/0.8)]">
            Temperature-dependent (250-450 K) solubility predictions in water
            and diverse organic solvents (ε = 1.8-37.5)
          </p>
        </div>
        <div>
          <ViewToggleSolvent view={view} onViewChange={setView} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === "heatmap" ? (
          <div>
            <div className="flex items-center space-x-2 px-3 py-2 mx-4">
              <Label
                htmlFor="heatmap-toggle"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                Dynamic scale
              </Label>
              <Switch
                id="heatmap-toggle"
                checked={isEnhancedContrast}
                onCheckedChange={setIsEnhancedContrast}
              />
              <TooltipProvider>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Info className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-sm">
                      The logS ranges are dynamically selected based on the
                      predicted value.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col items-center justify-start gap-4">
                <div className="relative w-full">
                  <img
                    src={`data:image/png;base64,${
                      isEnhancedContrast
                        ? results.dynamic_heatmap_base64
                        : results.static_heatmap_base64
                    }`}
                    alt={
                      isEnhancedContrast
                        ? "Dynamic Heatmap (Enhanced Contrast)"
                        : "Static Heatmap"
                    }
                    className="max-w-full h-auto border border-border rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-all duration-300"
                    onClick={openImageDialog}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full p-6">
            <div className="mb-4 flex items-center gap-4 flex-wrap">
              {/* Mode Toggle */}
              {results.heatmap_data && availableTemperatures.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">View Mode:</Label>
                  <div className="flex border rounded-md overflow-hidden">
                    <button
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        tableMode === "single"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                      onClick={() => setTableMode("single")}
                    >
                      Single Temp
                    </button>
                    <button
                      className={`px-3 py-1.5 text-sm font-medium transition-colors border-l ${
                        tableMode === "multi"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                      onClick={() => setTableMode("multi")}
                    >
                      All Temps
                    </button>
                  </div>
                </div>
              )}

              {/* Temperature Selector */}
              {tableMode === "single" && (
                <>
                  <Label
                    htmlFor="temperature-select"
                    className="text-sm font-medium"
                  >
                    Temperature:
                  </Label>
                  <Select
                    value={selectedTemperature.toString()}
                    onValueChange={(value) =>
                      setSelectedTemperature(parseFloat(value))
                    }
                  >
                    <SelectTrigger
                      id="temperature-select"
                      className="w-[150px]"
                    >
                      <SelectValue>{selectedTemperature} K</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemperatures.map((temp) => (
                        <SelectItem key={temp} value={temp.toString()}>
                          {temp} K
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {/* Row count */}
              <span>
                {view === "table" && (
                  <ExcelExport
                    solventData={
                      tableMode === "single" ? filteredRankings : multiTempData
                    }
                    solventColumns={(tableMode === "single"
                      ? columnDefs
                      : multiTempColumnDefs
                    ).map((col) => ({
                      field: col.field || "",
                      headerName: col.headerName || "",
                    }))}
                    temperatures={availableTemperatures}
                    tableMode={tableMode}
                    taskType="solscreen"
                  />
                )}
              </span>
              <span className="text-sm text-muted-foreground ml-auto">
                {tableMode === "single"
                  ? `${filteredRankings.length} solvents ranked`
                  : `${multiTempData.length} solvents`}
              </span>
            </div>

            {/* AG Grid Table */}
            <div className="ag-theme-alpine h-full w-full">
              <AgGridReact
                theme="legacy"
                key={tableMode}
                rowData={
                  tableMode === "single" ? filteredRankings : multiTempData
                }
                columnDefs={
                  tableMode === "single" ? columnDefs : multiTempColumnDefs
                }
                defaultColDef={defaultColDef}
                rowHeight={48}
                animateRows={true}
                pagination={true}
                paginationPageSize={10}
                paginationPageSizeSelector={[10, 20, 50]}
              />
            </div>
          </div>
        )}
      </div>

      {selectedImage && (
        <ImageDialog
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          imageUrl={selectedImage.url}
          title={selectedImage.title}
          description={selectedImage.description}
        />
      )}
    </div>
  );
}
