# Solubility Prediction API

This repository contains a production-ready FastAPI service for predicting molecular solubility (LogS) across different solvents and temperatures using a trained MPNN (Message Passing Neural Network) model.

## 🚀 Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Installation & Deployment
1. **Clone the repository and switch to the `app` branch:**
   ```bash
   git clone git@github.com:aganitha/ADMET-model-library.git
   cd ADMET-model-library
   git checkout app
   ```

2. **Start the service:**
   ```bash
   docker compose up -d --build
   ```
   

## 📁 Repository Structure
```text
.
├── backend/
│   ├── main.py            # FastAPI application logic
│   ├── mpnn.py            # Model architecture (SolubilityModel)
│   ├── featurization.py   # RDKit-based molecular featurization
│   ├── requirements.txt   # Python dependencies
│   ├── Dockerfile         # Production container definition
│   └── experiments/       # Production model checkpoints
└── docker-compose.yml     # Orchestration for the service
```

## 🛠 API Endpoints

### 1. Health Check
`GET /health`
- Verifies if the model is loaded and ready.

### 2. Solubility Prediction
`POST /predict`
- Predicts LogS for one or more solute-solvent pairs at a specific temperature.
- **Payload:**
  ```json
  [
    {
      "solute_smiles": "CCO",
      "solvent_smiles": "O",
      "temperature_k": 298.15
    }
  ]
  ```

### 3. Solvent Analysis
`POST /solvents`
- Ranks 20 common solvents and generates two heatmaps for a given solute.
- **Payload:**
  ```json
  {
    "solute_smiles": "CCO",
    "solute_name": "Ethanol"
  }
  ```

## 🛡 Security & Design
- **Isolated Environment**: Runs in a non-root Docker container.
- **No Manual Setup**: All dependencies (RDKit, PyTorch, etc.) are handled automatically by Docker. No local `venv` required.
- **Visuals**: Automatically generates high-fidelity Base64 heatmaps for chemical analysis.

