// variant.cpp -- a closed set of types without inheritance: std::variant and std::visit
#include <cmath>
#include <iostream>
#include <string>
#include <variant>
#include <vector>

struct Circle { double r; };
struct Rect { double w, h; };
struct Triangle { double a, b, c; };
using Shape = std::variant<Circle, Rect, Triangle>;     // a Shape is exactly one of these

template <class... Fs> struct overloaded : Fs... { using Fs::operator()...; };   // one lambda per type
template <class... Fs> overloaded(Fs...) -> overloaded<Fs...>;

double area(const Shape& s) {
    return std::visit(overloaded{
        [](const Circle& c) { return 3.14159 * c.r * c.r; },
        [](const Rect& r) { return r.w * r.h; },
        [](const Triangle& t) { double p = (t.a + t.b + t.c) / 2; return std::sqrt(p * (p - t.a) * (p - t.b) * (p - t.c)); },
    }, s);                                              // forget a type and this does not compile
}

std::string name(const Shape& s) {
    return std::visit(overloaded{
        [](const Circle&) { return std::string("circle"); },
        [](const Rect&) { return std::string("rect"); },
        [](const Triangle&) { return std::string("triangle"); },
    }, s);
}

int main() {
    std::vector<Shape> shapes = {Circle{1}, Rect{2, 3}, Triangle{3, 4, 5}};   // values, not pointers
    for (const auto& s : shapes) std::cout << name(s) << ": " << area(s) << '\n';
    std::cout << "sizeof(Shape) = " << sizeof(Shape) << " bytes (the largest alternative + a tag)\n";
}
