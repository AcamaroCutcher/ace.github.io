! mpi_heat.f90 -- domain decomposition with halo (ghost) cells, the pattern FIRETEC uses in msga.F90 and update.F90.
! A 1-D rod of N cells is split into equal pieces, one per process. Each step, every process swaps its edge
! values with its neighbours (MPI_Sendrecv), updates its own cells, and all processes agree on the maximum (MPI_Allreduce).
! build:  mpif90 -O2 mpi_heat.f90 -o mpi_heat
! run:    mpirun -np 4 ./mpi_heat
program mpi_heat
  use mpi
  implicit none
  integer, parameter :: wp = kind(1.0d0), n = 1200, ih = 1
  real(wp), parameter :: r = 0.4_wp                     ! kappa*dt/dx^2 <= 0.5 for stability
  real(wp), allocatable :: t(:), tnew(:)
  integer :: rank, nprocs, ierror, np, i0, left, right, step, i
  integer :: status(MPI_STATUS_SIZE)
  real(wp) :: local_max, global_max, local_sum, global_sum

  call MPI_Init(ierror)
  call MPI_Comm_rank(MPI_COMM_WORLD, rank, ierror)
  call MPI_Comm_size(MPI_COMM_WORLD, nprocs, ierror)
  if (mod(n, nprocs) /= 0) then                          ! FIRETEC makes the same check on n/nprocx
    if (rank == 0) print *, 'n must be divisible by the number of processes'
    call MPI_Abort(MPI_COMM_WORLD, 1, ierror)
  end if
  np = n / nprocs                                        ! cells owned by this process
  i0 = rank * np                                         ! global index of cell 0 (the left ghost)
  left = rank - 1; right = rank + 1
  if (rank == 0) left = MPI_PROC_NULL                    ! no neighbour: MPI skips the transfer
  if (rank == nprocs - 1) right = MPI_PROC_NULL

  allocate(t(1-ih:np+ih), tnew(np))
  t = 300.0_wp
  do i = 1, np                                           ! a hot slab in the middle of the global rod
    if (abs(i0 + i - n / 2) < n / 20) t(i) = 1000.0_wp
  end do

  do step = 1, 2000
    ! halo exchange: send my last cell right while receiving my left ghost, then the reverse
    call MPI_Sendrecv(t(np), 1, MPI_DOUBLE_PRECISION, right, 1, &
                      t(0),  1, MPI_DOUBLE_PRECISION, left,  1, MPI_COMM_WORLD, status, ierror)
    call MPI_Sendrecv(t(1),    1, MPI_DOUBLE_PRECISION, left,  2, &
                      t(np+1), 1, MPI_DOUBLE_PRECISION, right, 2, MPI_COMM_WORLD, status, ierror)
    if (rank == 0) t(0) = 300.0_wp                       ! physical boundaries on the outer edges
    if (rank == nprocs - 1) t(np + 1) = 300.0_wp
    do i = 1, np
      tnew(i) = t(i) + r * (t(i - 1) - 2.0_wp * t(i) + t(i + 1))
    end do
    t(1:np) = tnew
  end do

  local_max = maxval(t(1:np)); local_sum = sum(t(1:np))
  call MPI_Allreduce(local_max, global_max, 1, MPI_DOUBLE_PRECISION, MPI_MAX, MPI_COMM_WORLD, ierror)
  call MPI_Allreduce(local_sum, global_sum, 1, MPI_DOUBLE_PRECISION, MPI_SUM, MPI_COMM_WORLD, ierror)
  print '(a, i3, a, i5, a, i5, a, f8.2)', 'rank', rank, ' owns cells', i0 + 1, ' to', i0 + np, ', local max', local_max
  if (rank == 0) then
    print '(a, f8.2, a)', 'global max after 2000 steps: ', global_max, ' K'
    print '(a, f8.2, a)', 'mean temperature:            ', global_sum / n, ' K'
  end if
  call MPI_Finalize(ierror)
end program mpi_heat
