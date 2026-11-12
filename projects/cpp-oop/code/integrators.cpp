// integrators.cpp -- abstract classes in numerical work: one solver loop, interchangeable methods
#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

class ODE {                                         // dy/dt = f(t, y)
public:
    virtual ~ODE() = default;
    virtual double f(double t, double y) const = 0;
    virtual double exact(double t) const = 0;       // for measuring the error
};

class Decay : public ODE {                          // y' = -k y,  y(0) = 1
public:
    explicit Decay(double k) : k_(k) {}
    double f(double, double y) const override { return -k_ * y; }
    double exact(double t) const override { return std::exp(-k_ * t); }
private:
    double k_;
};

class Stepper {                                     // one step of a time-integration method
public:
    virtual ~Stepper() = default;
    virtual double step(const ODE& ode, double t, double y, double h) const = 0;
    virtual const char* name() const = 0;
};

class Euler : public Stepper {
public:
    double step(const ODE& ode, double t, double y, double h) const override { return y + h * ode.f(t, y); }
    const char* name() const override { return "Euler"; }
};

class Midpoint : public Stepper {
public:
    double step(const ODE& ode, double t, double y, double h) const override {
        double k1 = ode.f(t, y);
        return y + h * ode.f(t + h / 2, y + h / 2 * k1);
    }
    const char* name() const override { return "Midpoint (RK2)"; }
};

class RK4 : public Stepper {
public:
    double step(const ODE& ode, double t, double y, double h) const override {
        double k1 = ode.f(t, y);
        double k2 = ode.f(t + h / 2, y + h / 2 * k1);
        double k3 = ode.f(t + h / 2, y + h / 2 * k2);
        double k4 = ode.f(t + h, y + h * k3);
        return y + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    const char* name() const override { return "Runge-Kutta 4"; }
};

// The solver knows nothing about which method or which equation it runs.
double solve(const ODE& ode, const Stepper& method, double y0, double T, int n) {
    double h = T / n, y = y0;
    for (int i = 0; i < n; ++i) y = method.step(ode, i * h, y, h);
    return y;
}

int main() {
    Decay ode(1.0);
    std::vector<std::unique_ptr<Stepper>> methods;
    methods.push_back(std::make_unique<Euler>());
    methods.push_back(std::make_unique<Midpoint>());
    methods.push_back(std::make_unique<RK4>());

    std::printf("%-16s %12s %12s %8s\n", "method", "err (n=10)", "err (n=20)", "ratio");
    for (const auto& m : methods) {
        double e10 = std::fabs(solve(ode, *m, 1.0, 1.0, 10) - ode.exact(1.0));
        double e20 = std::fabs(solve(ode, *m, 1.0, 1.0, 20) - ode.exact(1.0));
        std::printf("%-16s %12.3e %12.3e %8.1f\n", m->name(), e10, e20, e10 / e20);
    }
}
