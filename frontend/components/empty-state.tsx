import { FlaskConical } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <FlaskConical className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No results yet</h3>
      <p className="text-sm text-gray-500 max-w-sm">
        Enter solute and solvent information to get started with solubility
        predictions
      </p>
    </div>
  );
}
