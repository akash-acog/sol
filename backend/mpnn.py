import math
import torch
from torch import nn
from torch_geometric.nn import MessagePassing, Set2Set
from torch_geometric.utils import to_dense_batch


# =========================
# Edge network (saner size)
# =========================
class EdgeNetwork(nn.Module):
    """
    Turns edge_attr (E, edge_dim) into per-edge weight matrices (E, H, H).
    Uses a bottleneck MLP instead of a massive (H^2 -> H^2) layer.
    """
    def __init__(self, edge_dim: int, hidden_dim: int, edge_mlp_hidden: int = 128):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.mlp = nn.Sequential(
            nn.Linear(edge_dim, edge_mlp_hidden),
            nn.ReLU(),
            nn.Linear(edge_mlp_hidden, hidden_dim * hidden_dim),
        )

    def forward(self, edge_attr: torch.Tensor) -> torch.Tensor:
        W = self.mlp(edge_attr)  # (E, H*H)
        return W.view(-1, self.hidden_dim, self.hidden_dim)  # (E, H, H)


# =========================
# One GGNN update "cell"
# =========================
class GGNNCell(MessagePassing):
    def __init__(self, hidden_dim: int, edge_dim: int, edge_mlp_hidden: int = 128):
        super().__init__(aggr="add")
        self.edge_network = EdgeNetwork(edge_dim, hidden_dim, edge_mlp_hidden=edge_mlp_hidden)
        self.gru = nn.GRUCell(hidden_dim, hidden_dim)

    def forward(self, h: torch.Tensor, edge_index: torch.Tensor, edge_attr: torch.Tensor) -> torch.Tensor:
        # h: (N, H)
        return self.propagate(edge_index, h=h, edge_attr=edge_attr)

    def message(self, h_j: torch.Tensor, edge_attr: torch.Tensor) -> torch.Tensor:
        # h_j: (E, H)
        W = self.edge_network(edge_attr)                 # (E, H, H)
        msg = torch.bmm(W, h_j.unsqueeze(-1)).squeeze(-1)  # (E, H)
        return msg

    def update(self, aggr_out: torch.Tensor, h: torch.Tensor) -> torch.Tensor:
        # GRU: new_h = GRU(message, old_h)
        return self.gru(aggr_out, h)


# =========================
# GGNN encoder with T steps
# =========================
class GGNNEncoder(nn.Module):
    """
    Paper-faithful: project once, then apply the SAME GGNNCell repeatedly for mp_steps.
    """
    def __init__(self, node_dim: int, edge_dim: int, hidden_dim: int, mp_steps: int, edge_mlp_hidden: int = 128):
        super().__init__()
        self.node_proj = nn.Linear(node_dim, hidden_dim)
        self.cell = GGNNCell(hidden_dim, edge_dim, edge_mlp_hidden=edge_mlp_hidden)
        self.mp_steps = mp_steps

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor, edge_attr: torch.Tensor) -> torch.Tensor:
        h = self.node_proj(x)
        for _ in range(self.mp_steps):
            h = self.cell(h, edge_index, edge_attr)
        return h


