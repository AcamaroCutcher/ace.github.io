#!/bin/bash
#SBATCH --job-name=mpi_heat
#SBATCH --nodes=1
#SBATCH --ntasks=4
#SBATCH --time=00:05:00
#SBATCH --output=mpi_heat_%j.out
# Module names differ between clusters: run "module avail" to see yours.
module load gcc openmpi
mpif90 -O2 mpi_heat.f90 -o mpi_heat
srun ./mpi_heat
