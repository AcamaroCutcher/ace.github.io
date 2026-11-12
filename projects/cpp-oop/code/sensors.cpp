// sensors.cpp -- exercise 2: an abstract Sensor interface and a table of readings
#include <cstdio>
#include <memory>
#include <string>
#include <vector>

class Sensor {
public:
    virtual ~Sensor() = default;
    virtual std::string name() const = 0;
    virtual double read() = 0;                     // not const: reading may change internal state
    virtual const char* unit() const = 0;
};

class Thermometer : public Sensor {
public:
    explicit Thermometer(std::string where) : where_(std::move(where)) {}
    std::string name() const override { return "temperature (" + where_ + ")"; }
    double read() override { t_ += 0.5; return t_; }   // a fake, slowly warming room
    const char* unit() const override { return "C"; }
private:
    std::string where_;
    double t_ = 20;
};

class WindVane : public Sensor {
public:
    std::string name() const override { return "wind speed"; }
    double read() override { static const double seq[] = {3.2, 4.8, 2.1}; return seq[i_++ % 3]; }
    const char* unit() const override { return "m/s"; }
private:
    int i_ = 0;
};

void table(std::vector<std::unique_ptr<Sensor>>& sensors, int rounds) {
    for (int r = 1; r <= rounds; ++r)
        for (auto& s : sensors) std::printf("round %d  %-22s %6.1f %s\n", r, s->name().c_str(), s->read(), s->unit());
}

int main() {
    std::vector<std::unique_ptr<Sensor>> sensors;
    sensors.push_back(std::make_unique<Thermometer>("lab"));
    sensors.push_back(std::make_unique<WindVane>());
    table(sensors, 2);
}