# ==========================================
# Full Solubility Model (fixed batching)
# ==========================================
class SolubilityModel(nn.Module):
    def __init__(
        self,
        node_dim: int = 35,
        edge_dim: int = 10,
        hidden_dim: int = 48,
        mp_steps: int = 3,
        s2s_steps: int = 3,
        edge_mlp_hidden: int = 128,
        mlp_dims=(256, 128, 64),
        dropout: float = 0.15,
        scale_interaction: bool = True,
    ):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.scale_interaction = scale_interaction

        # Shared encoder for solute+solvent (keeps params down, usually improves OOD-by-solute)
        self.encoder = GGNNEncoder(
            node_dim=node_dim,
            edge_dim=edge_dim,
            hidden_dim=hidden_dim,
            mp_steps=mp_steps,
            edge_mlp_hidden=edge_mlp_hidden,
        )

        self.set2set_solute = Set2Set(hidden_dim, processing_steps=s2s_steps)
        self.set2set_solvent = Set2Set(hidden_dim, processing_steps=s2s_steps)

        in_dim = (2 * hidden_dim) + (2 * hidden_dim) + 1  # solute s2s + solvent s2s + temperature
        layers = []
        prev = in_dim
        for d in mlp_dims:
            layers += [nn.Linear(prev, d), nn.ReLU(), nn.Dropout(dropout)]
            prev = d
        layers += [nn.Linear(prev, 1)]
        self.mlp = nn.Sequential(*layers)

    def forward(self, solute, solvent, temperature: torch.Tensor) -> torch.Tensor:
        # Encode graphs
        h_s = self.encoder(solute.x, solute.edge_index, solute.edge_attr)    # (Ns_total, H)
        h_v = self.encoder(solvent.x, solvent.edge_index, solvent.edge_attr) # (Nv_total, H)

        # Build per-pair dense batches (prevents cross-sample leakage)
        Hs, ms = to_dense_batch(h_s, solute.batch)   # (B, Ns_max, H), (B, Ns_max)
        Hv, mv = to_dense_batch(h_v, solvent.batch)  # (B, Nv_max, H), (B, Nv_max)

        B_s = int(solute.batch.max().item()) + 1 if solute.batch.numel() else 0
        B_v = int(solvent.batch.max().item()) + 1 if solvent.batch.numel() else 0
        if B_s != B_v:
            raise ValueError(f"Batch size mismatch: solute B={B_s}, solvent B={B_v}. "
                             "Ensure solute and solvent batches are aligned per sample.")

        # Interaction map per sample: I[b] = Hs[b] @ Hv[b]^T
        I = torch.bmm(Hs, Hv.transpose(1, 2))  # (B, Ns_max, Nv_max)
        if self.scale_interaction:
            I = I / math.sqrt(self.hidden_dim)

        mapped_s = torch.bmm(I, Hv)                 # (B, Ns_max, H)
        mapped_v = torch.bmm(I.transpose(1, 2), Hs) # (B, Nv_max, H)

        # Flatten back to (N_total, H) in original order using masks
        mapped_s = mapped_s[ms]  # (Ns_total, H)
        mapped_v = mapped_v[mv]  # (Nv_total, H)

        solute_vec = self.set2set_solute(mapped_s, solute.batch)   # (B, 2H)
        solvent_vec = self.set2set_solvent(mapped_v, solvent.batch) # (B, 2H)

        t = temperature.view(-1, 1).to(solute_vec.dtype)  # (B, 1)
        final = torch.cat([solute_vec, solvent_vec, t], dim=-1)    # (B, 4H+1)

        return self.mlp(final)  # (B, 1)


# ======================
# Suggested parameters
# ======================
MODEL_PARAMS = dict(
    node_dim=35,          # 36 if add_partial_charges=True
    edge_dim=10,
    hidden_dim=48,        # good OOD-by-solute starting point
    mp_steps=3,
    s2s_steps=3,
    edge_mlp_hidden=128,  # keep edge network sane
    mlp_dims=(256, 128, 64),  # "three ReLU activation layers"
    dropout=0.15,
    scale_interaction=True,   # stabilize interaction magnitudes
)

# Model params with partial charges enabled
MODEL_PARAMS_WITH_CHARGES = dict(
    node_dim=36,          # 35 base + 1 for Gasteiger partial charge
    edge_dim=10,
    hidden_dim=48,
    mp_steps=3,
    s2s_steps=3,
    edge_mlp_hidden=128,
    mlp_dims=(256, 128, 64),
    dropout=0.15,
    scale_interaction=True,
)

# High capacity model for underfitting scenarios
MODEL_PARAMS_LARGE = dict(
    node_dim=36,          # with partial charges
    edge_dim=10,
    hidden_dim=192,       # 4x larger
    mp_steps=5,           # more message passing
    s2s_steps=4,          # more set2set steps
    edge_mlp_hidden=256,  # larger edge network
    mlp_dims=(512, 256, 128),  # bigger MLP head
    dropout=0.05,         # reduced regularization
    scale_interaction=True,
)


def get_model_params(add_partial_charges: bool = False, model_size: str = "default") -> dict:
    """Get model parameters based on featurization settings and model size.
    
    Args:
        add_partial_charges: Whether partial charges are used in features
        model_size: One of "default", "large" - use "large" for underfitting scenarios
        
    Returns:
        Dictionary of model parameters
    """
    if model_size == "large":
        params = MODEL_PARAMS_LARGE.copy()
        # Adjust node_dim if not using partial charges
        if not add_partial_charges:
            params["node_dim"] = 35
        return params
    
    if add_partial_charges:
        return MODEL_PARAMS_WITH_CHARGES.copy()
    return MODEL_PARAMS.copy()

TRAINING_PARAMS = dict(
    optimizer="AdamW",
    lr=2e-3,
    weight_decay=1e-5,
    batch_size=64,
    grad_clip_norm=1.0,
    loss="SmoothL1Loss(beta=0.5)",  # or MSE on standardized logS
    temperature_normalization="z-score (recommended)",
    target_normalization="optional: standardize logS during training",
)

# instantiate
# model = SolubilityModel(**MODEL_PARAMS)
