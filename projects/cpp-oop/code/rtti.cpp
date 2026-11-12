// rtti.cpp -- asking an object what it really is: dynamic_cast and typeid
#include <iostream>
#include <memory>
#include <typeinfo>
#include <vector>

struct Shape { virtual ~Shape() = default; };
struct Circle : Shape { double r = 1; };
struct Rect : Shape { double w = 2, h = 3; };
struct Square : Rect {};

int main() {
    std::vector<std::unique_ptr<Shape>> v;
    v.push_back(std::make_unique<Circle>());
    v.push_back(std::make_unique<Rect>());
    v.push_back(std::make_unique<Square>());

    for (const auto& p : v) {
        // dynamic_cast to a pointer: nullptr when the object is not of that type (or derived from it)
        if (auto r = dynamic_cast<const Rect*>(p.get()))
            std::cout << "a Rect (or derived) with area " << r->w * r->h;
        else
            std::cout << "not a Rect";
        // typeid compares exact dynamic types
        const Shape& ref = *p;
        std::cout << (typeid(ref) == typeid(Square) ? ", exactly a Square" : "") << '\n';
    }

    // dynamic_cast to a reference cannot return nullptr, so it throws
    try {
        Shape& s = *v[0];
        Rect& r = dynamic_cast<Rect&>(s);
        std::cout << r.w << '\n';
    } catch (const std::bad_cast&) {
        std::cout << "bad_cast: the first shape is not a Rect\n";
    }
}
