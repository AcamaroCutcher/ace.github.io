! loops.f90 -- counted loops, do while, exit and cycle
program loops
  implicit none
  integer, parameter :: wp = kind(1.0d0)
  integer  :: i, it, nt
  real(wp) :: total, time, dt, fuel

  ! 1) counted loop: sum of 1/i^2 tends to pi^2/6
  total = 0.0_wp
  do i = 1, 100000
    total = total + 1.0_wp / real(i, wp)**2
  end do
  print '(a, f12.8, a, f12.8)', 'sum 1/i^2 = ', total, '   pi^2/6 = ', acos(-1.0_wp)**2 / 6.0_wp

  ! 2) a step other than one, and counting down
  do i = 10, 1, -3
    write(*, '(i4)', advance='no') i
  end do
  print *

  ! 3) do while: the shape of FIRETEC's main time loop in compress.F90
  nt = 5; it = 0; time = 0.0_wp; dt = 0.01_wp
  do while (it < nt)
    it = it + 1
    time = time + dt
    print '(a, i3, a, f6.3)', 'step', it, '   time (s) =', time
  end do

  ! 4) exit leaves the loop, cycle skips to the next pass
  fuel = 1.0_wp
  do i = 1, 1000
    if (mod(i, 2) == 0) cycle          ! burn only on odd steps
    fuel = fuel * 0.8_wp
    if (fuel < 0.01_wp) exit           ! stop when less than 1% is left
  end do
  print '(a, i4, a, f7.4)', 'stopped at i =', i, ', fuel left =', fuel
end program loops
