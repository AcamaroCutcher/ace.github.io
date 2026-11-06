! mpi_hello.f90 -- every process runs the same program; MPI gives each one a rank
! build:  mpif90 mpi_hello.f90 -o mpi_hello
! run:    mpirun -np 4 ./mpi_hello
program mpi_hello
  use mpi
  implicit none
  integer :: rank, nprocs, ierror

  call MPI_Init(ierror)
  call MPI_Comm_rank(MPI_COMM_WORLD, rank, ierror)     ! who am I?        0 .. nprocs-1
  call MPI_Comm_size(MPI_COMM_WORLD, nprocs, ierror)   ! how many of us?
  print '(a, i3, a, i3)', 'Hello from rank', rank, ' of', nprocs
  call MPI_Finalize(ierror)
end program mpi_hello
