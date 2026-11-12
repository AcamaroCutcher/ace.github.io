// clone.cpp -- copying objects you only know through a base pointer: the virtual clone idiom
#include <iostream>
#include <memory>
#include <vector>

class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
    virtual void scale(double k) = 0;
    std::unique_ptr<Shape> clone() const { return std::unique_ptr<Shape>(do_clone()); }   // non-virtual wrapper
private:
    virtual Shape* do_clone() const = 0;          // each class copies itself, so the real type is kept
};

class Circle : public Shape {
public:
    explicit Circle(double r) : r_(r) {}
    double area() const override { return 3.14159 * r_ * r_; }
    void scale(double k) override { r_ *= k; }
private:
    Circle* do_clone() const override { return new Circle(*this); }   // covariant return type: Circle*, not Shape*
    double r_;
};

class Rect : public Shape {
public:
    Rect(double w, double h) : w_(w), h_(h) {}
    double area() const override { return w_ * h_; }
    void scale(double k) override { w_ *= k; h_ *= k; }
private:
    Rect* do_clone() const override { return new Rect(*this); }
    double w_, h_;
};

using Scene = std::vector<std::unique_ptr<Shape>>;

Scene deep_copy(const Scene& s) {                 // a vector of unique_ptr cannot be copied directly
    Scene out;
    for (const auto& p : s) out.push_back(p->clone());
    return out;
}

double total(const Scene& s) { double t = 0; for (const auto& p : s) t += p->area(); return t; }

int main() {
    Scene a;
    a.push_back(std::make_unique<Circle>(1));
    a.push_back(std::make_unique<Rect>(2, 3));
    Scene b = deep_copy(a);
    for (auto& p : b) p->scale(2);                // changing the copy...
    std::cout << "original total " << total(a) << '\n';   // ...leaves the original alone
    std::cout << "scaled copy total " << total(b) << '\n';
}
