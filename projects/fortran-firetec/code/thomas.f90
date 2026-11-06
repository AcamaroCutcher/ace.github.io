! thomas.f90 -- implicit (backward Euler) heat diffusion through a 1-D fuel bed, solved with the tridiagonal (Thomas) algorithm
program thomas
  implicit none
  integer, parameter :: wp = kind(1.0d0), n = 50
  real(wp), parameter :: kappa = 1.0e-4_wp, dx = 0.002_wp, dt = 0.5_wp
  real(wp) :: t(n), lo(n), di(n), up(n), rhs(n), r
  integer :: step, i

  t = 300.0_wp
  r = kappa * dt / dx**2                 ! = 12.5: an explicit scheme would blow up, an implicit one is stable
  lo = -r; di = 1.0_wp + 2.0_wp * r; up = -r
  ! fixed temperatures at both ends: a hot face at 900 K and the far side at 300 K
  di(1) = 1.0_wp; up(1) = 0.0_wp; di(n) = 1.0_wp; lo(n) = 0.0_wp

  do step = 1, 20
    rhs = t
    rhs(1) = 900.0_wp; rhs(n) = 300.0_wp
    call tridiag(lo, di, up, rhs, t)
  end do
  print '(a, f5.1, a)', 'after ', 20 * dt, ' s:'
  do i = 1, n, 7
    print '(f7.3, a, f8.2, a)', (i - 1) * dx * 100.0_wp, ' cm  ', t(i), ' K'
  end do

contains

  ! solve  lo(i) x(i-1) + di(i) x(i) + up(i) x(i+1) = d(i),  i = 1..n  (lo(1) and up(n) unused)
  subroutine tridiag(lo, di, up, d, x)
    real(wp), intent(in)  :: lo(:), di(:), up(:), d(:)
    real(wp), intent(out) :: x(:)
    real(wp) :: c(size(d)), g(size(d)), m
    integer :: i, nn
    nn = size(d)
    c(1) = up(1) / di(1)
    g(1) = d(1) / di(1)
    do i = 2, nn                          ! forward sweep
      m = di(i) - lo(i) * c(i - 1)
      c(i) = up(i) / m
      g(i) = (d(i) - lo(i) * g(i - 1)) / m
    end do
    x(nn) = g(nn)
    do i = nn - 1, 1, -1                  ! back substitution
      x(i) = g(i) - c(i) * x(i + 1)
    end do
  end subroutine tridiag

end program thomas
