// classes.cpp -- a class bundles data with the functions that keep it valid
#include <iostream>
#include <stdexcept>

class Rectangle {
public:                                   // the interface: what users of the class may call
    Rectangle(double w, double h) : width_(w), height_(h) {   // constructor with a member initializer list
        if (w <= 0 || h <= 0) throw std::invalid_argument("sides must be positive");
        ++count_;
    }
    double area() const { return width_ * height_; }          // const: promises not to change the object
    double perimeter() const { return 2 * (width_ + height_); }
    void scale(double f) {
        if (f <= 0) throw std::invalid_argument("scale factor must be positive");
        width_ *= f;
        height_ *= f;
    }
    double width() const { return width_; }                   // read access without write access
    static int count() { return count_; }                     // static: belongs to the class, not an object

private:                                  // the implementation: only member functions can touch it
    double width_, height_;
    static inline int count_ = 0;         // C++17 inline static member
};

int main() {
    Rectangle r(3, 4);
    std::cout << "area " << r.area() << ", perimeter " << r.perimeter() << '\n';
    r.scale(2);
    std::cout << "after scale(2): width " << r.width() << ", area " << r.area() << '\n';
    // r.width_ = -1;          // error: 'width_' is a private member of 'Rectangle'

    try {
        Rectangle bad(-1, 2);  // the constructor refuses to build an invalid object
    } catch (const std::invalid_argument& e) {
        std::cout << "rejected: " << e.what() << '\n';
    }

    const Rectangle sq(5, 5);
    std::cout << "square area " << sq.area() << '\n';   // fine: area() is const
    // sq.scale(2);            // error: scale() is not const, sq is
    std::cout << "rectangles built: " << Rectangle::count() << '\n';
}
