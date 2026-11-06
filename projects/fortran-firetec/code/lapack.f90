! lapack.f90 -- the same 3x3 system with LAPACK's dgesv (LU factorization with partial pivoting)
! build:  gfortran lapack.f90 -llapack -o lapack      (on clusters: -lopenblas, or -qmkl with Intel)
program lapack_demo
  implicit none
  integer, parameter :: n = 3
  double precision :: a(n, n), b(n, 1)
  integer :: ipiv(n), info

  a = transpose(reshape([ 4d0, -2d0,  1d0, &
                         -2d0,  4d0, -2d0, &
                          1d0, -2d0,  4d0], [n, n]))
  b(:, 1) = [11d0, -16d0, 17d0]
  call dgesv(n, 1, a, n, ipiv, b, n, info)   ! on return b holds x, and a holds the LU factors
  if (info /= 0) stop 'dgesv failed'
  print '(a, 3f10.5)', 'x = ', b(:, 1)
end program lapack_demo
