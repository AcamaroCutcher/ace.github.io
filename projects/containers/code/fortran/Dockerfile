# Multi-stage build (lesson 03): compile with the full toolchain, ship only the program.

# Stage 1: GCC with gfortran (well over a gigabyte)
FROM gcc:14 AS build
WORKDIR /src
COPY hello.f90 .
RUN gfortran -O2 -o hello hello.f90

# Stage 2: a small Debian with just the Fortran runtime library
FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgfortran5 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/hello /usr/local/bin/hello
ENTRYPOINT ["hello"]
