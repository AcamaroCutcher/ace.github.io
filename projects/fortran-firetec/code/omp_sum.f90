! omp_sum.f90 -- shared-memory parallel loops with OpenMP
! build:  gfortran -O2 -fopenmp omp_sum.f90 -o omp_sum
! run:    OMP_NUM_THREADS=4 ./omp_sum
program omp_sum
  use omp_lib
  implicit none
  integer, parameter :: wp = kind(1.0d0), n = 50000000
  real(wp), allocatable :: rhof(:), rate(:)
  real(wp) :: total, t0, t1
  integer :: i

  allocate(rhof(n), rate(n))

  !$omp parallel do
  do i = 1, n                                   ! iterations are split between the threads
    rhof(i) = 0.7_wp
    rate(i) = 1.0e-3_wp * mod(i, 7)
  end do
  !$omp end parallel do

  t0 = omp_get_wtime()
  total = 0.0_wp
  !$omp parallel do reduction(+:total)
  do i = 1, n                                   ! each thread keeps a private partial sum, added at the end
    rhof(i) = max(0.0_wp, rhof(i) - 0.4552_wp * rate(i) * 0.1_wp)
    total = total + rhof(i)
  end do
  !$omp end parallel do
  t1 = omp_get_wtime()

  print '(a, i3)', 'threads:   ', omp_get_max_threads()
  print '(a, f14.4)', 'fuel left: ', total
  print '(a, f8.4, a)', 'loop time: ', t1 - t0, ' s'
end program omp_sum
