"use client";

import { useState } from "react";
import * as ExcelJS from "exceljs";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PredictionResult } from "@/lib/types";

// Image configuration
const IMAGE_CONFIG = {
  width: 180,
  height: 140,
  colWidth: 25,
  rowHeight: 150,
  offset: 0.1,
};

const HEADER_STYLE = {
  font: { bold: true, size: 12, color: { argb: "FF1F2937" } },
  fill: {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFE0E7EF" },
  },
  alignment: {
    horizontal: "center" as const,
    vertical: "middle" as const,
  },
  height: 25,
};

const BORDER_STYLE = {
  top: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
  left: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
  bottom: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
  right: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
};

// Solubility color system - STRICTLY from global CSS
function getSolubilityClass(logs: number): {
  label: string;
  bgColor: string;
  fgColor: string;
} {
  if (logs >= 0.5) {
    return {
      label: "Excellent",
      bgColor: "FF006400", // --solubility-excellent: #006400
      fgColor: "FFFFFFFF", // --solubility-excellent-foreground: #ffffff
    };
  }
  if (logs >= -1.0) {
    return {
      label: "Good",
      bgColor: "FF90EE90", // --solubility-good: #90ee90
      fgColor: "FF166534", // --solubility-good-foreground: #166534
    };
  }
  if (logs >= -3.0) {
    return {
      label: "Moderate",
      bgColor: "FFFFD700", // --solubility-moderate: #ffd700
      fgColor: "FF854D0E", // --solubility-moderate-foreground: #854d0e
    };
  }
  if (logs >= -5.0) {
    return {
      label: "Poorly Soluble",
      bgColor: "FFFF8C00", // --solubility-poor: #ff8c00
      fgColor: "FF9A3412", // --solubility-poor-foreground: #9a3412
    };
  }
  return {
    label: "Practically Insoluble",
    bgColor: "FF8B0000", // --solubility-insoluble: #8b0000
    fgColor: "FFFFFFFF", // --solubility-insoluble-foreground: #ffffff
  };
}

// Accuracy color system - STRICTLY from global CSS
function getAccuracyClass(error: number): {
  bgColor: string;
  fgColor: string;
} {
  if (error < 0.5) {
    return {
      bgColor: "FFC9E7D3", // --accuracy-excellent: hsl(145, 46%, 84%)
      fgColor: "FF166534", // --accuracy-excellent-foreground: hsl(145, 63%, 22%)
    };
  }
  if (error < 1.0) {
    return {
      bgColor: "FFFEF3C7", // --accuracy-good: hsl(49, 100%, 91%)
      fgColor: "FF854D0E", // --accuracy-good-foreground: hsl(43, 95%, 26%)
    };
  }
  return {
    bgColor: "FFFECACA", // --accuracy-poor: hsl(0, 89%, 91%)
    fgColor: "FF991B1B", // --accuracy-poor-foreground: hsl(0, 65%, 27%)
  };
}

interface Column {
  id: string;
  name: string;
  visible: boolean;
}

interface ExcelExportProps {
  // For Solubility Prediction
  results?: PredictionResult[];
  columns?: Column[];

  // For Solvent Screening
  solventData?: any[];
  solventColumns?: { field: string; headerName: string }[];
  temperatures?: number[];
  tableMode?: "single" | "multi";

  // Common
  fileName?: string;
  taskType: "solpred" | "solscreen";
}

