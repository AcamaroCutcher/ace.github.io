// templates.cpp -- static polymorphism: the type is fixed at compile time, no vtable needed
#include <iostream>
#include <vector>

struct Circle { double r; double area() const { return 3.14159 * r * r; } };   // no common base class
struct Rect   { double w, h; double area() const { return w * h; } };

template <typename T>                       // works for any T with an area() member
double total_area(const std::vector<T>& shapes) {
    double t = 0;
    for (const T& s : shapes) t += s.area();    // resolved at compile time and usually inlined
    return t;
}

template <typename... Ts>                   // a variadic template: any number of arguments of any types
double sum_areas(const Ts&... shapes) { return (shapes.area() + ... + 0.0); }   // C++17 fold expression

int main() {
    std::vector<Circle> circles = {{1}, {2}};
    std::vector<Rect> rects = {{2, 3}, {1, 1}};
    std::cout << "circles " << total_area(circles) << ", rects " << total_area(rects) << '\n';
    std::cout << "mixed, fixed at compile time: " << sum_areas(Circle{1}, Rect{2, 3}, Rect{1, 1}) << '\n';
    // total_area(std::vector<int>{1, 2});   // error: 'int' has no member 'area' -- found at compile time
}
