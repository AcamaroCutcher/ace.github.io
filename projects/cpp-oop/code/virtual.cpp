// virtual.cpp -- virtual functions: the call is decided by the object, not by the pointer type
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class Shape {
public:
    explicit Shape(std::string name) : name_(std::move(name)) {}
    virtual ~Shape() = default;                     // any class with virtual functions needs this
    std::string name() const { return name_; }
    virtual double area() const { return 0.0; }     // virtual: derived classes may override
private:
    std::string name_;
};

class Circle : public Shape {
public:
    explicit Circle(double r) : Shape("circle"), r_(r) {}
    double area() const override { return 3.141592653589793 * r_ * r_; }   // override: checked by the compiler
private:
    double r_;
};

class Rectangle : public Shape {
public:
    Rectangle(double w, double h) : Shape("rectangle"), w_(w), h_(h) {}
    double area() const override { return w_ * h_; }
private:
    double w_, h_;
};

void report(const Shape& s) { std::cout << "report: " << s.name() << " has area " << s.area() << '\n'; }

int main() {
    Circle c(2);
    report(c);                                      // now Circle::area runs

    std::vector<std::unique_ptr<Shape>> shapes;     // one container, many concrete types
    shapes.push_back(std::make_unique<Circle>(1));
    shapes.push_back(std::make_unique<Rectangle>(2, 3));
    shapes.push_back(std::make_unique<Shape>("blob"));
    double total = 0;
    for (const auto& s : shapes) {
        std::cout << "  " << s->name() << ": " << s->area() << '\n';
        total += s->area();
    }
    std::cout << "total area " << total << '\n';

    Shape copy = c;                                 // slicing: only the Shape part is copied
    std::cout << "sliced copy: " << copy.name() << " has area " << copy.area() << '\n';
}
