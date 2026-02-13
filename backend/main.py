"""
FastAPI Backend for Solubility Prediction Model

Endpoints:
- POST /predict: Batch prediction for solute-solvent pairs
- POST /solvents: Solvent ranking and heatmap generation for a given solute
- GET /health: Health check
"""

import sys
from pathlib import Path

# Utilities (featurization, mpnn) are now local to the backend directory
sys.path.insert(0, str(Path(__file__).parent))

import torch
import numpy as np
from typing import List, Optional, Dict, Any, Tuple
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator
from torch_geometric.data import Batch
from rdkit import Chem

from featurization import MolecularGraphFeaturizer
from mpnn import SolubilityModel, get_model_params

# ============================================================================
# Configuration
# ============================================================================

CHECKPOINT_PATH = Path(__file__).parent / "experiments/solubility_20251203_140814/checkpoint_best.pt"
TARGET_MEAN = -0.9832843100207638
TARGET_STD = 1.2159083883491026
TEMP_MIN = 243.15  # K
TEMP_MAX = 425.77  # K

# Predefined solvents for ranking/heatmap (top 20 by training frequency)
SOLVENT_REGISTRY = {
    "n-hexane (ε = 1.88)": "CCCCCC",
    "1,4-dioxane (ε = 2.25)": "C1COCCO1",
    "toluene (ε = 2.38)": "Cc1ccccc1",
    "n-butyl acetate (ε = 5.01)": "CCCCOC(=O)C",
    "ethyl acetate (ε = 6.02)": "CCOC(=O)C",
    "methyl acetate (ε = 6.68)": "COC(=O)C",
    "THF (ε = 7.58)": "C1CCOC1",
    "n-pentanol (ε = 13.9)": "CCCCCO",
    "sec-butanol (ε = 16.3)": "CCC(C)O",
    "n-butanol (ε = 17.5)": "CCCCO",
    "isobutanol (ε = 17.9)": "CC(C)CO",
    "isopropanol (ε = 17.9)": "CC(C)O",
    "2-butanone (ε = 18.5)": "CCC(=O)C",
    "n-propanol (ε = 20.1)": "CCCO",
    "acetone (ε = 20.7)": "CC(=O)C",
    "ethanol (ε = 24.5)": "CCO",
    "methanol (ε = 32.7)": "CO",
    "DMF (ε = 36.7)": "CN(C)C=O",
    "acetonitrile (ε = 37.5)": "CC#N",
    "water (ε = 78.4)": "O",
}

# ============================================================================
# Pydantic Models
# ============================================================================

class PredictionRequest(BaseModel):
    """Single prediction request"""
    solute_smiles: str = Field(..., description="SMILES string of the solute")
    solvent_smiles: str = Field(..., description="SMILES string of the solvent")
    temperature_k: float = Field(..., description="Temperature in Kelvin", ge=0)
    
    @field_validator('temperature_k')
    @classmethod
    def check_temperature_range(cls, v):
        if v < TEMP_MIN or v > TEMP_MAX:
            # Don't raise error, just flag it
            pass
        return v


class PredictionResponse(BaseModel):
    """Single prediction response"""
    predicted_logs: float
    temperature_k: float
    warning: Optional[str] = None


class AnalysisRequest(BaseModel):
    """Solvent ranking/heatmap request"""
    solute_smiles: str = Field(..., description="SMILES string of the solute")
    solute_name: Optional[str] = Field(None, description="Optional name of the solute for display")


class SolventRanking(BaseModel):
    """Single solvent ranking entry"""
    solvent_name: str
    solvent_smiles: str
    predicted_logs: float
    rank: int


class AnalysisResponse(BaseModel):
    """Solvent ranking and dual heatmap response"""
    solute_smiles: str
    solute_name: Optional[str]
    ranking_temperature_k: float = Field(..., description="Temperature at which rankings were calculated")
    rankings: List[SolventRanking]
    static_heatmap_base64: str = Field(..., description="Base64 PNG static heatmap (Red-to-Green, 5 clinical tiers)")
    dynamic_heatmap_base64: str = Field(..., description="Base64 PNG dynamic heatmap (Blue-White-Red)")
    temperatures: List[int] = Field(..., description="List of temperatures used for the heatmap")
    heatmap_data: List[Dict[str, Any]] = Field(..., description="Raw prediction data formatted for ag-grid")


class StructureRequest(BaseModel):
    """Molecule structure generation request"""
    smiles: str = Field(..., description="SMILES string of the molecule")
    size: int = Field(400, description="Image size (square) in pixels", ge=100, le=1200)


class StructureResponse(BaseModel):
    """Molecule structure generation response"""
    structure_base64: Optional[str] = Field(None, description="Base64-encoded PNG image")
    success: bool
    error: Optional[str] = None


