import { Table, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ViewToggleProps {
  viewMode: "table" | "grid"
  onViewModeChange: (mode: "table" | "grid") => void
}

export default function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <Button
        variant={viewMode === "table" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("table")}
        className={`gap-2 ${viewMode === "table" ? "" : "hover:bg-gray-200"}`}
      >
        <Table className="w-4 h-4" />
        Table
      </Button>
      <Button
        variant={viewMode === "grid" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("grid")}
        className={`gap-2 ${viewMode === "grid" ? "" : "hover:bg-gray-200"}`}
      >
        <LayoutGrid className="w-4 h-4" />
        Cards
      </Button>
    </div>
  )
}
