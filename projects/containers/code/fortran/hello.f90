! hello.f90 -- a program to compile inside a container (lesson 03)
program hello
  implicit none
  character(len=64) :: name
  if (command_argument_count() > 0) then
    call get_command_argument(1, name)
  else
    name = 'world'
  end if
  print '(3a)', 'Hello, ', trim(name), ', from a container!'
end program hello
