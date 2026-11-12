// layout.cpp -- what an object looks like in memory
#include <cstddef>
#include <iostream>

struct Point { double x, y; };                                   // plain data: just two doubles
struct Shape { virtual ~Shape() = default; virtual double area() const = 0; };
struct Circle : Shape { double r = 1; double area() const override { return 3.14159 * r * r; } };
struct Rect : Shape { double w = 1, h = 2; double area() const override { return w * h; } };

struct Drawable { virtual ~Drawable() = default; virtual void draw() const {} };
struct Serializable { virtual ~Serializable() = default; virtual void save() const {} };
struct Sprite : Drawable, Serializable { double x = 0; };      // two bases, two vptrs

int main() {
    std::cout << "sizeof(Point)  = " << sizeof(Point) << "   (2 doubles)\n";
    std::cout << "sizeof(Shape)  = " << sizeof(Shape) << "    (just the vptr)\n";
    std::cout << "sizeof(Circle) = " << sizeof(Circle) << "   (vptr + r)\n";
    std::cout << "sizeof(Rect)   = " << sizeof(Rect) << "   (vptr + w + h)\n";
    std::cout << "sizeof(Sprite) = " << sizeof(Sprite) << "   (2 vptrs + x)\n";

    Circle c;
    const char* base = reinterpret_cast<const char*>(&c);
    std::cout << "offset of r in Circle: " << reinterpret_cast<const char*>(&c.r) - base << " bytes\n";
    std::cout << "Shape part of c starts at offset " << reinterpret_cast<const char*>(static_cast<Shape*>(&c)) - base << '\n';

    Sprite s;
    const char* sb = reinterpret_cast<const char*>(&s);
    std::cout << "Drawable part of a Sprite at offset " << reinterpret_cast<const char*>(static_cast<Drawable*>(&s)) - sb << '\n';
    std::cout << "Serializable part of a Sprite at offset " << reinterpret_cast<const char*>(static_cast<Serializable*>(&s)) - sb
              << "  (converting the pointer adjusts its value)\n";
}
