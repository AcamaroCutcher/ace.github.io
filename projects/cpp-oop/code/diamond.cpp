// diamond.cpp -- multiple inheritance and the diamond problem, solved with virtual inheritance
#include <iostream>

struct Device {
    explicit Device(int id) : id(id) { std::cout << "Device(" << id << ")\n"; }
    int id;
};
struct Sensor : virtual Device {                 // virtual base: shared, not duplicated
    Sensor() : Device(-1) { std::cout << "Sensor()\n"; }
};
struct Actuator : virtual Device {
    Actuator() : Device(-2) { std::cout << "Actuator()\n"; }
};
struct Thermostat : Sensor, Actuator {
    Thermostat() : Device(7) { std::cout << "Thermostat()\n"; }   // the most derived class builds the virtual base
};

int main() {
    Thermostat t;
    std::cout << "one Device, id " << t.id << '\n';  // without "virtual", t.id would be ambiguous
    std::cout << "sizeof(Thermostat) = " << sizeof(Thermostat) << " bytes on this machine\n";
}
