"""
Molecular graph featurization for PyTorch Geometric.
Converts SMILES to graph representations suitable for MPNN/GNN models.
"""

import torch
from torch_geometric.data import Data
from rdkit import Chem
from rdkit.Chem import AllChem
from rdkit.Chem import rdPartialCharges
import numpy as np
from typing import Optional, List, Tuple


class MolecularGraphFeaturizer:
    """Featurizer for converting molecules to PyTorch Geometric graphs."""
    
    def __init__(
        self, 
        use_edge_features: bool = True,
        use_3d_coords: bool = False,
        add_partial_charges: bool = False
    ):
        """
        Initialize featurizer.
        
        Args:
            use_edge_features: Whether to include bond features
            use_3d_coords: Whether to generate and include 3D coordinates
            add_partial_charges: Whether to add Gasteiger partial charges as atom features
        """
        self.use_edge_features = use_edge_features
        self.use_3d_coords = use_3d_coords
        self.add_partial_charges = add_partial_charges
    
    def get_config(self) -> dict:
        """Get featurizer configuration as a dictionary."""
        return {
            'use_edge_features': self.use_edge_features,
            'use_3d_coords': self.use_3d_coords,
            'add_partial_charges': self.add_partial_charges,
        }
    
    @classmethod
    def from_config(cls, config: dict) -> 'MolecularGraphFeaturizer':
        """Create featurizer from configuration dictionary."""
        return cls(
            use_edge_features=config.get('use_edge_features', True),
            use_3d_coords=config.get('use_3d_coords', False),
            add_partial_charges=config.get('add_partial_charges', False),
        )
    
    def get_node_dim(self) -> int:
        """Get the dimension of node features."""
        return get_atom_feature_dims(self.add_partial_charges)['total']
    
    def get_edge_dim(self) -> int:
        """Get the dimension of edge features."""
        return get_bond_feature_dims()['total']
    
    def get_atom_features(self, atom: Chem.Atom, partial_charge: Optional[float] = None) -> List[float]:
        """
        Extract atom features.
        
        Features include:
        - Atomic number (one-hot for common elements)
        - Degree (one-hot)
        - Formal charge
        - Hybridization (one-hot)
        - Aromaticity
        - Number of hydrogens
        - Chirality
        - Gasteiger partial charge (optional)
        
        Args:
            atom: RDKit Atom object
            partial_charge: Optional precomputed Gasteiger partial charge
            
        Returns:
            List of atom features
        """
        features = []
        
        # Atomic number (one-hot for common elements, else 'other')
        atomic_nums = [1, 6, 7, 8, 9, 15, 16, 17, 35, 53]  # H, C, N, O, F, P, S, Cl, Br, I
        features.extend([1 if atom.GetAtomicNum() == x else 0 for x in atomic_nums])
        features.append(1 if atom.GetAtomicNum() not in atomic_nums else 0)  # Other
        
        # Degree (one-hot: 0-5, >5)
        degree = atom.GetDegree()
        features.extend([1 if degree == i else 0 for i in range(6)])
        features.append(1 if degree > 5 else 0)
        
        # Formal charge
        features.append(atom.GetFormalCharge())
        
        # Hybridization (one-hot)
        hybrid_types = [
            Chem.rdchem.HybridizationType.SP,
            Chem.rdchem.HybridizationType.SP2,
            Chem.rdchem.HybridizationType.SP3,
            Chem.rdchem.HybridizationType.SP3D,
            Chem.rdchem.HybridizationType.SP3D2
        ]
        features.extend([1 if atom.GetHybridization() == ht else 0 for ht in hybrid_types])
        features.append(1 if atom.GetHybridization() not in hybrid_types else 0)  # Other
        
        # Aromaticity
        features.append(1 if atom.GetIsAromatic() else 0)
        
        # Number of hydrogens (one-hot: 0-4, >4)
        num_hs = atom.GetTotalNumHs()
        features.extend([1 if num_hs == i else 0 for i in range(5)])
        features.append(1 if num_hs > 4 else 0)
        
        # Chirality (one-hot)
        try:
            chiral_types = [
                Chem.rdchem.ChiralType.CHI_UNSPECIFIED,
                Chem.rdchem.ChiralType.CHI_TETRAHEDRAL_CW,
                Chem.rdchem.ChiralType.CHI_TETRAHEDRAL_CCW,
            ]
            features.extend([1 if atom.GetChiralTag() == ct else 0 for ct in chiral_types])
        except:
            features.extend([1, 0, 0])
        
        # Gasteiger partial charge (optional)
        if self.add_partial_charges:
            if partial_charge is not None and not np.isnan(partial_charge):
                features.append(float(partial_charge))
            else:
                features.append(0.0)  # Default to 0 if charge computation failed
        
        return features
    
    def get_bond_features(self, bond: Chem.Bond) -> List[float]:
        """
        Extract bond features.
        
        Features include:
        - Bond type (one-hot)
        - Conjugation
        - Ring membership
        - Stereochemistry
        
        Args:
            bond: RDKit Bond object
            
        Returns:
            List of bond features
        """
        features = []
        
        # Bond type (one-hot)
        bond_types = [
            Chem.rdchem.BondType.SINGLE,
            Chem.rdchem.BondType.DOUBLE,
            Chem.rdchem.BondType.TRIPLE,
            Chem.rdchem.BondType.AROMATIC
        ]
        features.extend([1 if bond.GetBondType() == bt else 0 for bt in bond_types])
        
        # Conjugation
        features.append(1 if bond.GetIsConjugated() else 0)
        
        # Ring membership
        features.append(1 if bond.IsInRing() else 0)
        
        # Stereochemistry (one-hot)
        stereo_types = [
            Chem.rdchem.BondStereo.STEREONONE,
            Chem.rdchem.BondStereo.STEREOANY,
            Chem.rdchem.BondStereo.STEREOZ,
            Chem.rdchem.BondStereo.STEREOE,
        ]
        features.extend([1 if bond.GetStereo() == st else 0 for st in stereo_types])
        
        return features
    
    def smiles_to_graph(self, smiles: str) -> Optional[Data]:
        """
        Convert SMILES to PyTorch Geometric Data object.
        
        Args:
            smiles: SMILES string
            
        Returns:
            PyTorch Geometric Data object or None if conversion fails
        """
        try:
            # Parse SMILES
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                return None
            
            # Add hydrogens for accurate feature extraction
            mol = Chem.AddHs(mol)
            
            # Generate 3D coordinates if requested
            if self.use_3d_coords:
                AllChem.EmbedMolecule(mol, randomSeed=42)
                AllChem.MMFFOptimizeMolecule(mol)
            
            # Compute Gasteiger partial charges if requested
            partial_charges = None
            if self.add_partial_charges:
                try:
                    rdPartialCharges.ComputeGasteigerCharges(mol)
                    partial_charges = [
                        atom.GetDoubleProp('_GasteigerCharge') 
                        for atom in mol.GetAtoms()
                    ]
                except Exception:
                    # Fall back to zero charges if computation fails
                    partial_charges = [0.0] * mol.GetNumAtoms()
            
            # Extract atom features
            atom_features = []
            for i, atom in enumerate(mol.GetAtoms()):
                charge = partial_charges[i] if partial_charges else None
                atom_features.append(self.get_atom_features(atom, partial_charge=charge))
            x = torch.tensor(atom_features, dtype=torch.float)
            
            # Extract bonds and build edge index
            edge_index = []
            edge_attr = []
            
            for bond in mol.GetBonds():
                i = bond.GetBeginAtomIdx()
                j = bond.GetEndAtomIdx()
                
                # Add both directions for undirected graph
                edge_index.append([i, j])
                edge_index.append([j, i])
                
                if self.use_edge_features:
                    bond_features = self.get_bond_features(bond)
                    edge_attr.append(bond_features)
                    edge_attr.append(bond_features)  # Same features for both directions
            
            # Convert to tensors
            if len(edge_index) > 0:
                edge_index = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
            else:
                edge_index = torch.empty((2, 0), dtype=torch.long)
            
            if self.use_edge_features and len(edge_attr) > 0:
                edge_attr = torch.tensor(edge_attr, dtype=torch.float)
            else:
                edge_attr = None
            
            # 3D coordinates (optional)
            pos = None
            if self.use_3d_coords:
                try:
                    conf = mol.GetConformer()
                    pos = torch.tensor(conf.GetPositions(), dtype=torch.float)
                except:
                    pass
            
            # Create PyG Data object
            data = Data(
                x=x,
                edge_index=edge_index,
                edge_attr=edge_attr,
                pos=pos
            )
            
            return data
            
        except Exception as e:
            print(f"Error converting SMILES {smiles}: {e}")
            return None
    
    def create_solute_solvent_pair_graph(
        self, 
        solute_smiles: str, 
        solvent_smiles: str
    ) -> Optional[Tuple[Data, Data]]:
        """
        Create separate graphs for solute and solvent.
        
        Args:
            solute_smiles: SMILES of solute
            solvent_smiles: SMILES of solvent
            
        Returns:
            Tuple of (solute_graph, solvent_graph) or None if conversion fails
        """
        solute_graph = self.smiles_to_graph(solute_smiles)
        solvent_graph = self.smiles_to_graph(solvent_smiles)
        
        if solute_graph is None or solvent_graph is None:
            return None
        
        return solute_graph, solvent_graph


