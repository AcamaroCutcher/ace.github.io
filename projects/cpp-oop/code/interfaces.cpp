// interfaces.cpp -- pure abstract "interface" classes, and a class that implements two of them
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

class Drawable {                                    // an interface: only pure virtual functions
public:
    virtual ~Drawable() = default;
    virtual void draw(std::ostream& out) const = 0;
};

class Serializable {
public:
    virtual ~Serializable() = default;
    virtual std::string to_json() const = 0;
};

class Point : public Drawable, public Serializable {   // implements both interfaces
public:
    Point(double x, double y) : x_(x), y_(y) {}
    void draw(std::ostream& out) const override { out << "* at (" << x_ << ", " << y_ << ")"; }
    std::string to_json() const override {
        std::ostringstream s;
        s << "{\"x\": " << x_ << ", \"y\": " << y_ << "}";
        return s.str();
    }
private:
    double x_, y_;
};

class Label : public Drawable {                     // drawable, but not serializable
public:
    explicit Label(std::string t) : text_(std::move(t)) {}
    void draw(std::ostream& out) const override { out << "\"" << text_ << "\""; }
private:
    std::string text_;
};

void render(const std::vector<std::unique_ptr<Drawable>>& scene) {   // depends only on the interface
    for (const auto& d : scene) {
        std::cout << "draw: ";
        d->draw(std::cout);
        // ask at run time whether this object also supports another interface
        if (auto s = dynamic_cast<const Serializable*>(d.get()))
            std::cout << "   json: " << s->to_json();
        std::cout << '\n';
    }
}

int main() {
    std::vector<std::unique_ptr<Drawable>> scene;
    scene.push_back(std::make_unique<Point>(1, 2));
    scene.push_back(std::make_unique<Label>("origin"));
    scene.push_back(std::make_unique<Point>(-3, 0.5));
    render(scene);
}
