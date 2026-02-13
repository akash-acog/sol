import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@radix-ui/react-label";
import { Info } from "lucide-react";

const ColLeg = () => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center"
            onClick={(e) => e.preventDefault()}
          >
            <Label className="p-2">Color legend</Label>
            <Info className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="max-w-md p-4 bg-background border-border shadow-lg text-black"
        >
          <div className="space-y-4">
            {/* Predicted LogS Legend */}
            <div>
              <h4 className="text-xs font-semibold mb-2">
                Predicted LogS (Solubility Scale)
              </h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-6 rounded border border-border flex items-center justify-center text-xs font-semibold legend-solubility-excellent">
                    0.5 to 1.0+
                  </div>
                  <span className="text-xs">Excellent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-6 rounded border border-border flex items-center justify-center text-xs font-semibold legend-solubility-good">
                    -1.0 to 0.5
                  </div>
                  <span className="text-xs">Good</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-6 rounded border border-border flex items-center justify-center text-xs font-medium legend-solubility-moderate">
                    -3.0 to -1.0
                  </div>
                  <span className="text-xs">Moderate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-6 rounded border border-border flex items-center justify-center text-xs font-medium legend-solubility-poor">
                    -5.0 to -3.0
                  </div>
                  <span className="text-xs">Poorly soluble</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-6 rounded border border-border flex items-center justify-center text-xs legend-solubility-insoluble">
                    &lt; -5.0
                  </div>
                  <span className="text-xs">Practically insoluble</span>
                </div>
              </div>
            </div>

            {/* Absolute Error Legend */}
            <div>
              <h4 className="text-xs font-semibold mb-2">
                Absolute Error (Prediction Accuracy)
              </h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-6 rounded border border-border flex items-center justify-center text-xs font-semibold legend-accuracy-excellent">
                    &lt; 0.5
                  </div>
                  <span className="text-xs">Excellent accuracy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-6 rounded border border-border flex items-center justify-center text-xs font-medium legend-accuracy-good">
                    0.5 to 1.0
                  </div>
                  <span className="text-xs">Good accuracy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-6 rounded border border-border flex items-center justify-center text-xs legend-accuracy-poor">
                    &gt; 1.0
                  </div>
                  <span className="text-xs">Poor accuracy</span>
                </div>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ColLeg;
