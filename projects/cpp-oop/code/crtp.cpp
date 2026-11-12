// crtp.cpp -- the Curiously Recurring Template Pattern: shared code in a base, no virtual calls
#include <iostream>

template <typename Derived>
class Shape {                                   // the base knows its derived type as a template parameter
public:
    void describe() const {
        const auto& self = static_cast<const Derived&>(*this);   // safe: Derived really derives from Shape<Derived>
        std::cout << self.name() << ": area " << self.area() << ", twice " << 2 * self.area() << '\n';
    }
};

class Circle : public Shape<Circle> {
public:
    explicit Circle(double r) : r_(r) {}
    double area() const { return 3.14159 * r_ * r_; }
    const char* name() const { return "circle"; }
private:
    double r_;
};

class Square : public Shape<Square> {
public:
    explicit Square(double s) : s_(s) {}
    double area() const { return s_ * s_; }
    const char* name() const { return "square"; }
private:
    double s_;
};

template <typename D>
void show(const Shape<D>& s) { s.describe(); }  // generic, but every call is resolved at compile time

int main() {
    show(Circle(1));
    show(Square(3));
    // Circle and Square share no common type: you cannot put both in one std::vector<Shape<?>>.
}
