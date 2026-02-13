"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { PredictionResult } from "@/lib/types"
import { getCMCStatus } from "@/lib/constants"
import MoleculeModal from "./molecule-modal"

interface MoleculeCardProps {
  result: PredictionResult
  index: number
}

export default function MoleculeCard({ result, index }: MoleculeCardProps) {
  const [showModal, setShowModal] = useState(false)
  const status = getCMCStatus(result.predicted_logs)

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {result.compound_name || `Compound ${index + 1}`}
              </h3>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {result.solute_smiles}
              </p>
            </div>
            <Badge className={`${status.color} text-white shrink-0`}>
              {status.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Prediction Values */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Log S:</span>
              <span className={`font-semibold ${status.textColor}`}>
                {result.predicted_logs.toFixed(3)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Solvent:</span>
              <span className="text-sm text-gray-900 truncate max-w-[150px]">
                {result.solvent_name || result.solvent_smiles}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Temperature:</span>
              <span className="text-sm text-gray-900">
                {result.temperature_k.toFixed(1)} K
              </span>
            </div>
          </div>

          {/* View Details Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowModal(true)}
          >
            <Eye className="w-4 h-4 mr-2" />
            View Details
          </Button>
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <MoleculeModal
          result={result}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
