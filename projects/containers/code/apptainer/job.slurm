#!/bin/bash
# Run a containerized analysis on a Slurm cluster (lesson 07). Submit: sbatch job.slurm
#SBATCH --job-name=container-job
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=8G
#SBATCH --time=00:30:00

module load apptainer        # the module name differs between clusters (sometimes "singularity")

# your home directory and the current folder are visible inside the container by default;
# --bind adds other folders, such as a scratch file system
apptainer exec --bind /scratch science.sif python analysis.py
