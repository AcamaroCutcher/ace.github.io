// inherit_ctors.cpp -- reusing base constructors, and calling the base version of a function
#include <iostream>
#include <string>

class Account {
public:
    Account(std::string owner, double balance) : owner_(std::move(owner)), balance_(balance) {}
    explicit Account(std::string owner) : Account(std::move(owner), 0.0) {}   // delegating constructor
    virtual ~Account() = default;
    virtual void print() const { std::cout << owner_ << ": " << balance_; }
    void deposit(double x) { balance_ += x; }
protected:
    double balance() const { return balance_; }
private:
    std::string owner_;
    double balance_;
};

class Savings : public Account {
public:
    using Account::Account;                      // inherit both constructors instead of rewriting them
    void print() const override {
        Account::print();                        // reuse the base version, then add to it
        std::cout << " (savings, interest at 3%: " << balance() * 0.03 << ")";
    }
};

int main() {
    Savings s("Ada", 1000);
    s.deposit(200);
    s.print(); std::cout << '\n';
    Savings empty("Grace");
    const Account& a = empty;
    a.print(); std::cout << '\n';
}
