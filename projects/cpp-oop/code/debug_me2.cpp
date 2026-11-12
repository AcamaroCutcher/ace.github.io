// debug_me2.cpp -- a square of side 2 and a 3-by-4 triangle: the total should be 4 + 6 = 10. Why is it 4?
#include <cstdio>
#include <vector>

class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const { return 0; }   // default for shapes without a formula
};

class Square : public Shape {
public:
    explicit Square(double s) : s_(s) {}
    double area() const override { return s_ * s_; }
private:
    double s_;
};

class Triangle : public Shape {
public:
    Triangle(double b, double h) : b_(b), h_(h) {}
    double area() {
        return 0.5 * b_ * h_;
    }
private:
    double b_, h_;
};

double total(const std::vector<Shape*>& shapes) {
    double sum = 0;
    for (const Shape* s : shapes) {
        double a = s->area();
        sum += a;
    }
    return sum;
}

int main() {
    Square sq(2.0);
    Triangle tr(3.0, 4.0);
    std::vector<Shape*> shapes = {&sq, &tr};
    double t = total(shapes);
    std::printf("total area = %g\n", t);
    return 0;
}
