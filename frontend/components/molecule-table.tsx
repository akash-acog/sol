"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { PredictionResult } from "@/lib/types";
import { FilterX, Columns, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExcelExport from "./excel-export";
import MoleculeModal from "./molecule-modal";
import ColLeg from "./color-legend";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface MoleculeTableProps {
  results: PredictionResult[];
}

/**
 * Get solubility CSS class based on LogS value
 * Ranges:
 * - 0.5 to 1.0+  : Excellent
 * - -1.0 to 0.5  : Good
 * - -3.0 to -1.0 : Moderate
 * - -5.0 to -3.0 : Poorly Soluble
 * - -6.0 to -5.0 : Practically Insoluble
 */
function getSolubilityClass(logs: number): string {
  if (logs >= 0.5) return "solubility-excellent";
  if (logs >= -1.0) return "solubility-good";
  if (logs >= -3.0) return "solubility-moderate";
  if (logs >= -5.0) return "solubility-poor";
  return "solubility-insoluble";
}

/**
 * Get accuracy CSS class based on absolute error
 * Ranges:
 * - < 0.5    : Excellent accuracy
 * - 0.5-1.0  : Good accuracy
 * - > 1.0    : Poor accuracy
 */
function getAccuracyClass(error: number): string {
  if (error < 0.5) return "accuracy-excellent";
  if (error < 1.0) return "accuracy-good";
  return "accuracy-poor";
}

export default function MoleculeTable({ results }: MoleculeTableProps) {
  const gridRef = useRef<AgGridReact>(null);

  const [columns, setColumns] = useState<
    { id: string; name: string; visible: boolean }[]
  >([
    { id: "compound_name", name: "Compound Name", visible: false },
    { id: "solute_smiles", name: "Solute SMILES", visible: true },
    { id: "structure", name: "Solute Structure", visible: true },
    { id: "solvent_name", name: "Solvent Name", visible: true },
    { id: "solvent_smiles", name: "Solvent SMILES", visible: false },
    { id: "temperature_k", name: "Temperature (K)", visible: true },
    { id: "predicted_logs", name: "Predicted LogS", visible: true },
    { id: "actual_logs", name: "Actual LogS", visible: false },
    { id: "abs_error", name: "Absolute Error", visible: false },
    { id: "cas", name: "CAS Number", visible: false },
    { id: "pubchem_cid", name: "PubChem CID", visible: false },
    { id: "fda_approved", name: "FDA Approved", visible: false },
    { id: "source", name: "Source", visible: false },
  ]);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      floatingFilter: true,
      flex: 1,
      minWidth: 100,
      headerClass: "font-semibold text-foreground",
    }),
    [],
  );

  // Structure Cell Renderer
  const StructureCellRenderer = useMemo(() => {
    return (props: any) => {
      const [isModalOpen, setIsModalOpen] = useState(false);

      if (!props.value) {
        return <span className="text-xs text-muted-foreground">No image</span>;
      }

      const name =
        props.data?.compound_name ||
        props.data?.solute_smiles?.substring(0, 30) + "..." ||
        "Molecule";

      return (
        <>
          <div
            className="structure-cell-container"
            onClick={() => setIsModalOpen(true)}
          >
            <img
              src={`data:image/png;base64,${props.value}`}
              alt={`${name} structure`}
              className="structure-cell-image"
            />
          </div>
          {isModalOpen && (
            <MoleculeModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              name={name}
              structure={props.value}
            />
          )}
        </>
      );
    };
  }, []);

  const columnDefs = useMemo<ColDef<PredictionResult>[]>(
    () => [
      {
        field: "compound_name",
        headerName: "Compound Name",
        colId: "compound_name",
        minWidth: 150,
        filter: "agTextColumnFilter",
        valueFormatter: (params) => params.value || "-",
        hide: !columns.find((c) => c.id === "compound_name")?.visible,
      },
      {
        field: "solute_smiles",
        headerName: "Solute SMILES",
        colId: "solute_smiles",
        minWidth: 200,
        filter: "agTextColumnFilter",
        hide: !columns.find((c) => c.id === "solute_smiles")?.visible,
      },
      {
        field: "structure_base64",
        headerName: "Solute Structure",
        colId: "structure",
        width: 150,
        cellRenderer: StructureCellRenderer,
        autoHeight: true,
        sortable: false,
        filter: false,
        floatingFilter: false,
        hide: !columns.find((c) => c.id === "structure")?.visible,
      },
      {
        field: "solvent_name",
        headerName: "Solvent Name",
        colId: "solvent_name",
        minWidth: 140,
        filter: "agTextColumnFilter",
        valueFormatter: (params) =>
          params.value || params.data?.solvent_smiles || "-",
        hide: !columns.find((c) => c.id === "solvent_name")?.visible,
      },
      {
        field: "solvent_smiles",
        headerName: "Solvent SMILES",
        colId: "solvent_smiles",
        minWidth: 180,
        filter: "agTextColumnFilter",
        hide: !columns.find((c) => c.id === "solvent_smiles")?.visible,
      },
      {
        field: "temperature_k",
        headerName: "Temperature (K)",
        colId: "temperature_k",
        width: 150,
        filter: "agNumberColumnFilter",
        valueFormatter: (params) => params.value?.toFixed(2) || "-",
        hide: !columns.find((c) => c.id === "temperature_k")?.visible,
      },
      {
        field: "predicted_logs",
        headerName: "Predicted LogS",
        colId: "predicted_logs",
        width: 160,
        filter: "agNumberColumnFilter",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(3) : "-",
        cellClass: (params) => {
          const value = params.value;
          if (value === undefined || value === null) return "";
          return getSolubilityClass(value);
        },
        hide: !columns.find((c) => c.id === "predicted_logs")?.visible,
      },
      {
        field: "actual_logs",
        headerName: "Actual LogS",
        colId: "actual_logs",
        width: 150,
        filter: "agNumberColumnFilter",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(3) : "N/A",
        cellClass: (params) => {
          const value = params.value;
          if (value === undefined || value === null) return "actual-logs-na";
          return "actual-logs-cell";
        },
        hide: !columns.find((c) => c.id === "actual_logs")?.visible,
      },
      {
        headerName: "Abs Error",
        colId: "abs_error",
        width: 130,
        filter: "agNumberColumnFilter",
        valueGetter: (params) => {
          if (
            params.data?.actual_logs != null &&
            params.data?.predicted_logs != null
          ) {
            return Math.abs(
              params.data.predicted_logs - params.data.actual_logs,
            );
          }
          return null;
        },
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(3) : "N/A",
        cellClass: (params) => {
          const value = params.value;
          if (value === undefined || value === null) return "error-na";
          return getAccuracyClass(value);
        },
        hide: !columns.find((c) => c.id === "abs_error")?.visible,
      },
      {
        field: "cas",
        headerName: "CAS Number",
        colId: "cas",
        width: 140,
        filter: "agTextColumnFilter",
        valueFormatter: (params) => params.value || "-",
        hide: !columns.find((c) => c.id === "cas")?.visible,
      },
      {
        field: "pubchem_cid",
        headerName: "PubChem CID",
        colId: "pubchem_cid",
        width: 150,
        filter: "agTextColumnFilter",
        valueFormatter: (params) => params.value || "-",
        hide: !columns.find((c) => c.id === "pubchem_cid")?.visible,
      },
      {
        field: "fda_approved",
        headerName: "FDA Approved",
        colId: "fda_approved",
        width: 150,
        filter: "agTextColumnFilter",
        valueFormatter: (params) => params.value || "-",
        cellClass: (params) => {
          if (params.value === "Yes") return "fda-approved";
          return "";
        },
        hide: !columns.find((c) => c.id === "fda_approved")?.visible,
      },
      {
        field: "source",
        headerName: "Source",
        colId: "source",
        minWidth: 200,
        filter: "agTextColumnFilter",
        wrapText: true,
        autoHeight: true,
        valueFormatter: (params) => params.value || "-",
        cellClass: "source-cell",
        hide: !columns.find((c) => c.id === "source")?.visible,
      },
    ],
    [columns, StructureCellRenderer],
  );

  const onBtnClearFilters = useCallback(() => {
    gridRef.current!.api.setFilterModel(null);
  }, []);

  const toggleColumn = useCallback((colId: string, visible: boolean) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === colId ? { ...col, visible } : col)),
    );
  }, []);

  return (
    <div className="w-full space-y-4 flex flex-col h-full p-4">
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Results</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {results.length} {results.length === 1 ? "solute" : "solutes"}{" "}
              analyzed
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <ColLeg />

          <Button variant="outline" size="sm" onClick={onBtnClearFilters}>
            <FilterX className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.visible}
                  onCheckedChange={(visible) => toggleColumn(col.id, !!visible)}
                  onSelect={(e) => e.preventDefault()}
                  className="focus:bg-gray-100 focus:text-gray-900"
                >
                  {col.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ExcelExport results={results} columns={columns} taskType="solpred" />
        </div>
      </div>

      <div className="ag-theme-alpine w-full flex-1">
        <AgGridReact
          ref={gridRef}
          theme="legacy"
          rowData={results}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          domLayout="normal"
          headerHeight={48}
          rowHeight={100}
          suppressRowHoverHighlight={false}
          rowClass="cursor-pointer"
          pagination={true}
          paginationPageSize={20}
          paginationPageSizeSelector={[10, 20, 50, 100]}
          suppressDragLeaveHidesColumns={true}
        />
      </div>
    </div>
  );
}