class SolubilityDataPoint:
    """Container for a single solubility data point."""
    
    def __init__(
        self,
        solute_graph: Data,
        solvent_graph: Data,
        temperature: float,
        target_value: float,
        target_type: str,  # 'logs' or 'dgsolv'
        metadata: Optional[dict] = None
    ):
        """
        Initialize data point.
        
        Args:
            solute_graph: PyG Data for solute
            solvent_graph: PyG Data for solvent
            temperature: Temperature in Kelvin
            target_value: LogS or ΔGsolv value
            target_type: Type of target ('logs' or 'dgsolv')
            metadata: Optional metadata dictionary
        """
        self.solute_graph = solute_graph
        self.solvent_graph = solvent_graph
        self.temperature = temperature
        self.target_value = target_value
        self.target_type = target_type
        self.metadata = metadata or {}
    
    def to_dict(self) -> dict:
        """Convert to dictionary format."""
        return {
            'solute_graph': self.solute_graph,
            'solvent_graph': self.solvent_graph,
            'temperature': self.temperature,
            'target_value': self.target_value,
            'target_type': self.target_type,
            'metadata': self.metadata
        }


def get_atom_feature_dims(add_partial_charges: bool = False) -> dict:
    """
    Get dimensions of atom features for model architecture.
    
    Args:
        add_partial_charges: Whether partial charges are included in features
    
    Returns:
        Dictionary with feature dimensions
    """
    base_dims = {
        'atomic_num': 11,  # 10 common elements + other
        'degree': 7,  # 0-5 + >5
        'formal_charge': 1,
        'hybridization': 6,  # SP, SP2, SP3, SP3D, SP3D2, other
        'aromatic': 1,
        'num_hs': 6,  # 0-4 + >4
        'chirality': 3,
    }
    base_total = 35  # Sum of base features
    
    if add_partial_charges:
        base_dims['partial_charge'] = 1
        base_dims['total'] = base_total + 1  # 36
    else:
        base_dims['total'] = base_total  # 35
    
    return base_dims


