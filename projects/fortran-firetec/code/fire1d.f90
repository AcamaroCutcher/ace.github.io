! fire1d.f90 -- a 1-D "resolved volume" fire along a strip of grass, using FIRETEC-like pieces:
!   gas temperature T advected by the wind (donor cell) and diffused, solid fuel consumed at a rate that
!   switches on with a temperature ramp, heat released into the gas.  Writes fire1d.csv every 5 s.
! It is a teaching model with made-up coefficients, not FIRETEC.
module fire1d_mod
  implicit none
  integer, parameter :: wp = kind(1.0d0)
contains
  pure function donor(y1, y2, c) result(f)
    real(wp), intent(in) :: y1, y2, c
    real(wp) :: f
    f = max(c, 0.0_wp) * y1 + min(c, 0.0_wp) * y2
  end function donor

  elemental function psi(t) result(p)              ! fraction of the cell hot enough to react
    real(wp), intent(in) :: t
    real(wp) :: p
    p = min(1.0_wp, max(0.0_wp, (t - 400.0_wp) / 400.0_wp))
  end function psi
end module fire1d_mod

program fire1d
  use fire1d_mod
  implicit none
  integer, parameter :: n = 400                      ! 400 cells of 0.5 m = 200 m of grass
  real(wp), parameter :: dx = 0.5_wp, u = 1.0_wp, kdiff = 0.5_wp
  real(wp), parameter :: tamb = 300.0_wp, rho0 = 0.7_wp, krate = 0.6_wp
  real(wp), parameter :: heat = 1.2e3_wp             ! K of gas heating per kg/m^3 of fuel burned (illustrative)
  real(wp), parameter :: cool = 0.1_wp               ! relaxation of the gas toward ambient (1/s)
  real(wp) :: t(0:n+1), tnew(n), rhof(n), flux(0:n), dt, time, burn
  integer :: i, step, nsteps, unit

  dt = 0.4_wp * min(dx / u, dx**2 / (2.0_wp * kdiff))   ! stability: Courant and diffusion limits
  nsteps = nint(60.0_wp / dt)
  t = tamb; rhof = rho0
  t(1:10) = 1000.0_wp                                   ! ignition at the upwind end

  open(newunit=unit, file='fire1d.csv', status='replace', action='write')
  write(unit, '(a)') 'time,x,T,fuel'
  time = 0.0_wp
  do step = 0, nsteps
    if (mod(step, nint(5.0_wp / dt)) == 0) then
      do i = 1, n, 4
        write(unit, '(f6.1, ",", f6.1, ",", f8.2, ",", f7.4)') time, (i - 0.5_wp) * dx, t(i), rhof(i)
      end do
    end if
    t(0) = tamb; t(n + 1) = t(n)                        ! ghost cells: inflow on the left, outflow on the right
    do i = 0, n
      flux(i) = donor(t(i), t(i + 1), u * dt / dx)      ! advective flux through face i+1/2
    end do
    do i = 1, n                                         ! new values go to tnew so every cell sees the old t
      burn = krate * rhof(i) * psi(t(i)) * dt           ! fuel burned this step
      rhof(i) = rhof(i) - burn
      tnew(i) = t(i) - (flux(i) - flux(i - 1)) &
                + kdiff * dt / dx**2 * (t(i + 1) - 2.0_wp * t(i) + t(i - 1)) &
                + heat * burn - cool * dt * (t(i) - tamb)
    end do
    t(1:n) = tnew
    time = time + dt
  end do
  close(unit)

  print '(a, f6.1, a)', 'simulated ', time, ' s'
  print '(a, f6.1, a)', 'burned out over ', dx * count(rhof < 0.05_wp * rho0), ' m of the 200 m strip'
  print '(a, f7.1, a)', 'hottest gas now ', maxval(t(1:n)), ' K'
  print '(a)', 'wrote fire1d.csv (time, x, T, fuel)'
end program fire1d
