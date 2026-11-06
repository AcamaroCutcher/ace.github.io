! control.f90 -- if / else if and select case
program control
  implicit none
  integer, parameter :: wp = kind(1.0d0)
  real(wp) :: moisture, temperature
  integer  :: category

  moisture = 0.08_wp          ! fuel moisture as a fraction of dry mass
  temperature = 650.0_wp      ! solid temperature (K)

  if (moisture > 0.30_wp) then
    print *, 'Too wet to carry fire'
  else if (moisture > 0.15_wp) then
    print *, 'Burns slowly'
  else
    print *, 'Dry: burns readily'
  end if

  ! the same tests written with the old operators you will see in FIRETEC:  .gt. .ge. .lt. .le. .eq. .ne.
  if (temperature .ge. 600.0_wp .and. moisture .lt. 0.30_wp) print *, 'Above the pyrolysis temperature'

  category = 10
  select case (category)
  case (1:3)
    print *, 'Grass models'
  case (4:7)
    print *, 'Shrub models'
  case (8:10)
    print *, 'Timber models'
  case (11:13)
    print *, 'Slash models'
  case default
    print *, 'Unknown fuel model'
  end select
end program control
