"use client";

import { BarChart3, Table } from "lucide-react";
import ColLeg from "./color-legend";

interface ViewToggleSolventProps {
  view: "heatmap" | "table";
  onViewChange: (view: "heatmap" | "table") => void;
}

export default function ViewToggleSolvent({
  view,
  onViewChange,
}: ViewToggleSolventProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background p-1 shadow-sm">
      <div className="mr-4">
        <ColLeg />
      </div>
      <button
        onClick={() => onViewChange("heatmap")}
        className={`
          inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all
          ${
            view === "heatmap"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        `}
        aria-label="Heatmap view"
      >
        <BarChart3 className="h-4 w-4" />
        <span>Heatmap</span>
      </button>
      <button
        onClick={() => onViewChange("table")}
        className={`
          inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all
          ${
            view === "table"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        `}
        aria-label="Table view"
      >
        <Table className="h-4 w-4" />
        <span>Table</span>
      </button>
    </div>
  );
}
