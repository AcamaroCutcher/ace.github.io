! loop_order.f90 -- Fortran stores arrays column by column: loop over the FIRST index innermost
program loop_order
  implicit none
  integer, parameter :: wp = kind(1.0d0), n = 4000
  real(wp), allocatable :: a(:,:)
  integer :: i, j, c0, c1, rate
  real(wp) :: s

  allocate(a(n, n)); a = 1.0_wp

  call system_clock(c0, rate)
  s = 0.0_wp
  do j = 1, n            ! columns outside
    do i = 1, n          ! rows inside: walks through memory in order
      s = s + a(i, j)
    end do
  end do
  call system_clock(c1)
  print '(a, f8.4, a, f14.1)', 'i inner (fast): ', real(c1 - c0, wp) / rate, ' s, sum =', s

  call system_clock(c0)
  s = 0.0_wp
  do i = 1, n            ! rows outside
    do j = 1, n          ! columns inside: jumps n*8 bytes every step
      s = s + a(i, j)
    end do
  end do
  call system_clock(c1)
  print '(a, f8.4, a, f14.1)', 'j inner (slow): ', real(c1 - c0, wp) / rate, ' s, sum =', s
end program loop_order
