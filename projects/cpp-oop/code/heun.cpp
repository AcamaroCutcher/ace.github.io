// heun.cpp -- exercise 3: a new Stepper (Heun) and a new ODE (logistic), without changing solve()
#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

class ODE {
public:
    virtual ~ODE() = default;
    virtual double f(double t, double y) const = 0;
    virtual double exact(double t) const = 0;
    virtual const char* name() const = 0;
};

class Decay : public ODE {
public:
    double f(double, double y) const override { return -y; }
    double exact(double t) const override { return std::exp(-t); }
    const char* name() const override { return "y' = -y"; }
};

class Logistic : public ODE {                      // y' = y(1 - y), y(0) = 1/2
public:
    double f(double, double y) const override { return y * (1 - y); }
    double exact(double t) const override { return 1 / (1 + std::exp(-t)); }
    const char* name() const override { return "y' = y(1-y)"; }
};

class Stepper {
public:
    virtual ~Stepper() = default;
    virtual double step(const ODE& ode, double t, double y, double h) const = 0;
    virtual const char* name() const = 0;
};

class Euler : public Stepper {
public:
    double step(const ODE& o, double t, double y, double h) const override { return y + h * o.f(t, y); }
    const char* name() const override { return "Euler"; }
};

class Heun : public Stepper {                      // predictor-corrector, second order
public:
    double step(const ODE& o, double t, double y, double h) const override {
        double k1 = o.f(t, y);
        double k2 = o.f(t + h, y + h * k1);
        return y + h / 2 * (k1 + k2);
    }
    const char* name() const override { return "Heun"; }
};

double solve(const ODE& ode, const Stepper& m, double y0, double T, int n) {
    double h = T / n, y = y0;
    for (int i = 0; i < n; ++i) y = m.step(ode, i * h, y, h);
    return y;
}

int main() {
    Decay d; Logistic l;
    Euler e; Heun he;
    const ODE* odes[] = {&d, &l};
    const Stepper* methods[] = {&e, &he};
    std::printf("%-12s %-6s %11s %11s %6s\n", "equation", "method", "err n=10", "err n=20", "ratio");
    for (const ODE* o : odes) {
        double y0 = o->exact(0);
        for (const Stepper* m : methods) {
            double e10 = std::fabs(solve(*o, *m, y0, 1, 10) - o->exact(1));
            double e20 = std::fabs(solve(*o, *m, y0, 1, 20) - o->exact(1));
            std::printf("%-12s %-6s %11.3e %11.3e %6.1f\n", o->name(), m->name(), e10, e20, e10 / e20);
        }
    }
}
