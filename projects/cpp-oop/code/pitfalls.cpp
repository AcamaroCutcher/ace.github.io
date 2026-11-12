// pitfalls.cpp -- four surprises in C++ inheritance, each one demonstrated
#include <iostream>

// 1. A virtual call inside a constructor does not reach the derived class.
struct Widget {
    Widget() { std::cout << "1. constructing: " << kind() << '\n'; }
    virtual ~Widget() = default;
    virtual const char* kind() const { return "Widget"; }
    void show() const { std::cout << "1. afterwards:  " << kind() << '\n'; }
};
struct Button : Widget {
    const char* kind() const override { return "Button"; }
};

// 2. Declaring f(int) in the derived class hides every Base::f, unless you write "using".
struct Base {
    virtual ~Base() = default;
    void f(int) const { std::cout << "Base::f(int)\n"; }
    void f(double) const { std::cout << "Base::f(double)\n"; }
};
struct Hides : Base {
    void f(int) const { std::cout << "Hides::f(int)\n"; }
};
struct Unhides : Base {
    using Base::f;                               // bring Base's overloads back
    void f(int) const { std::cout << "Unhides::f(int)\n"; }
};

// 3. Default arguments come from the static type, even though the function is virtual.
struct Printer {
    virtual ~Printer() = default;
    virtual void print(int n = 1) const { std::cout << "Printer " << n << '\n'; }
};
struct Fancy : Printer {
    void print(int n = 2) const override { std::cout << "Fancy " << n << '\n'; }
};

// 4. A misspelled override silently makes a new function, unless you write "override".
struct Animal {
    virtual ~Animal() = default;
    virtual const char* sound() const { return "..."; }
};
struct Cat : Animal {
    const char* Sound() const { return "meow"; }     // capital S: NOT an override
    // const char* Sound() const override { ... }    // with override this would not compile
};

int main() {
    Button b;
    b.show();

    std::cout << "2. "; Hides{}.f(2.5);              // 2.5 converts to int: Base::f(double) is hidden
    std::cout << "2. "; Unhides{}.f(2.5);

    Fancy fancy;
    const Printer& p = fancy;
    std::cout << "3. "; p.print();                   // Fancy's body with Printer's default argument
    std::cout << "3. "; fancy.print();

    Cat cat;
    const Animal& a = cat;
    std::cout << "4. the cat says " << a.sound() << '\n';
}
