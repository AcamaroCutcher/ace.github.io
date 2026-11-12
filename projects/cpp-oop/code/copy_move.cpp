// copy_move.cpp -- the five special member functions, each announcing itself
#include <iostream>
#include <string>
#include <utility>
#include <vector>

class Buffer {
public:
    explicit Buffer(std::string name, std::size_t n = 1000) : name_(std::move(name)), data_(n, 0.0) {
        std::cout << "  construct " << name_ << '\n';
    }
    Buffer(const Buffer& o) : name_(o.name_ + "'"), data_(o.data_) {                 // copy: duplicate the data
        std::cout << "  COPY " << o.name_ << " -> " << name_ << " (" << data_.size() << " doubles copied)\n";
    }
    Buffer(Buffer&& o) noexcept : name_(std::move(o.name_)), data_(std::move(o.data_)) {   // move: steal it
        std::cout << "  move " << name_ << " (nothing copied)\n";
        o.name_ = "(moved-from)";
    }
    Buffer& operator=(const Buffer& o) {
        std::cout << "  COPY-assign " << o.name_ << " into " << name_ << '\n';
        data_ = o.data_; return *this;
    }
    Buffer& operator=(Buffer&& o) noexcept {
        std::cout << "  move-assign " << o.name_ << " into " << name_ << '\n';
        data_ = std::move(o.data_); return *this;
    }
    ~Buffer() { std::cout << "  destroy " << name_ << '\n'; }
private:
    std::string name_;
    std::vector<double> data_;
};

Buffer make_buffer() { return Buffer("made"); }   // C++17: returned directly into the caller's variable

int main() {
    std::cout << "1. Buffer b = a;\n";
    { Buffer a("a"); Buffer b = a; }
    std::cout << "2. Buffer b = std::move(a);\n";
    { Buffer a("a"); Buffer b = std::move(a); }
    std::cout << "3. Buffer m = make_buffer();\n";
    { Buffer m = make_buffer(); }
    std::cout << "4. v.push_back(...) three times\n";
    {
        std::vector<Buffer> v;
        v.reserve(3);                      // without reserve, growing the vector would move the old elements too
        v.push_back(Buffer("x"));
        v.emplace_back("y");               // builds in place: no temporary at all
        Buffer z("z");
        v.push_back(z);
    }
}
