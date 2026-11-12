// ellipse.cpp -- exercise 1: add an Ellipse to the abstract Shape hierarchy
#include <cmath>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

constexpr double pi = 3.141592653589793;

class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
    virtual double perimeter() const = 0;
    virtual std::string name() const = 0;
    void describe() const { std::cout << name() << ": area " << area() << ", perimeter " << perimeter() << '\n'; }
};

class Ellipse : public Shape {
public:
    Ellipse(double a, double b) : a_(a), b_(b) {}
    double area() const override { return pi * a_ * b_; }
    double perimeter() const override {            // Ramanujan's second approximation
        double h = (a_ - b_) * (a_ - b_) / ((a_ + b_) * (a_ + b_));
        return pi * (a_ + b_) * (1 + 3 * h / (10 + std::sqrt(4 - 3 * h)));
    }
    std::string name() const override { return "ellipse"; }
protected:
    double a_, b_;
};

class Circle : public Ellipse {                    // safe here: shapes cannot be changed after construction
public:
    explicit Circle(double r) : Ellipse(r, r) {}
    std::string name() const override { return "circle"; }
};

int main() {
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Ellipse>(2, 1));
    shapes.push_back(std::make_unique<Circle>(1));
    for (const auto& s : shapes) s->describe();    // describe() did not change at all
    std::cout << "circle check: 2*pi = " << 2 * pi << '\n';
}
