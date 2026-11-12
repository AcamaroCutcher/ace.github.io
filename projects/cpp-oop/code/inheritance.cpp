// inheritance.cpp -- a derived class reuses and extends a base class (and a trap)
#include <iostream>
#include <string>

class Shape {
public:
    explicit Shape(std::string name) : name_(std::move(name)) {}
    std::string name() const { return name_; }
    double area() const { return 0.0; }        // a generic shape has no formula... so it returns 0?
protected:
    std::string name_;                         // derived classes may use it; outside code may not
};

class Circle : public Shape {                  // public inheritance: a Circle IS-A Shape
public:
    explicit Circle(double r) : Shape("circle"), r_(r) {}     // build the Shape part first
    double area() const { return 3.141592653589793 * r_ * r_; }   // hides Shape::area (not virtual!)
    double radius() const { return r_; }
    void rename(const std::string& n) { name_ = n; }          // protected member: allowed here
private:
    double r_;
};

void report(const Shape& s) {                  // accepts any Shape, including a Circle
    std::cout << "report: " << s.name() << " has area " << s.area() << '\n';
}

int main() {
    Circle c(2);
    std::cout << c.name() << " of radius " << c.radius() << " has area " << c.area() << '\n';
    c.rename("big circle");
    report(c);                                 // compiles, but prints area 0: Shape::area was called
    std::cout << "c.Shape::area() = " << c.Shape::area() << ", c.area() = " << c.area() << '\n';
}
