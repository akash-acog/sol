"use client"

import { useEffect, useRef } from "react"

interface MoleculeImageProps {
  smiles: string
  width?: number
  height?: number
}

export default function MoleculeImage({ 
  smiles, 
  width = 200, 
  height = 200 
}: MoleculeImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Placeholder for molecule rendering
    // You can integrate RDKit or smiles-drawer here if needed
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.fillStyle = "#f3f4f6"
        ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = "#6b7280"
        ctx.font = "12px monospace"
        ctx.textAlign = "center"
        ctx.fillText("Structure", width / 2, height / 2 - 10)
        ctx.fillText("Preview", width / 2, height / 2 + 10)
      }
    }
  }, [smiles, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded border border-gray-200"
    />
  )
}
