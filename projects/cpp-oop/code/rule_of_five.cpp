// rule_of_five.cpp -- exercise 4: a class that owns a raw array, with all five special members
#include <algorithm>
#include <cstddef>
#include <iostream>
#include <utility>

class Grid {                                       // n x n doubles on the heap
public:
    explicit Grid(std::size_t n) : n_(n), a_(new double[n * n]()) {}
    ~Grid() { delete[] a_; }
    Grid(const Grid& o) : n_(o.n_), a_(new double[o.n_ * o.n_]) {           // deep copy
        std::copy(o.a_, o.a_ + n_ * n_, a_);
    }
    Grid(Grid&& o) noexcept : n_(std::exchange(o.n_, 0)), a_(std::exchange(o.a_, nullptr)) {}   // steal
    Grid& operator=(Grid o) noexcept {             // copy-and-swap: one assignment covers copy and move
        swap(o);
        return *this;
    }
    void swap(Grid& o) noexcept { std::swap(n_, o.n_); std::swap(a_, o.a_); }
    double& operator()(std::size_t i, std::size_t j) { return a_[i * n_ + j]; }
    double operator()(std::size_t i, std::size_t j) const { return a_[i * n_ + j]; }
    std::size_t size() const { return n_; }
private:
    std::size_t n_;
    double* a_;
};

int main() {
    Grid g(3);
    g(1, 1) = 5;
    Grid copy = g;                // deep copy
    copy(1, 1) = 7;
    Grid moved = std::move(g);    // g is now empty
    Grid assigned(1);
    assigned = copy;              // copy-assign through copy-and-swap
    std::cout << "moved(1,1) = " << moved(1, 1) << ", copy(1,1) = " << copy(1, 1)
              << ", assigned(1,1) = " << assigned(1, 1) << ", g.size() = " << g.size() << '\n';
}
