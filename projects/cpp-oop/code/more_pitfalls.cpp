// more_pitfalls.cpp -- three more surprises, demonstrated
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>

// 5. Catching an exception by value slices it: the derived part is lost.
struct AppError : std::runtime_error {
    int code;
    AppError(const std::string& m, int c) : std::runtime_error(m), code(c) {}
};

// 6. A derived member with the same name hides the base member; there are now two.
struct Base { int value = 1; virtual ~Base() = default; };
struct Derived : Base { int value = 2; };

// 7. Copying a class that holds a raw owning pointer copies the pointer, not the object.
struct Holder {
    int* p;
    explicit Holder(int v) : p(new int(v)) {}
    ~Holder() { delete p; }
    // Holder(const Holder&) and operator= are generated: they copy p itself -> two owners, double delete
};
struct SafeHolder {
    std::unique_ptr<int> p;                     // the fix: let a smart pointer own it
    explicit SafeHolder(int v) : p(std::make_unique<int>(v)) {}
    SafeHolder(const SafeHolder& o) : p(std::make_unique<int>(*o.p)) {}   // deep copy, if copying makes sense
};

int main() {
    try { throw AppError("disk full", 28); }
    catch (std::runtime_error e) {             // by value: e is a plain runtime_error copy
        std::cout << "5. caught by value: " << e.what() << ", is it an AppError? "
                  << (dynamic_cast<AppError*>(&e) ? "yes" : "no") << '\n';
    }
    try { throw AppError("disk full", 28); }
    catch (const std::runtime_error& e) {      // by reference: the real object
        auto* app = dynamic_cast<const AppError*>(&e);
        std::cout << "5. caught by reference: is it an AppError? " << (app ? "yes, code " + std::to_string(app->code) : "no") << '\n';
    }

    Derived d;
    Base& b = d;
    std::cout << "6. d.value = " << d.value << ", b.value = " << b.value << ", d.Base::value = " << d.Base::value << '\n';

    SafeHolder s1(7);
    SafeHolder s2 = s1;
    *s2.p = 8;
    std::cout << "7. deep copy: s1 = " << *s1.p << ", s2 = " << *s2.p << '\n';
    // Holder h1(7); Holder h2 = h1;           // compiles, then crashes with a double delete at the end of main
}
