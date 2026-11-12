// smart_pointers.cpp -- who owns a polymorphic object: unique_ptr, shared_ptr, weak_ptr
#include <iostream>
#include <memory>
#include <string>
#include <vector>

struct Node {
    std::string name;
    std::vector<std::shared_ptr<Node>> children;   // parents own their children
    std::weak_ptr<Node> parent;                    // children only observe their parent: no ownership cycle
    explicit Node(std::string n) : name(std::move(n)) { std::cout << "  + " << name << '\n'; }
    ~Node() { std::cout << "  - " << name << '\n'; }
};

struct Shape { virtual ~Shape() { std::cout << "  ~Shape\n"; } virtual const char* name() const = 0; };
struct Circle : Shape { ~Circle() override { std::cout << "  ~Circle\n"; } const char* name() const override { return "circle"; } };

std::unique_ptr<Shape> make_shape() { return std::make_unique<Circle>(); }   // a factory hands over ownership
void consume(std::unique_ptr<Shape> s) { std::cout << "  consume() now owns a " << s->name() << '\n'; }

int main() {
    std::cout << "unique_ptr: exactly one owner\n";
    auto s = make_shape();
    // auto copy = s;                        // error: unique_ptr cannot be copied
    consume(std::move(s));                   // ownership moves into the function, and dies with it
    std::cout << "  s is now " << (s ? "set" : "empty") << '\n';

    std::cout << "shared_ptr: shared ownership, counted\n";
    auto root = std::make_shared<Node>("root");
    {
        auto leaf = std::make_shared<Node>("leaf");
        leaf->parent = root;
        root->children.push_back(leaf);
        std::cout << "  leaf owners: " << leaf.use_count() << '\n';     // leaf + root's vector
        if (auto p = leaf->parent.lock()) std::cout << "  leaf's parent is " << p->name << '\n';
    }
    std::cout << "  root owners: " << root.use_count() << " (the weak_ptr does not count)\n";
    std::cout << "end of main\n";
}
