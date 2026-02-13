import type { PredictionResult } from "./types";

// Color functions
export function getLogSColor(value: number): { bg: string; text: string } {
  if (value >= 0.5)
    return {
      bg: "hsl(var(--solubility-excellent))",
      text: "hsl(var(--solubility-excellent-foreground))",
    };
  if (value >= -1.0)
    return {
      bg: "hsl(var(--solubility-good))",
      text: "hsl(var(--solubility-good-foreground))",
    };
  if (value >= -3.0)
    return {
      bg: "hsl(var(--solubility-moderate))",
      text: "hsl(var(--solubility-moderate-foreground))",
    };
  if (value >= -5.0)
    return {
      bg: "hsl(var(--solubility-poor))",
      text: "hsl(var(--solubility-poor-foreground))",
    };
  return {
    bg: "hsl(var(--solubility-insoluble))",
    text: "hsl(var(--solubility-insoluble-foreground))",
  };
}

export function getSolubilityClassification(logS: number): string {
  if (logS >= 0.5) return "Excellent";
  if (logS >= -1.0) return "Good";
  if (logS >= -3.0) return "Moderate";
  if (logS >= -5.0) return "Poorly Soluble";
  return "Practically Insoluble";
}

export function getErrorColor(error: number): { bg: string; text: string } {
  if (error < 0.5)
    return {
      bg: "hsl(var(--accuracy-excellent))",
      text: "hsl(var(--accuracy-excellent-foreground))",
    };
  if (error < 1.0)
    return {
      bg: "hsl(var(--accuracy-good))",
      text: "hsl(var(--accuracy-good-foreground))",
    };
  return {
    bg: "hsl(var(--accuracy-poor))",
    text: "hsl(var(--accuracy-poor-foreground))",
  };
}