def get_bond_feature_dims() -> dict:
    """
    Get dimensions of bond features for model architecture.
    
    Returns:
        Dictionary with feature dimensions
    """
    return {
        'bond_type': 4,  # Single, double, triple, aromatic
        'conjugated': 1,
        'in_ring': 1,
        'stereo': 4,  # None, any, Z, E
        'total': 10  # Sum of all features
    }


if __name__ == "__main__":
    # Example usage - without partial charges (backwards compatible)
    print("Testing without partial charges:")
    featurizer = MolecularGraphFeaturizer(use_edge_features=True)
    
    # Test on a simple molecule
    aspirin_smiles = "CC(=O)Oc1ccccc1C(=O)O"
    graph = featurizer.smiles_to_graph(aspirin_smiles)
    
    if graph is not None:
        print(f"Number of nodes: {graph.x.shape[0]}")
        print(f"Node feature dimension: {graph.x.shape[1]}")
        print(f"Number of edges: {graph.edge_index.shape[1]}")
        if graph.edge_attr is not None:
            print(f"Edge feature dimension: {graph.edge_attr.shape[1]}")
    
    # Test with partial charges
    print("\nTesting with partial charges:")
    featurizer_charges = MolecularGraphFeaturizer(use_edge_features=True, add_partial_charges=True)
    graph_charges = featurizer_charges.smiles_to_graph(aspirin_smiles)
    
    if graph_charges is not None:
        print(f"Number of nodes: {graph_charges.x.shape[0]}")
        print(f"Node feature dimension: {graph_charges.x.shape[1]}")
        print(f"Number of edges: {graph_charges.edge_index.shape[1]}")
        if graph_charges.edge_attr is not None:
            print(f"Edge feature dimension: {graph_charges.edge_attr.shape[1]}")
        
        # Show partial charges for first few atoms
        print("\nPartial charges (last feature) for first 5 atoms:")
        for i in range(min(5, graph_charges.x.shape[0])):
            print(f"  Atom {i}: {graph_charges.x[i, -1].item():.4f}")

