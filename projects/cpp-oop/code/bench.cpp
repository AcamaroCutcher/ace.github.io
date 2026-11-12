// bench.cpp -- the cost of each kind of polymorphism, measured
// build: -O2
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <memory>
#include <random>
#include <type_traits>
#include <variant>
#include <vector>

struct Shape { virtual ~Shape() = default; virtual double area() const = 0; };
struct Circle : Shape { double r; explicit Circle(double r) : r(r) {} double area() const override { return 3.14159 * r * r; } };
struct Rect : Shape { double w, h; Rect(double w, double h) : w(w), h(h) {} double area() const override { return w * h; } };

struct VC { double r; };
struct VR { double w, h; };
using VShape = std::variant<VC, VR>;

template <class F> double best_ns(F f, int n) {    // best of 15 runs, in nanoseconds per shape
    double best = 1e30;
    for (int rep = 0; rep < 15; ++rep) {
        auto t0 = std::chrono::steady_clock::now();
        volatile double sink = f();
        (void)sink;
        auto t1 = std::chrono::steady_clock::now();
        best = std::min(best, std::chrono::duration<double, std::nano>(t1 - t0).count() / n);
    }
    return best;
}

int main() {
    const int n = 1000000;
    std::mt19937 rng(42);
    std::uniform_real_distribution<double> u(0.5, 2.0);
    std::vector<std::unique_ptr<Shape>> virt;
    std::vector<VShape> var;
    std::vector<VC> circles; std::vector<VR> rects;
    for (int i = 0; i < n; ++i) {
        double a = u(rng), b = u(rng);
        if (rng() % 2) { virt.push_back(std::make_unique<Circle>(a)); var.push_back(VC{a}); circles.push_back(VC{a}); }
        else { virt.push_back(std::make_unique<Rect>(a, b)); var.push_back(VR{a, b}); rects.push_back(VR{a, b}); }
    }
    double t_virt = best_ns([&] { double t = 0; for (auto& s : virt) t += s->area(); return t; }, n);
    double t_var = best_ns([&] {
        double t = 0;
        for (auto& s : var)
            t += std::visit([](const auto& x) {
                if constexpr (std::is_same_v<std::decay_t<decltype(x)>, VC>) return 3.14159 * x.r * x.r;
                else return x.w * x.h;
            }, s);
        return t;
    }, n);
    double t_split = best_ns([&] {
        double t = 0;
        for (auto& c : circles) t += 3.14159 * c.r * c.r;
        for (auto& r : rects) t += r.w * r.h;
        return t;
    }, n);
    std::printf("%-44s %6.2f ns per shape\n", "virtual calls, vector<unique_ptr<Shape>>", t_virt);
    std::printf("%-44s %6.2f ns per shape\n", "std::visit, vector<variant<...>>", t_var);
    std::printf("%-44s %6.2f ns per shape\n", "one vector per type, no dispatch at all", t_split);
}
