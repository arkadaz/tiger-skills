# Design Patterns

Quick-reference selection guide. When you recognize an architecture problem, apply the corresponding pattern. For full code examples, see [python/examples.md](python/examples.md) or [rust/examples.md](rust/examples.md).

## Pattern Selection Table

| When You See... | Use This Pattern | Category |
|----------------|-----------------|----------|
| Fixed algorithm steps, some vary by context | **Template Method** | Behavioral |
| Multiple interchangeable algorithms | **Strategy** | Behavioral |
| One produces data, many consume it | **Observer** | Behavioral |
| Object behavior depends on its state | **State** | Behavioral |
| Different algorithms on one collection of mixed types | **Visitor** | Behavioral |
| One algorithm, different sequential collections | **Iterator** | Behavioral |
| Creating families of related objects | **Abstract Factory** | Creational |
| Subclass should decide what to create | **Factory Method** | Creational |
| At most one instance allowed | **Singleton** | Creational |
| Incompatible interfaces need to work together | **Adapter** | Structural |
| Complex subsystem needs simple interface | **Facade** | Structural |
| Part-whole hierarchy, treat uniformly | **Composite** | Structural |
| Add responsibilities dynamically at runtime | **Decorator** | Structural |

## Cheat Sheet

| Pattern | One-Liner |
|---------|-----------|
| **Template Method** | Superclass defines skeleton, subclasses fill in varying steps |
| **Strategy** | Encapsulate each algorithm, inject the one you need |
| **Observer** | Publisher notifies subscribers; subscribers pull data they want |
| **State** | Each state is a class; state transitions return next state |
| **Visitor** | Each algorithm is a visitor; elements accept visitors via double dispatch |
| **Iterator** | Encapsulate traversal; hide collection implementation |
| **Abstract Factory** | One factory per family; no cross-family mixing |
| **Factory Method** | Delegate "which class to instantiate" to subclasses |
| **Singleton** | Private constructor, static accessor, controlled creation |
| **Adapter** | Wrap the adaptee; translate its interface to what the client expects |
| **Facade** | One class fronts a complex subsystem with a simple interface |
| **Composite** | Same interface for leaf (one) and composite (many); recursion handles the rest |
| **Decorator** | Wrap objects; each wrapper adds one responsibility; stack in any order |

## How to Choose

1. Identify the problem from the first table
2. Read the one-liner — does it match?
3. Open the language examples file for concrete code
4. Adapt the pattern structure to your domain
