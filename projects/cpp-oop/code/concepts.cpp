// concepts.cpp -- C++20 concepts: name the requirements a template places on its type
// build: -std=c++20
#include <concepts>
#include <iostream>
#include <vector>

template <typename T>
concept HasArea = requires(const T& s) {
    { s.area() } -> std::convertible_to<double>;    // T must have area() returning something like a double
};

struct Circle { double r; double area() const { return 3.14159 * r * r; } };
struct Rect { double w, h; double area() const { return w * h; } };
struct Label { const char* text; };                 // no area()

template <HasArea T>
double total_area(const std::vector<T>& v) {
    double t = 0;
    for (const auto& s : v) t += s.area();
    return t;
}

int main() {
    std::cout << total_area(std::vector<Circle>{{1}, {1}}) << '\n';
    std::cout << total_area(std::vector<Rect>{{2, 3}}) << '\n';
    std::cout << std::boolalpha << "Label has an area? " << HasArea<Label> << '\n';
    // total_area(std::vector<Label>{{"x"}});   // error: constraints not satisfied: 'HasArea<Label>'
}
