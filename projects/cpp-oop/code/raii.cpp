// raii.cpp -- Resource Acquisition Is Initialization: the destructor releases what the constructor took
#include <cstdio>
#include <iostream>
#include <memory>
#include <stdexcept>

class File {
public:
    File(const char* path, const char* mode) : f_(std::fopen(path, mode)) {
        if (!f_) throw std::runtime_error("cannot open file");
        std::cout << "opened " << path << '\n';
    }
    ~File() { std::fclose(f_); std::cout << "closed\n"; }    // runs on every exit path
    File(const File&) = delete;                              // one owner: copying is forbidden
    File& operator=(const File&) = delete;
    void write(const char* s) { std::fputs(s, f_); }
private:
    std::FILE* f_;
};

void save(bool fail) {
    File out("raii_demo.txt", "w");
    out.write("hello\n");
    if (fail) throw std::runtime_error("something went wrong mid-save");
    out.write("done\n");
}                                                           // ~File() here, or during the throw

int main() {
    save(false);
    try { save(true); } catch (const std::exception& e) { std::cout << "caught: " << e.what() << '\n'; }

    auto p = std::make_unique<int>(42);    // the standard library uses the same idea for memory
    std::cout << "*p = " << *p << " (freed automatically at the end of main)\n";
    std::remove("raii_demo.txt");
}
