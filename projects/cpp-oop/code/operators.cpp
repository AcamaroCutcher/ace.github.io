// operators.cpp -- operator overloading makes a small value class read like math
#include <cmath>
#include <iostream>

class Vec2 {
public:
    constexpr Vec2(double x = 0, double y = 0) : x_(x), y_(y) {}
    double x() const { return x_; }
    double y() const { return y_; }
    double norm() const { return std::hypot(x_, y_); }

    Vec2& operator+=(const Vec2& o) { x_ += o.x_; y_ += o.y_; return *this; }   // compound: a member, returns *this
    Vec2& operator*=(double k) { x_ *= k; y_ *= k; return *this; }
    Vec2 operator-() const { return {-x_, -y_}; }                             // unary minus

    friend bool operator==(const Vec2& a, const Vec2& b) { return a.x_ == b.x_ && a.y_ == b.y_; }
    friend std::ostream& operator<<(std::ostream& out, const Vec2& v) {        // printing: must be a non-member
        return out << '(' << v.x_ << ", " << v.y_ << ')';
    }
private:
    double x_, y_;
};

// binary operators as non-members, written with the compound ones: both operands are treated alike
inline Vec2 operator+(Vec2 a, const Vec2& b) { return a += b; }
inline Vec2 operator-(Vec2 a, const Vec2& b) { return a += -b; }
inline Vec2 operator*(Vec2 v, double k) { return v *= k; }
inline Vec2 operator*(double k, Vec2 v) { return v *= k; }    // so that 2.0 * v works too
inline double dot(const Vec2& a, const Vec2& b) { return a.x() * b.x() + a.y() * b.y(); }

int main() {
    Vec2 p(1, 2), v(0.5, -1);
    double dt = 0.1;
    for (int step = 0; step < 3; ++step) {
        p += v * dt;                       // reads like the physics: p <- p + v dt
        std::cout << "step " << step + 1 << ": p = " << p << '\n';
    }
    Vec2 a(3, 4);
    std::cout << "|a| = " << a.norm() << ", 2*a = " << 2.0 * a << ", -a = " << -a << '\n';
    std::cout << "a.b = " << dot(a, Vec2(1, 1)) << ", a == (3,4)? " << std::boolalpha << (a == Vec2(3, 4)) << '\n';
}