# ============================================================================
# Solubility Predictor (Singleton)
# ============================================================================

class SolubilityPredictor:
    """Singleton class for model inference with graph caching"""
    
    def __init__(self, checkpoint_path: str, device: str = "cuda"):
        self.device = torch.device(device if torch.cuda.is_available() else "cpu")
        print(f"[INFO] Loading model on device: {self.device}")
        
        # Load checkpoint
        checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
        
        # Initialize featurizer (no partial charges based on checkpoint inspection)
        self.featurizer = MolecularGraphFeaturizer(
            use_edge_features=True,
            use_3d_coords=False,
            add_partial_charges=False
        )
        
        # Initialize model
        model_params = get_model_params(add_partial_charges=False)
        self.model = SolubilityModel(**model_params)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model = self.model.to(self.device)
        self.model.eval()
        
        # Normalization constants
        self.target_mean = TARGET_MEAN
        self.target_std = TARGET_STD
        
        # Solvent graph cache
        self.solvent_cache: Dict[str, Any] = {}
        print(f"[INFO] Model loaded successfully")
    
    def _validate_smiles(self, smiles: str) -> bool:
        """Validate SMILES using RDKit"""
        mol = Chem.MolFromSmiles(smiles)
        return mol is not None
    
    def _get_temperature_warning(self, temp_k: float) -> Optional[str]:
        """Check if temperature is outside training domain"""
        if temp_k < TEMP_MIN or temp_k > TEMP_MAX:
            return f"Temperature {temp_k}K is outside training range ({TEMP_MIN}K-{TEMP_MAX}K). Prediction may be less reliable."
        return None
    
    def _get_or_cache_solvent(self, solvent_smiles: str):
        """Get solvent graph from cache or create new"""
        if solvent_smiles not in self.solvent_cache:
            graph = self.featurizer.smiles_to_graph(solvent_smiles)
            if graph is None:
                return None
            self.solvent_cache[solvent_smiles] = graph
        return self.solvent_cache[solvent_smiles]
    
    def predict_batch(self, requests: List[PredictionRequest]) -> List[PredictionResponse]:
        """Batch prediction for multiple solute-solvent pairs"""
        responses = []
        
        # Validate all SMILES first
        for req in requests:
            if not self._validate_smiles(req.solute_smiles):
                raise HTTPException(status_code=400, detail=f"Invalid solute SMILES: {req.solute_smiles}")
            if not self._validate_smiles(req.solvent_smiles):
                raise HTTPException(status_code=400, detail=f"Invalid solvent SMILES: {req.solvent_smiles}")
        
        # Prepare graphs
        solute_graphs = []
        solvent_graphs = []
        temps = []
        valid_indices = []
        
        for i, req in enumerate(requests):
            solute_graph = self.featurizer.smiles_to_graph(req.solute_smiles)
            solvent_graph = self._get_or_cache_solvent(req.solvent_smiles)
            
            if solute_graph is not None and solvent_graph is not None:
                solute_graphs.append(solute_graph)
                solvent_graphs.append(solvent_graph)
                temps.append(req.temperature_k)
                valid_indices.append(i)
        
        if len(solute_graphs) == 0:
            raise HTTPException(status_code=400, detail="No valid molecule pairs to process")
        
        # Batch inference
        solute_batch = Batch.from_data_list(solute_graphs).to(self.device)
        solvent_batch = Batch.from_data_list(solvent_graphs).to(self.device)
        temp_tensor = torch.tensor(temps, dtype=torch.float, device=self.device).unsqueeze(1)
        
        with torch.no_grad():
            pred_norm = self.model(solute_batch, solvent_batch, temp_tensor)
            pred = pred_norm * self.target_std + self.target_mean
        
        predictions = pred.cpu().numpy().flatten().tolist()
        
        # Build responses
        for i, req in enumerate(requests):
            if i in valid_indices:
                idx = valid_indices.index(i)
                warning = self._get_temperature_warning(req.temperature_k)
                responses.append(PredictionResponse(
                    predicted_logs=predictions[idx],
                    temperature_k=req.temperature_k,
                    warning=warning
                ))
            else:
                responses.append(PredictionResponse(
                    predicted_logs=0.0,
                    temperature_k=req.temperature_k,
                    warning="Failed to process molecule"
                ))
        
        return responses
    
    def generate_heatmap(self, solute_smiles: str, solute_name: Optional[str],
                        solvent_names: List[str], 
                        solvent_predictions: Dict[str, List[float]], 
                        temp_range: List[float],
                        title_heading: str,
                        cmap_type: str = "dynamic",
                        vmin: Optional[float] = None,
                        vmax: Optional[float] = None) -> str:
        """Generate base64-encoded heatmap of solubility predictions"""
        import matplotlib
        matplotlib.use('Agg')  # Non-interactive backend
        import matplotlib.pyplot as plt
        import seaborn as sns
        import base64
        from io import BytesIO
        from matplotlib.colors import ListedColormap, BoundaryNorm
        
        # Prepare data matrix (solvents x temperatures)
        data_matrix = np.array([solvent_predictions[name] for name in solvent_names])
        
        # Create figure
        fig, ax = plt.subplots(figsize=(12, 8))
        
        # Custom Colormap and Normalization
        if cmap_type == "static":
            # Clinical View: Discrete 5-color tiers as requested
            # -6.0 to -5.0 : Practically Insoluble (Dark Red)
            # -5.0 to -3.0 : Poorly Soluble (Orange)
            # -3.0 to -1.0 : Moderate (Yellow)
            # -1.0 to 0.5 : Good (Light Green)
            # 0.5 to 1.0+ : Excellent (Dark Green)
            
            boundaries = [-6.0, -5.0, -3.0, -1.0, 0.5, 1.0]
            colors = ['#8B0000', '#FF8C00', '#FFD700', '#90EE90', '#006400']
            custom_cmap = ListedColormap(colors)
            norm = BoundaryNorm(boundaries, custom_cmap.N)
            
            sns.heatmap(
                data_matrix,
                xticklabels=[int(t) for t in temp_range],
                yticklabels=solvent_names,
                cmap=custom_cmap,
                norm=norm,
                annot=False,
                fmt=".2f",
                cbar_kws={
                    'label': 'Predicted LogS (mol/L)',
                    'ticks': boundaries
                },
                linewidths=0.5,
                linecolor='black',
                ax=ax
            )
        else:
            # Dynamic View: Blue (low) -> White (center) -> Red (high)
            dyn_vmin = data_matrix.min()
            dyn_vmax = data_matrix.max()
            dyn_center = (dyn_vmin + dyn_vmax) / 2
            
            # Use sns.heatmap for dynamic for consistency with previous "fine" version
            sns.heatmap(
                data_matrix,
                xticklabels=[int(t) for t in temp_range],
                yticklabels=solvent_names,
                cmap="bwr",
                vmin=dyn_vmin,
                vmax=dyn_vmax,
                center=dyn_center,
                annot=False,
                fmt=".2f",
                cbar_kws={'label': 'Predicted LogS (mol/L)'},
                ax=ax
            )
        
        ax.set_xlabel("Temperature (K)", fontsize=12, fontweight='bold')
        ax.set_ylabel("Solvent", fontsize=12, fontweight='bold')
        
        # Use solute_name if provided, otherwise show truncated SMILES
        solute_display = solute_name if solute_name else solute_smiles[:40] + '...'
        title_text = f"{title_heading}\nSolute: {solute_display}"
        ax.set_title(title_text, fontsize=14, fontweight='bold', pad=20)
        
        plt.tight_layout()
        
        # Convert to base64
        buffer = BytesIO()
        plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        plt.close(fig)
        
        return image_base64
    
    def smiles_to_image(self, smiles: str, size: int = 400) -> Tuple[Optional[str], bool, Optional[str]]:
        """Generate high-quality 2D PNG rendering of a molecule"""
        try:
            from rdkit.Chem.Draw import rdMolDraw2D
            from rdkit import Chem
            from rdkit.Chem import AllChem
            import base64
            
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                return None, False, f"Invalid SMILES: {smiles}"
            
            # Compute 2D coordinates for layout
            AllChem.Compute2DCoords(mol)
            
            # High-quality rendering logic
            drawer = rdMolDraw2D.MolDraw2DCairo(size, size)
            opts = drawer.drawOptions()
            opts.bondLineWidth = 2.0
            opts.minFontSize = 28
            opts.maxFontSize = 28
            opts.padding = 0.1
            
            drawer.DrawMolecule(mol)
            drawer.FinishDrawing()
            
            png_data = drawer.GetDrawingText()
            return base64.b64encode(png_data).decode(), True, None
            
        except Exception as e:
            return None, False, str(e)
    
    def analyze_solvents(self, solute_smiles: str, solute_name: Optional[str] = None) -> AnalysisResponse:
        """Rank all predefined solvents for a given solute and generate dual heatmaps"""
        if not self._validate_smiles(solute_smiles):
            raise HTTPException(status_code=400, detail=f"Invalid solute SMILES: {solute_smiles}")
        
        # Define temperature range for heatmap (250K to 450K at 10K intervals)
        temp_range = list(range(250, 451, 10))  # [250, 260, ..., 450]
        
        # Get predictions for all solvents across temperature range
        solvent_predictions = {}
        for solvent_name, solvent_smiles in SOLVENT_REGISTRY.items():
            predictions_at_temps = []
            for temp in temp_range:
                req = PredictionRequest(
                    solute_smiles=solute_smiles,
                    solvent_smiles=solvent_smiles,
                    temperature_k=temp
                )
                pred = self.predict_batch([req])[0]
                predictions_at_temps.append(pred.predicted_logs)
            solvent_predictions[solvent_name] = predictions_at_temps
        
        # 1. Generate Static Heatmap (Clinical Tiers scale, fixed -6 to +1)
        solvent_names = list(SOLVENT_REGISTRY.keys())
        static_heatmap_base64 = self.generate_heatmap(
            solute_smiles=solute_smiles,
            solute_name=solute_name,
            solvent_names=solvent_names,
            solvent_predictions=solvent_predictions,
            temp_range=temp_range,
            title_heading="Predicted solubility in different solvents across temperature",
            cmap_type="static"
        )
        
        # 2. Generate Dynamic Heatmap (bwr colormap, fluid range)
        dynamic_heatmap_base64 = self.generate_heatmap(
            solute_smiles=solute_smiles,
            solute_name=solute_name,
            solvent_names=solvent_names,
            solvent_predictions=solvent_predictions,
            temp_range=temp_range,
            title_heading="Dynamic Heatmap",
            cmap_type="dynamic"
        )
        
        # Get rankings at room temperature (298.15K)
        default_temp = 298.15
        requests = [
            PredictionRequest(
                solute_smiles=solute_smiles,
                solvent_smiles=smiles,
                temperature_k=default_temp
            )
            for smiles in SOLVENT_REGISTRY.values()
        ]
        
        predictions = self.predict_batch(requests)
        
        # Create rankings
        rankings_data = [
            {
                "solvent_name": name,
                "solvent_smiles": SOLVENT_REGISTRY[name],
                "predicted_logs": pred.predicted_logs
            }
            for name, pred in zip(SOLVENT_REGISTRY.keys(), predictions)
        ]
        
        # Sort by predicted_logs (descending)
        rankings_data.sort(key=lambda x: x["predicted_logs"], reverse=True)
        
        # Add ranks
        rankings = [
            SolventRanking(rank=i+1, **data)
            for i, data in enumerate(rankings_data)
        ]
        
        # Prepare raw heatmap data for ag-grid
        # Each row: {"solvent": "Name", "250": value, "260": value, ...}
        heatmap_data = []
        for name, preds in solvent_predictions.items():
            row = {"solvent": name}
            for temp, val in zip(temp_range, preds):
                row[str(temp)] = val
            heatmap_data.append(row)
        
        return AnalysisResponse(
            solute_smiles=solute_smiles,
            solute_name=solute_name,
            ranking_temperature_k=default_temp,
            rankings=rankings,
            static_heatmap_base64=static_heatmap_base64,
            dynamic_heatmap_base64=dynamic_heatmap_base64,
            temperatures=temp_range,
            heatmap_data=heatmap_data
        )


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="Solubility Prediction API",
    description="MPNN-based solubility prediction with solvent ranking",
    version="1.0.0"
)

