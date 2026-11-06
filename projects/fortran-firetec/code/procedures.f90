! procedures.f90 -- modules, functions, subroutines, intent, pure/elemental, optional arguments
! A module groups constants, variables and procedures; programs "use" it. FIRETEC is built from modules like this one.
module fuel_physics
  implicit none
  private                                       ! hide everything not listed as public
  public :: wp, nfuel_const, psi_ramp, donor, consume_fuel, describe

  integer, parameter :: wp = kind(1.0d0)
  real(wp), parameter :: nfuel_const = 0.4552_wp     ! N_wood in FIRETEC's Vegetation/variables_veg.F90
  real(wp), parameter :: tstep = 310.0_wp, tcrit = 600.0_wp

contains

  ! elemental: written for one value, works on whole arrays too
  elemental function psi_ramp(temps) result(psi)
    real(wp), intent(in) :: temps
    real(wp) :: psi
    psi = min(1.0_wp, max(0.0_wp, (temps - tstep) / (2.0_wp * (tcrit - tstep))))
  end function psi_ramp

  ! the upwind (donor-cell) flux used by FIRETEC's advection: take the value from the side the wind comes from
  pure function donor(y1, y2, c) result(flux)
    real(wp), intent(in) :: y1, y2, c        ! left value, right value, Courant number u*dt/dx at the face
    real(wp) :: flux
    flux = max(c, 0.0_wp) * y1 + min(c, 0.0_wp) * y2
  end function donor

  ! a subroutine changes its arguments; intent says which ones it reads and which it writes
  subroutine consume_fuel(rhof, rate, dt, burned)
    real(wp), intent(inout) :: rhof(:)                ! fuel density, updated in place
    real(wp), intent(in)    :: rate(:), dt            ! reaction rate F and time step
    real(wp), intent(out), optional :: burned         ! total mass burned (only if the caller asks)
    real(wp) :: before
    before = sum(rhof)
    rhof = max(0.0_wp, rhof - nfuel_const * rate * dt)
    if (present(burned)) burned = before - sum(rhof)
  end subroutine consume_fuel

  subroutine describe(name, value, unit)
    character(len=*), intent(in) :: name, unit      ! len=* takes the length from the actual argument
    real(wp), intent(in) :: value
    print '(a, ": ", es11.4, 1x, a)', name, value, unit
  end subroutine describe

end module fuel_physics


program procedures
  use fuel_physics, only : wp, psi_ramp, donor, consume_fuel, describe
  implicit none
  real(wp) :: temps(4) = [300.0_wp, 450.0_wp, 600.0_wp, 900.0_wp]
  real(wp) :: rhof(3), rate(3), burned

  print '(a, 4f7.3)', 'psi_ramp(T)  = ', psi_ramp(temps)        ! elemental: called on an array
  print '(a, f6.2)', 'donor, wind to the right: ', donor(1.0_wp, 5.0_wp,  0.5_wp)
  print '(a, f6.2)', 'donor, wind to the left:  ', donor(1.0_wp, 5.0_wp, -0.5_wp)

  rhof = [0.7_wp, 0.7_wp, 0.7_wp]
  rate = [0.0_wp, 0.5_wp, 1.0_wp]
  call consume_fuel(rhof, rate, 0.1_wp, burned)
  print '(a, 3f7.4)', 'fuel after one step: ', rhof
  call describe('mass burned per m^3 of each cell, summed', burned, 'kg/m^3')
  call consume_fuel(rhof, rate, 0.1_wp)                          ! optional argument left out
  print '(a, 3f7.4)', 'after a second step: ', rhof
end program procedures
