! kinds.f90 -- variables, kinds, constants and arithmetic
program kinds
  use, intrinsic :: iso_fortran_env, only : real32, real64
  implicit none
  integer, parameter :: wp = real64          ! "working precision", as in FIRETEC's variables.F90
  real(wp), parameter :: pi = 3.141592653589793_wp
  real(wp), parameter :: hf = 8913480.0_wp    ! heat of reaction of wood (J/kg of products)
  integer  :: ncells
  real(wp) :: dx, area
  real(real32) :: x4
  real(real64) :: x8
  logical  :: wet
  character(len=20) :: fuel_name

  ncells = 200
  dx = 2.0_wp                                  ! the _wp suffix makes the literal double precision
  area = (ncells * dx)**2                      ! ** is the power operator
  fuel_name = 'tall grass'
  wet = .false.

  print *, 'domain side (m): ', ncells * dx
  print '(a, f10.1, a)', 'domain area: ', area / 1.0e4_wp, ' ha'
  print '(a, a)', 'fuel: ', trim(fuel_name)
  print *, 'is the fuel wet? ', wet

  ! integer division truncates; mixing kinds promotes to the wider one
  print *, '7 / 2   = ', 7 / 2
  print *, '7 / 2.0 = ', 7 / 2.0_wp

  ! single versus double precision
  x4 = 1.0_real32 / 3.0_real32
  x8 = 1.0_real64 / 3.0_real64
  print '(a, f22.18)', '1/3 in single: ', x4
  print '(a, f22.18)', '1/3 in double: ', x8
  print *, 'digits of precision: ', precision(x4), precision(x8)
  print '(a, es12.4, a)', 'heat from 1 kg of products: ', hf, ' J'
  print '(a, f8.5)', 'pi = ', pi
end program kinds
