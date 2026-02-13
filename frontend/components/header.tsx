import { FlaskConical } from "lucide-react";

export default function Header() {
  return (
    <header className="w-full bg-card border-b border-border px-8 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Logo on the left with Back to Home link */}
        <div className="flex-shrink-0">
          <a
            href="/"
            rel="noopener noreferrer"
            className="block group"
            title="Back to Aganitha Home"
          >
            <img
              src="/aganitha-logo.png"
              alt="Aganitha"
              className="h-10 w-auto transition-opacity hover:opacity-80"
            />
          </a>
        </div>

        {/* Title centered */}
        <div className="flex items-center gap-3">
          <FlaskConical className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              SolviScope: Solubility Profiling & Solvent Screening
            </h1>
            <p className="text-sm text-gray-500">
              Explore temperature-dependent solubility landscapes for rational
              solvent selection
            </p>
          </div>
        </div>

        {/* Empty div for flex balance */}
        <div className="flex-shrink-0 w-[120px]"></div>
      </div>
    </header>
  );
}
