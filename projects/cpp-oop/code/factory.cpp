// factory.cpp -- creating objects from text, e.g. an input file, through a registry of constructors
#include <functional>
#include <iostream>
#include <map>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

struct Shape {
    virtual ~Shape() = default;
    virtual double area() const = 0;
    virtual std::string describe() const = 0;
};
struct Circle : Shape {
    double r;
    explicit Circle(std::istream& in) { if (!(in >> r)) throw std::runtime_error("circle needs a radius"); }
    double area() const override { return 3.14159 * r * r; }
    std::string describe() const override { std::ostringstream s; s << "circle r=" << r; return s.str(); }
};
struct Rect : Shape {
    double w, h;
    explicit Rect(std::istream& in) { if (!(in >> w >> h)) throw std::runtime_error("rect needs width and height"); }
    double area() const override { return w * h; }
    std::string describe() const override { std::ostringstream s; s << "rect " << w << "x" << h; return s.str(); }
};

using Maker = std::function<std::unique_ptr<Shape>(std::istream&)>;

std::map<std::string, Maker>& registry() {         // name -> how to build it
    static std::map<std::string, Maker> r = {
        {"circle", [](std::istream& in) { return std::make_unique<Circle>(in); }},
        {"rect",   [](std::istream& in) { return std::make_unique<Rect>(in); }},
    };
    return r;
}

std::unique_ptr<Shape> make(const std::string& line) {
    std::istringstream in(line);
    std::string kind;
    in >> kind;
    auto it = registry().find(kind);
    if (it == registry().end()) throw std::runtime_error("unknown shape '" + kind + "'");
    return it->second(in);
}

int main() {
    const char* input = "circle 1\nrect 2 3\nhexagon 1\nrect 4\ncircle 0.5\n";   // pretend this is a file
    std::istringstream file(input);
    std::vector<std::unique_ptr<Shape>> shapes;
    std::string line;
    int n = 0;
    while (std::getline(file, line)) {
        ++n;
        try { shapes.push_back(make(line)); }
        catch (const std::exception& e) { std::cout << "line " << n << ": " << e.what() << '\n'; }
    }
    for (const auto& s : shapes) std::cout << s->describe() << " -> area " << s->area() << '\n';
}
