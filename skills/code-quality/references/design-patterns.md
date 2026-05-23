# Design Patterns

From *Software Design for Python Programmers* by Ronald Mak. When you recognize one of these architecture problems, apply the corresponding pattern.

| Problem | Pattern | Key Idea |
|---------|---------|----------|
| Algorithm has fixed steps, some vary by context | **Template Method** | Superclass defines skeleton, subclasses fill in steps |
| Multiple interchangeable algorithms | **Strategy** | Encapsulate each algorithm, inject the one you need |
| Creating related families of objects | **Abstract Factory** | Factory per family, no mixing family members |
| Creating objects where subclass should decide which | **Factory Method** | Delegate instantiation to subclasses |
| Incompatible interfaces need to work together | **Adapter** | Wrap the adaptee to match the target interface |
| Complex subsystem needs a simple interface | **Facade** | One class fronts the subsystem |
| One algorithm, different sequential collections | **Iterator** | Encapsulate iteration, hide collection implementation |
| Different algorithms on one collection of mixed types | **Visitor** | Each algorithm is a visitor, nodes accept visitors |
| Publisher-subscriber / one-to-many dependency | **Observer** | Subject notifies observers, observers pull data |
| Object behavior depends on its state | **State** | Each state is a class, state transitions return next state |
| At most one instance of a class | **Singleton** | Controlled creation, global access point |
| Part-whole hierarchies treated uniformly | **Composite** | Common interface for individual and composite objects |
| Add responsibilities dynamically at runtime | **Decorator** | Wrap objects, each wrapper adds one responsibility |

## When to Apply

If you see the "before" pattern described in the book — hardcoded behaviors, long type-checking chains, duplicated iteration logic, scattered state management — refactor to the appropriate pattern.
