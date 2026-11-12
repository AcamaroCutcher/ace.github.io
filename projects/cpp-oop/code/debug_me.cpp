// debug_me.cpp -- the total should be pi + 6 = 9.14159. It is not. Why?
#include <cstdio>
#include <vector>

class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
};

class Circle : public Shape {
public:
    explicit Circle(double r) : r_(r) {}
    double area() const override { return 3.14159 * r_ * r_; }
private:
    double r_;
};

class Rectangle : public Shape {
public:
    Rectangle(double w, double h) : w_(w), h_(w) {}
    double area() const override {
        double a = w_ * h_;
        return a;
    }
private:
    double w_, h_;
};

double total_area(const std::vector<Shape*>& shapes) {
    double total = 0;
    for (const Shape* s : shapes) {
        double a = s->area();
        total += a;
    }
    return total;
}

int main() {
    Circle c(1.0);
    Rectangle r(2.0, 3.0);
    std::vector<Shape*> shapes = {&c, &r};
    double t = total_area(shapes);
    std::printf("total area = %g\n", t);
    return 0;
}
