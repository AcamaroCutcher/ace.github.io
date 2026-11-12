// lifetime.cpp -- the order in which the parts of an object are built and destroyed
#include <iostream>
#include <string>

struct Logger {                       // a member that announces its own lifetime
    std::string name;
    explicit Logger(std::string n) : name(std::move(n)) { std::cout << "  + " << name << '\n'; }
    ~Logger() { std::cout << "  - " << name << '\n'; }
};

class Base {
public:
    Base() { std::cout << "Base()\n"; }
    virtual ~Base() { std::cout << "~Base()\n"; }    // virtual: see the section on destructors
};

class Derived : public Base {
    Logger log_{"member log_"};
public:
    Derived() { std::cout << "Derived()\n"; }
    ~Derived() override { std::cout << "~Derived()\n"; }
};

int main() {
    std::cout << "-- entering scope\n";
    {
        Derived d;                    // base first, then members, then the constructor body
        std::cout << "-- using d\n";
    }                                 // destroyed here, in exactly the reverse order
    std::cout << "-- left scope\n";

    std::cout << "-- on the heap, through a Base*\n";
    Base* p = new Derived;
    delete p;                         // ~Derived runs only because ~Base is virtual
}
