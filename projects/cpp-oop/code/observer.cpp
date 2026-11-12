// observer.cpp -- Observer: objects subscribe to events through an abstract interface
#include <iostream>
#include <string>
#include <vector>

class Observer {                                   // anything that wants to hear about new temperatures
public:
    virtual ~Observer() = default;
    virtual void update(double temperature) = 0;
};

class Sensor {                                     // the subject: knows only the interface, not the observers' types
public:
    void subscribe(Observer* o) { observers_.push_back(o); }
    void measure(double t) {
        std::cout << "sensor reads " << t << '\n';
        for (Observer* o : observers_) o->update(t);
    }
private:
    std::vector<Observer*> observers_;             // non-owning: observers must outlive the sensor (or unsubscribe)
};

class Display : public Observer {
public:
    void update(double t) override { std::cout << "  display: " << t << " C\n"; }
};

class Alarm : public Observer {
public:
    explicit Alarm(double limit) : limit_(limit) {}
    void update(double t) override { if (t > limit_) std::cout << "  ALARM: above " << limit_ << " C\n"; }
private:
    double limit_;
};

class Average : public Observer {
public:
    void update(double t) override { sum_ += t; ++n_; std::cout << "  running mean: " << sum_ / n_ << '\n'; }
private:
    double sum_ = 0;
    int n_ = 0;
};

int main() {
    Sensor s;
    Display d; Alarm a(30); Average m;
    s.subscribe(&d); s.subscribe(&a); s.subscribe(&m);
    for (double t : {21.5, 28.0, 33.5}) s.measure(t);
}
