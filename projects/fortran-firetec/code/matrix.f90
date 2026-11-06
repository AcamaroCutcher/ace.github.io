! matrix.f90 -- matrix algebra: matmul, transpose, dot_product, and solving A x = b by Gaussian elimination
program matrix
  implicit none
  integer, parameter :: wp = kind(1.0d0), n = 3
  real(wp) :: a(n, n), b(n), x(n), c(n, n), r(n)
  integer :: i

  ! Fortran fills reshape column by column; transpose to write the matrix by rows
  a = transpose(reshape([ 4.0_wp, -2.0_wp,  1.0_wp, &
                         -2.0_wp,  4.0_wp, -2.0_wp, &
                          1.0_wp, -2.0_wp,  4.0_wp], [n, n]))
  b = [11.0_wp, -16.0_wp, 17.0_wp]

  print '(a)', 'A ='
  do i = 1, n
    print '(3f8.2)', a(i, :)
  end do
  print '(a, f8.2)', 'dot_product(b, b) = ', dot_product(b, b)
  c = matmul(a, transpose(a))
  print '(a)', 'A A^T ='
  do i = 1, n
    print '(3f8.2)', c(i, :)
  end do

  x = solve(a, b)
  print '(a, 3f10.5)', 'x        = ', x
  r = matmul(a, x) - b
  print '(a, es10.2)', '|A x - b| = ', sqrt(dot_product(r, r))

contains

  ! Gaussian elimination with partial pivoting; returns the solution, leaves a and b unchanged
  function solve(a_in, b_in) result(x)
    real(wp), intent(in) :: a_in(:, :), b_in(:)
    real(wp) :: x(size(b_in))
    real(wp) :: m(size(b_in), size(b_in) + 1), row(size(b_in) + 1), f
    integer :: k, p, j, nn
    nn = size(b_in)
    m(:, 1:nn) = a_in
    m(:, nn + 1) = b_in
    do k = 1, nn - 1
      p = maxloc(abs(m(k:nn, k)), dim=1) + k - 1      ! pivot: largest entry in column k
      if (p /= k) then
        row = m(k, :); m(k, :) = m(p, :); m(p, :) = row
      end if
      do j = k + 1, nn
        f = m(j, k) / m(k, k)
        m(j, k:) = m(j, k:) - f * m(k, k:)            ! eliminate below the pivot
      end do
    end do
    do k = nn, 1, -1                                  ! back substitution
      x(k) = (m(k, nn + 1) - dot_product(m(k, k + 1:nn), x(k + 1:nn))) / m(k, k)
    end do
  end function solve

end program matrix
