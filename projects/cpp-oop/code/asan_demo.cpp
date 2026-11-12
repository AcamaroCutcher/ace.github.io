// asan_demo.cpp -- a dangling pointer to a polymorphic object, caught by AddressSanitizer
// build: -fsanitize=address -g -O0
// expect: crash
#include <iostream>
#include <memory>
#include <vector>

struct Shape { virtual ~Shape() = default; virtual double area() const = 0; };
struct Circle : Shape {
    double r;
    explicit Circle(double r) : r(r) {}
    double area() const override { return 3.14159 * r * r; }
};

int main() {
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Circle>(1));
    Shape* first = shapes[0].get();         // a non-owning pointer...
    shapes.clear();                          // ...and the owner destroys the object
    std::cout << first->area() << '\n';      // use after free: reads the vptr of a deleted object
}
