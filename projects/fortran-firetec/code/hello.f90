! hello.f90 -- the smallest complete Fortran program
! build:  gfortran hello.f90 -o hello
! run:    ./hello
program hello
  implicit none                   ! every variable must be declared (always use this)
  print *, 'Hello from Fortran!'
end program hello
