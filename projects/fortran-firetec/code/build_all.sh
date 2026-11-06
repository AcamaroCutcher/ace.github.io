#!/bin/bash
# Compile and run every example; OpenMP and MPI too if available.  Usage: bash build_all.sh
# Override the compiler names if yours differ, e.g. on MacPorts:
#   FC=gfortran-mp-15 MPIFC=mpif90-openmpi-mp MPIRUN=mpirun-openmpi-mp bash build_all.sh
set -e
FC=${FC:-gfortran}
MPIFC=${MPIFC:-mpif90}
MPIRUN=${MPIRUN:-mpirun}
for f in hello kinds control loops loop_order arrays matrix thomas procedures fire1d; do
  echo "== $f"; $FC -O2 -Wall -fcheck=all $f.f90 -o $f && ./$f
done
echo "== lapack";  ($FC lapack.f90 -llapack -o lapack && ./lapack) || echo "(LAPACK not found: skipped)"
echo "== omp_sum"; $FC -O2 -fopenmp omp_sum.f90 -o omp_sum && OMP_NUM_THREADS=4 ./omp_sum
if command -v $MPIFC >/dev/null; then
  echo "== mpi_hello"; $MPIFC mpi_hello.f90 -o mpi_hello && $MPIRUN -np 4 ./mpi_hello
  echo "== mpi_heat";  $MPIFC -O2 mpi_heat.f90 -o mpi_heat && $MPIRUN -np 4 ./mpi_heat
else
  echo "($MPIFC not found: MPI examples skipped)"
fi
