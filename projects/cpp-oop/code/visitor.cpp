// visitor.cpp -- Visitor: add new operations to a fixed class hierarchy without editing it (double dispatch)
#include <cmath>
#include <iostream>
#include <memory>
#include <vector>

class Circle; class Rect;

class ShapeVisitor {                               // one visit() per concrete class
public:
    virtual ~ShapeVisitor() = default;
    virtual void visit(const Circle&) = 0;
    virtual void visit(const Rect&) = 0;
};

class Shape {
public:
    virtual ~Shape() = default;
    virtual void accept(ShapeVisitor& v) const = 0;   // first dispatch: on the shape's type
};

class Circle : public Shape {
public:
    explicit Circle(double r) : r(r) {}
    void accept(ShapeVisitor& v) const override { v.visit(*this); }   // second dispatch: overload picks visit(const Circle&)
    double r;
};

class Rect : public Shape {
public:
    Rect(double w, double h) : w(w), h(h) {}
    void accept(ShapeVisitor& v) const override { v.visit(*this); }
    double w, h;
};

// Two operations, written later, without touching Circle or Rect:
class Perimeter : public ShapeVisitor {
public:
    double total = 0;
    void visit(const Circle& c) override { total += 2 * 3.14159 * c.r; }
    void visit(const Rect& r) override { total += 2 * (r.w + r.h); }
};

class SvgWriter : public ShapeVisitor {
public:
    void visit(const Circle& c) override { std::cout << "<circle r=\"" << c.r << "\"/>\n"; }
    void visit(const Rect& r) override { std::cout << "<rect width=\"" << r.w << "\" height=\"" << r.h << "\"/>\n"; }
};

int main() {
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Circle>(1));
    shapes.push_back(std::make_unique<Rect>(2, 3));

    Perimeter p;
    for (const auto& s : shapes) s->accept(p);
    std::cout << "total perimeter " << p.total << '\n';

    SvgWriter svg;
    for (const auto& s : shapes) s->accept(svg);
}
