! arrays.f90 -- allocatable arrays, custom bounds (halo cells), whole-array operations and intrinsics
program arrays
  implicit none
  integer, parameter :: wp = kind(1.0d0)
  integer, parameter :: np = 6, mp = 4, l = 3, ih = 1     ! local grid and halo width, named as in FIRETEC
  integer, parameter :: iuvel = 1, ivvel = 2, iwvel = 3, itheta = 4, nv = 4
  real(wp), allocatable :: rhof(:,:,:), xv(:,:,:,:), t(:)
  real(wp) :: v(5) = [3.0_wp, -1.0_wp, 4.0_wp, 1.0_wp, -5.0_wp]
  integer :: k

  ! 1) bounds need not start at 1: here 0 and np+1 are ghost (halo) cells around the interior 1..np
  allocate(rhof(1-ih:np+ih, 1-ih:mp+ih, l))
  rhof = 0.0_wp                     ! whole-array assignment
  rhof(1:np, 1:mp, 1) = 0.7_wp       ! a section: interior cells of the bottom layer
  print *, 'lbound, ubound: ', lbound(rhof), ubound(rhof)
  print *, 'shape:          ', shape(rhof)
  print '(a, f6.2, a)', 'fuel in the bottom layer: ', sum(rhof(:,:,1)) * 2.0_wp * 2.0_wp * 1.0_wp, ' kg (2x2x1 m cells)'

  ! 2) one array for several fields, with named index "pointers", like FIRETEC's xv(i,j,k,nv)
  allocate(xv(np, mp, l, nv))
  xv(:,:,:,iuvel) = 5.0_wp
  xv(:,:,:,ivvel) = 0.0_wp
  xv(:,:,:,iwvel) = 0.0_wp
  xv(:,:,:,itheta) = 300.0_wp
  xv(3, 2, 1, itheta) = 900.0_wp     ! one hot cell
  print '(a, f7.1, a, 3i3)', 'hottest theta: ', maxval(xv(:,:,:,itheta)), ' K at ', maxloc(xv(:,:,:,itheta))

  ! 3) elemental arithmetic and masks
  print '(a, 5f6.1)', 'v        =', v
  print '(a, 5f6.1)', 'abs(v)   =', abs(v)
  print '(a, 5f6.1)', 'v**2     =', v**2
  where (v < 0.0_wp) v = 0.0_wp      ! clip negative values, the way densities are kept >= 0
  print '(a, 5f6.1)', 'clipped  =', v
  print '(a, f6.2, a, i2)', 'mean = ', sum(v) / size(v), ', count(v > 0) = ', count(v > 0.0_wp)

  ! 4) array constructors with an implied do loop
  t = [(300.0_wp + 50.0_wp * k, k = 0, 6)]   ! automatic allocation on assignment
  print '(a, 7f7.1)', 'temperatures: ', t
  print '(a, 7l2)', 'above 400 K:  ', t > 400.0_wp

  ! 5) reshape and matrix layout: memory is filled column by column
  print '(a)', 'reshape([1..6], [2,3]) row by row:'
  block
    integer :: m(2, 3), r
    m = reshape([(k, k = 1, 6)], [2, 3])
    do r = 1, 2
      print '(3i4)', m(r, :)
    end do
  end block

  deallocate(rhof, xv)
end program arrays
