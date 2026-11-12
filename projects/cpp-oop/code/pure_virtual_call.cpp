// pure_virtual_call.cpp -- calling a pure virtual function during construction
// expect: crash
#include <iostream>

class Device {
public:
    Device() { std::cout << "Device(): initializing\n"; init(); }   // calls a virtual function, indirectly
    virtual ~Device() = default;
    void init() { configure(); }               // looks harmless...
    virtual void configure() = 0;              // ...but while Device() runs, the object is only a Device
};

class Camera : public Device {
public:
    void configure() override { std::cout << "Camera::configure\n"; }
};

int main() {
    Camera c;                                   // aborts: there is no Device::configure to call
    std::cout << "never printed\n";
}