# Initialize predictor (singleton)
predictor = None

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    global predictor
    predictor = SolubilityPredictor(str(CHECKPOINT_PATH))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ready" if predictor is not None else "loading",
        "model_loaded": predictor is not None,
        "device": str(predictor.device) if predictor else "unknown"
    }


@app.post("/predict", response_model=List[PredictionResponse])
async def predict(requests: List[PredictionRequest]):
    """
    Batch prediction endpoint
    
    Input: List of {solute_smiles, solvent_smiles, temperature_k}
    Output: List of {predicted_logs, temperature_k, warning}
    """
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return predictor.predict_batch(requests)


@app.post("/solvents", response_model=AnalysisResponse)
async def get_solvent_analysis(request: AnalysisRequest):
    """
    Solvent ranking and heatmap generation
    
    Input: {solute_smiles, solute_name (optional)}
    Output: {
        ranking_temperature_k: temperature used for rankings (298.15K),
        rankings: [{solvent_name, predicted_logs, rank}, ...],
        heatmap_base64: PNG image showing predictions across 250K-450K
    }
    """
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return predictor.analyze_solvents(request.solute_smiles, request.solute_name)


@app.post("/generate-structure", response_model=StructureResponse)
async def generate_structure(request: StructureRequest):
    """
    Generate a 2D structure image for a SMILES string
    """
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    image_b64, success, error = predictor.smiles_to_image(request.smiles, request.size)
    return StructureResponse(
        structure_base64=image_b64,
        success=success,
        error=error
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
