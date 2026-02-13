import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SingleSmilesInput from "./single-smiles-input";
import BatchSmilesInput from "./batch-smiles-input";
import { PredictionResult, AnalysisResponse } from "@/lib/types";

interface InputTabsProps {
  task: "solpred" | "solscreen";
  onProcess: (
    data: PredictionResult[] | AnalysisResponse,
    taskType: "solpred" | "solscreen",
  ) => void;
  onClearResults: () => void;
  isProcessing: boolean;
  onProcessingStateChange: (processing: boolean) => void;
  clearTrigger: number;
}

export default function InputTabs({
  task,
  onProcess,
  onClearResults,
  isProcessing,
  onProcessingStateChange,
  clearTrigger,
}: InputTabsProps) {
  return (
    <Tabs defaultValue="single" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="single">Single</TabsTrigger>
        <TabsTrigger value="batch">Multiple</TabsTrigger>
      </TabsList>

      <TabsContent value="single" className="mt-4">
        <SingleSmilesInput
          task={task}
          onProcess={onProcess}
          isProcessing={isProcessing}
          onProcessingStateChange={onProcessingStateChange}
        />
      </TabsContent>

      <TabsContent value="batch" className="mt-4">
        <BatchSmilesInput
          task={task}
          onProcess={onProcess}
          isProcessing={isProcessing}
          onProcessingStateChange={onProcessingStateChange}
          clearTrigger={clearTrigger}
        />
      </TabsContent>
    </Tabs>
  );
}
