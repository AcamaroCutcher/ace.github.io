#!/bin/bash
# Compile and run every serial example; then OpenMP and MPI if available.  Usage: bash build_all.sh
set -e
FC=${FC:-gfortran}
for f in hello kinds control loops loop_order arrays matrix thomas procedures fire1d; do
  echo "== $f"; $FC -O2 -Wall -fcheck=all $f.f90 -o $f && ./$f
done
echo "== lapack";  $FC lapack.f90 -llapack -o lapack && ./lapack || echo "(LAPACK not found: skipped)"
echo "== omp_sum"; $FC -O2 -fopenmp omp_sum.f90 -o omp_sum && OMP_NUM_THREADS=4 ./omp_sum
if command -v mpif90 >/dev/null; then
  echo "== mpi_hello"; mpif90 mpi_hello.f90 -o mpi_hello && mpirun -np 4 ./mpi_hello
  echo "== mpi_heat";  mpif90 -O2 mpi_heat.f90 -o mpi_heat && mpirun -np 4 ./mpi_heat
else
  echo "(mpif90 not found: MPI examples skipped)"
fi
