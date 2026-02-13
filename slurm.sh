#!/usr/bin/env bash

#SBATCH --job-name=ADMET-model-library
#SBATCH --output=/shared/%u/projects/ADMET-model-library/logs/out.log
#SBATCH --error=/shared/%u/projects/ADMET-model-library/logs/err.log

#SBATCH --cpus-per-task=4
#SBATCH --mem=4G
#SBATCH --gres=shard:2000
#SBATCH --nodelist=own4,own5,own6
#SBATCH --nodes=1


set -e

# ----------------------------------------------------------
# Environment
# ----------------------------------------------------------
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
export COMPOSE_PROJECT_NAME="solviscope_${SLURM_JOB_ID}"

# ----------------------------------------------------------
# Project settings
# ----------------------------------------------------------
PROJECT="ADMET-model-library"
WORKDIR="/shared/${USER}/projects/ADMET-model-library"

# ----------------------------------------------------------
# Metadata Display
# ----------------------------------------------------------
echo ""
echo "============================================================"
echo " $PROJECT Job Metadata"
echo "============================================================"
echo "Job ID       : $SLURM_JOB_ID"
echo "Job Name     : $SLURM_JOB_NAME"
echo "User         : $USER"
echo "Host Node    : $(hostname)"
echo "Working Dir  : $WORKDIR"
echo "Compose Name : $COMPOSE_PROJECT_NAME"
echo "============================================================"
echo ""

# ----------------------------------------------------------
# Move to project directory
# ----------------------------------------------------------
cd "${WORKDIR}"

# ----------------------------------------------------------
# Create logs directory if it doesn't exist
# ----------------------------------------------------------
echo $WORKDIR
mkdir -p "${WORKDIR}/logs"

# ----------------------------------------------------------
# Safety check
# ----------------------------------------------------------
if [ ! -f docker-compose.yml ]; then
    echo "ERROR: docker-compose.yml not found in ${WORKDIR}"
    exit 1
fi

# ----------------------------------------------------------
# Cleanup on exit
# ----------------------------------------------------------
cleanup() {
    echo "=== Stopping & removing Docker Compose services ==="
    docker compose down --volumes --remove-orphans || true
}
trap cleanup EXIT

# ----------------------------------------------------------
# Build images
# ----------------------------------------------------------
echo "=== Building Docker Compose images ==="
docker compose build

# ----------------------------------------------------------
# Run services (blocking)
# ----------------------------------------------------------
echo "=== Starting Docker Compose services ==="
docker compose up --abort-on-container-exit

# ----------------------------------------------------------
# Completion message
# ----------------------------------------------------------
echo "============================================================"
echo " $PROJECT Job Finished $(date)"
echo "============================================================"