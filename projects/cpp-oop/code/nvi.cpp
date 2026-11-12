// nvi.cpp -- Template Method / Non-Virtual Interface: the base fixes the steps, derived classes fill them in
#include <cmath>
#include <iostream>
#include <string>

class Experiment {
public:
    virtual ~Experiment() = default;
    void run() {                                   // public and NOT virtual: the algorithm cannot be changed
        std::cout << "== " << name() << '\n';
        setup();
        double result = measure();                 // the steps that vary are private virtual functions
        std::cout << "   result " << result << (check(result) ? "  (ok)" : "  (out of range!)") << '\n';
    }
private:
    virtual std::string name() const = 0;
    virtual void setup() {}                        // optional step: a default that may be overridden
    virtual double measure() = 0;
    virtual bool check(double r) const { return std::isfinite(r); }
};

class Pendulum : public Experiment {
    double length_ = 0;
    std::string name() const override { return "pendulum period"; }
    void setup() override { length_ = 2.0; std::cout << "   length set to " << length_ << " m\n"; }
    double measure() override { return 2 * 3.14159 * std::sqrt(length_ / 9.81); }
    bool check(double r) const override { return r > 0 && r < 10; }
};

class FreeFall : public Experiment {
    std::string name() const override { return "free fall from 1 m"; }
    double measure() override { return std::sqrt(2 * 1.0 / 9.81); }
};

int main() {
    Pendulum p;
    FreeFall f;
    for (Experiment* e : {static_cast<Experiment*>(&p), static_cast<Experiment*>(&f)}) e->run();
}