export default function ExcelExport({
  results,
  columns,
  solventData,
  solventColumns,
  temperatures,
  tableMode = "single",
  fileName,
  taskType,
}: ExcelExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToExcel = async () => {
    setIsExporting(true);

    try {
      const workbook = new ExcelJS.Workbook();

      if (taskType === "solpred") {
        await exportSolubilityPredictions(
          workbook,
          results || [],
          columns || [],
        );
      } else {
        await exportSolventScreening(
          workbook,
          solventData || [],
          solventColumns || [],
          temperatures || [],
          tableMode,
        );
      }

      // Download
      const defaultFileName =
        taskType === "solpred"
          ? `solubility_predictions_${new Date().getTime()}.xlsx`
          : `solvent_screening_${new Date().getTime()}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || defaultFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("✅ Excel export completed");
    } catch (error) {
      console.error("❌ Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportToExcel}
      disabled={isExporting || (!results?.length && !solventData?.length)}
    >
      <Download className="mr-2 h-4 w-4" />
      {isExporting ? "Exporting..." : "Export to Excel"}
    </Button>
  );
}

// Export Solubility Predictions
async function exportSolubilityPredictions(
  workbook: ExcelJS.Workbook,
  results: PredictionResult[],
  columns: Column[],
) {
  const worksheet = workbook.addWorksheet("Solubility Predictions");
  const visibleColumns = columns.filter((col) => col.visible);

  // Map column IDs to export configuration
  const columnConfig = visibleColumns.map((col) => {
    const isImage = col.id === "structure" || col.id === "structure_base64";
    return {
      id: col.id,
      name: col.name,
      isImage,
      width: isImage ? IMAGE_CONFIG.colWidth : undefined,
    };
  });

  const imageColIndices = columnConfig
    .map((col, idx) => (col.isImage ? idx : -1))
    .filter((i) => i !== -1);

  // Add header row
  const headerRow = worksheet.addRow(columnConfig.map((col) => col.name));
  headerRow.font = HEADER_STYLE.font;
  headerRow.fill = HEADER_STYLE.fill;
  headerRow.alignment = HEADER_STYLE.alignment;
  headerRow.height = HEADER_STYLE.height;
  headerRow.eachCell((cell) => {
    cell.border = BORDER_STYLE;
  });

  // Add data rows
  results.forEach((rowData, rowIndex) => {
    const solClass = getSolubilityClass(rowData.predicted_logs);
    const absError =
      rowData.actual_logs != null && rowData.predicted_logs != null
        ? Math.abs(rowData.predicted_logs - rowData.actual_logs)
        : null;
    const errorClass = absError != null ? getAccuracyClass(absError) : null;

    const excelRow = worksheet.addRow(
      columnConfig.map((col, colIdx) => {
        if (imageColIndices.includes(colIdx)) return "";

        switch (col.id) {
          case "compound_name":
            return (
              rowData.compound_name ||
              rowData.solute_smiles?.substring(0, 20) + "..."
            );
          case "solute_smiles":
            return rowData.solute_smiles;
          case "solvent_name":
            return rowData.solvent_name || rowData.solvent_smiles || "-";
          case "solvent_smiles":
            return rowData.solvent_smiles;
          case "temperature_k":
            return rowData.temperature_k?.toFixed(2) || "-";
          case "predicted_logs":
            return rowData.predicted_logs?.toFixed(3) || "-";
          case "actual_logs":
            return rowData.actual_logs != null
              ? rowData.actual_logs.toFixed(3)
              : "N/A";
          case "abs_error":
            return absError != null ? absError.toFixed(3) : "N/A";
          case "cas":
            return rowData.cas || "-";
          case "pubchem_cid":
            return rowData.pubchem_cid || "-";
          case "fda_approved":
            return rowData.fda_approved || "-";
          case "source":
            return rowData.source || "-";
          default:
            return rowData[col.id as keyof PredictionResult] ?? "";
        }
      }),
    );

    excelRow.height = imageColIndices.length > 0 ? IMAGE_CONFIG.rowHeight : 20;
    excelRow.eachCell((cell, colNum) => {
      cell.border = BORDER_STYLE;
      if (!imageColIndices.includes(colNum - 1)) {
        cell.alignment = {
          horizontal: "center" as const,
          vertical: "middle" as const,
          wrapText: true,
        };
      }

      const colId = columnConfig[colNum - 1]?.id;

      // Apply predicted_logs colors
      if (colId === "predicted_logs") {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: solClass.bgColor },
        };
        cell.font = { bold: true, color: { argb: solClass.fgColor } };
      }

      // Apply actual_logs styling
      if (colId === "actual_logs") {
        if (rowData.actual_logs != null) {
          cell.font = { italic: true, color: { argb: "FF6B7280" } };
        } else {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
          cell.font = { italic: true, color: { argb: "FF6B7280" } };
        }
      }

      // Apply abs_error colors
      if (colId === "abs_error" && errorClass) {
        if (absError != null) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: errorClass.bgColor },
          };
          cell.font = { bold: true, color: { argb: errorClass.fgColor } };
        } else {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
          cell.font = { italic: true, color: { argb: "FF6B7280" } };
        }
      }

      // FDA approved highlighting - using accuracy-excellent colors
      if (colId === "fda_approved" && cell.value === "Yes") {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFC9E7D3" }, // --accuracy-excellent
        };
        cell.font = { bold: true, color: { argb: "FF166534" } };
      }

      // Source cell styling
      if (colId === "source") {
        cell.font = { size: 11, color: { argb: "FF6B7280" } };
      }
    });

    // Add structure images
    imageColIndices.forEach((colIdx) => {
      const base64Data = rowData.structure_base64;

      if (
        base64Data &&
        (base64Data.startsWith("data:image") ||
          base64Data.startsWith("iVBOR") ||
          base64Data.length > 100)
      ) {
        try {
          const processedBase64 = base64Data.startsWith("data:image")
            ? base64Data.split(",")[1] || base64Data
            : base64Data;

          const match = base64Data.match?.(/data:image\/(\w+);/) || [];
          const ext = (match[1] === "jpg" ? "jpeg" : match[1]) || "png";
          const extension = (
            ["png", "jpeg", "gif"].includes(ext) ? ext : "png"
          ) as "png" | "jpeg" | "gif";

          const imageId = workbook.addImage({
            base64: processedBase64,
            extension,
          });
          worksheet.getColumn(colIdx + 1).width = IMAGE_CONFIG.colWidth;

          worksheet.addImage(imageId, {
            tl: {
              col: colIdx + IMAGE_CONFIG.offset,
              row: rowIndex + 1 + IMAGE_CONFIG.offset,
            },
            ext: { width: IMAGE_CONFIG.width, height: IMAGE_CONFIG.height },
          });
        } catch (err) {
          console.error(
            `Image error at Row ${rowIndex + 2}, Col ${colIdx}:`,
            err,
          );
        }
      }
    });
  });

  // Auto-size non-image columns
  columnConfig.forEach((col, idx) => {
    if (!imageColIndices.includes(idx)) {
      const maxLen = Math.max(
        col.name.length,
        ...results.map(
          (r) => String(r[col.id as keyof PredictionResult] || "").length,
        ),
      );
      worksheet.getColumn(idx + 1).width = Math.min(maxLen + 3, 50);
    }
  });

  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
}

// Export Solvent Screening
// Export Solvent Screening
async function exportSolventScreening(
  workbook: ExcelJS.Workbook,
  solventData: any[],
  solventColumns: { field: string; headerName: string }[],
  temperatures: number[],
  tableMode: "single" | "multi",
) {
  const sheetName =
    tableMode === "single" ? "Solvent Rankings" : "Multi-Temperature Rankings";
  const worksheet = workbook.addWorksheet(sheetName);

  // Add header row
  const headerRow = worksheet.addRow(
    solventColumns.map((col) => col.headerName),
  );
  headerRow.font = HEADER_STYLE.font;
  headerRow.fill = HEADER_STYLE.fill;
  headerRow.alignment = HEADER_STYLE.alignment;
  headerRow.height = HEADER_STYLE.height;
  headerRow.eachCell((cell) => {
    cell.border = BORDER_STYLE;
  });

  // Add data rows
  solventData.forEach((rowData, rowIndex) => {
    const excelRow = worksheet.addRow(
      solventColumns.map((col) => {
        const value = rowData[col.field];

        // Format temperature columns (numeric values)
        if (!isNaN(Number(col.field)) || col.field === "predicted_logs") {
          return value != null ? Number(value).toFixed(2) : "N/A";
        }

        return value ?? "";
      }),
    );

    excelRow.height = 20;
    excelRow.eachCell((cell, colNum) => {
      cell.border = BORDER_STYLE;
      cell.alignment = {
        horizontal: "center" as const,
        vertical: "middle" as const,
        wrapText: true,
      };

      // Color code predicted LogS values using 5-scale system
      const colField = solventColumns[colNum - 1]?.field;
      const isLogsCol =
        colField === "predicted_logs" || !isNaN(Number(colField));

      if (
        isLogsCol &&
        cell.value !== null &&
        cell.value !== undefined &&
        cell.value !== "N/A"
      ) {
        const numValue =
          typeof cell.value === "number"
            ? cell.value
            : parseFloat(cell.value as string);

        if (!isNaN(numValue)) {
          // Use the same 5-scale color system as solpred
          const solClass = getSolubilityClass(numValue);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: solClass.bgColor },
          };
          cell.font = { bold: true, color: { argb: solClass.fgColor } };
        }
      }

      // Special styling for SMILES columns
      if (colField === "solvent_smiles") {
        cell.font = { name: "Courier New", size: 10 };
        cell.alignment = {
          horizontal: "left" as const,
          vertical: "middle" as const,
          wrapText: false,
        };
      }

      // Special styling for solvent name
      if (colField === "solvent_name" || colField === "solvent_display") {
        cell.alignment = {
          horizontal: "left" as const,
          vertical: "middle" as const,
        };
      }
    });
  });

  // Auto-size columns
  solventColumns.forEach((col, idx) => {
    const maxLen = Math.max(
      col.headerName.length,
      ...solventData.map((r) => String(r[col.field] || "").length),
    );
    worksheet.getColumn(idx + 1).width = Math.min(maxLen + 3, 50);
  });

  // Set specific widths for known columns
  solventColumns.forEach((col, idx) => {
    if (col.field === "solvent_smiles") {
      worksheet.getColumn(idx + 1).width = 50; // Wider for SMILES
    } else if (
      col.field === "solvent_name" ||
      col.field === "solvent_display"
    ) {
      worksheet.getColumn(idx + 1).width = 25;
    } else if (!isNaN(Number(col.field)) || col.field === "predicted_logs") {
      worksheet.getColumn(idx + 1).width = 15; // Temperature/LogS columns
    }
  });

  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
}
