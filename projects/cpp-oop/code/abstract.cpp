// abstract.cpp -- an abstract base class states what every shape must provide
#include <algorithm>
#include <cmath>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

constexpr double pi = 3.141592653589793;

class Shape {                                       // abstract: it has pure virtual functions
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;                // "= 0": no implementation here; derived classes must provide one
    virtual double perimeter() const = 0;
    virtual std::string name() const = 0;

    void describe() const {                         // ordinary function built on the pure virtual ones
        std::cout << name() << ": area " << area() << ", perimeter " << perimeter() << '\n';
    }
};

class Circle : public Shape {
public:
    explicit Circle(double r) : r_(r) {}
    double area() const override { return pi * r_ * r_; }
    double perimeter() const override { return 2 * pi * r_; }
    std::string name() const override { return "circle"; }
private:
    double r_;
};

class Rectangle : public Shape {
public:
    Rectangle(double w, double h) : w_(w), h_(h) {}
    double area() const override { return w_ * h_; }
    double perimeter() const override { return 2 * (w_ + h_); }
    std::string name() const override { return "rectangle"; }
protected:
    double w_, h_;
};

class Square final : public Rectangle {             // final: nothing may derive from Square
public:
    explicit Square(double s) : Rectangle(s, s) {}
    std::string name() const override { return "square"; }   // reuses Rectangle's area and perimeter
};

class Triangle : public Shape {
public:
    Triangle(double a, double b, double c) : a_(a), b_(b), c_(c) {}
    double area() const override {                  // Heron's formula
        double s = perimeter() / 2;
        return std::sqrt(s * (s - a_) * (s - b_) * (s - c_));
    }
    double perimeter() const override { return a_ + b_ + c_; }
    std::string name() const override { return "triangle"; }
private:
    double a_, b_, c_;
};

int main() {
    // Shape s;                                     // error: variable type 'Shape' is an abstract class
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Circle>(1));
    shapes.push_back(std::make_unique<Rectangle>(2, 3));
    shapes.push_back(std::make_unique<Square>(2));
    shapes.push_back(std::make_unique<Triangle>(3, 4, 5));

    for (const auto& s : shapes) s->describe();

    std::sort(shapes.begin(), shapes.end(),
              [](const auto& a, const auto& b) { return a->area() < b->area(); });
    std::cout << "smallest to largest:";
    for (const auto& s : shapes) std::cout << ' ' << s->name();
    std::cout << '\n';

    const Shape& ref = *shapes.back();              // references to an abstract class are fine
    std::cout << "largest is a " << ref.name() << '\n';
}
