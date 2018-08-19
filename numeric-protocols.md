Numeric protocols
=================

## Introduction

Two proposals, [SE-0067: Enhanced floating-point protocols][ref 11-10] and
[SE-0104: Protocol-oriented integers][ref 9-4], were implemented in Swift 3 and
4 (respectively) and together account for the basic design enabling generic
programming with numbers. Those documents remain valuable sources of information
regarding the motivations and design considerations behind the existing
protocols.

The __`Numeric`__ protocol is intended to provide a basis for performing generic
arithmetic on both integer and floating-point values. It refines `Equatable` and
`ExpressibleByIntegerLiteral`; __it does _not_ refine `Comparable`__. The
__`SignedNumeric`__ protocol refines `Numeric` to add negation for those types
that support negative values.

The __`FloatingPoint`__ protocol refines `SignedNumeric` and defines most IEEE
754 operations required of floating-point types. It additionally refines
`Hashable` and `Strideable` (which itself refines `Comparable`); __it does _not_
refine `ExpressibleByFloatLiteral`__ because float literals are currently
designed in such a way that only _binary_ floating-point types can be precisely
expressed.

The __`BinaryFloatingPoint`__ protocol refines `FloatingPoint` and is intended
to provide a basis for all IEEE 754 binary floating-point types; it adds
interfaces specifically for floating-point types with a fixed binary radix. It
additionally refines `ExpressibleByFloatLiteral`.

The __`BinaryInteger`__ protocol refines `Numeric` and is intended to provide a
basis for all integer types; it declares integer arithmetic as well as bitwise
and bit shift operators. It additionally refines `CustomStringConvertible`,
`Hashable`, and `Strideable` (which itself refines `Comparable`).

The __`SignedInteger`__ protocol refines `SignedNumeric` and `BinaryInteger`,
while the __`UnsignedInteger`__ protocol refines `BinaryInteger` only; both are
"auxiliary" protocols that themselves add no additional requirements.

> For source code compatibility with Swift 3, `SignedInteger` actually does
> require two static methods with underscored names (at the time of writing).
> These have default implementations and are irrelevant to users of Swift 4+.

The __`FixedWidthInteger`__ protocol refines `BinaryInteger` to add overflowing
operations for those types that have a fixed bit width; it also adds notions of
endianness, but those APIs for handling endianness [may yet undergo further
revision][ref 21-1]. `FixedWidthInteger` additionally refines
`LosslessStringConvertible`.

As additional generics features have been added to the language, minor changes
have been made to existing numeric protocols to take advantage of those features
where possible. For example, as of Swift 4.2, `FloatingPoint` [has a
constraint][ref 21-2] that `Magnitude == Self`, which could not be expressed in
Swift 3.

[ref 11-10]: https://github.com/apple/swift-evolution/blob/master/proposals/0067-floating-point-protocols.md
[ref 9-4]: https://github.com/apple/swift-evolution/blob/master/proposals/0104-improved-integers.md
[ref 21-1]: https://lists.swift.org/pipermail/swift-evolution/Week-of-Mon-20170227/033372.html
[ref 21-2]: https://github.com/apple/swift/pull/17323

## Design rationale

In Swift, protocols are intended to enable users to write useful generic
algorithms. For that reason, several alternative approaches have been considered
and rejected. Those include protocols that dice up the functionality of numeric
types based solely on supported syntax, such as `Addable` or `Divisible`, and
protocols that precisely mirror mathematical definitions, such as `Field` or
`Ring`.

> A protocol such as `Divisible` would make no semantic guarantees that users
> might need in a generic algorithm. For instance, integer division and
> floating-point division have very different semantics, yet they are both
> spelled `/`, and `Int` and `Double` values alike can be regarded as
> "divisible." The inclusion of `Divisible` would promote generic uses of `/`
> that make assumptions about semantics not actually guaranteed.
>
> A protocol such as `Field` or `Ring` would be less accessible for many users
> of the language who would have no trouble writing a useful algorithm generic
> over `Numeric`. Moreover, it suggests that any such protocols are _the_ way to
> model a broad mathematical concept when in fact those protocols would be
> designed more narrowly to facilitate writing algorithms generic over basic
> numeric types.

Since it's impossible for a standard library protocol to refine a third-party
protocol, Swift offers a fairly rich hierarchy of standard library numeric
protocols so that reasonably common third-party numeric types can make use of
existing generic algorithms where they fulfill the required semantics. It's
easier to understand the division of labor among existing protocols in the
context of the numeric types and protocols that could be added in a third-party
library:

![Hierarchy of numeric protocols in Swift][ref 22-1]

__Why does `Numeric` conform to `Equatable` but not `Comparable`?__  
Complex numbers have an equivalence relation, but they cannot be ordered and
therefore do not fulfill the semantic requirements of `Comparable`.

__Why are there distinct protocols named `FloatingPoint` and
`BinaryFloatingPoint`?__  
Certain requirements are shared among all IEEE 754 floating-point types. For
example, they all support representations of infinity and NaN ("not a number").
However, some APIs (many to do with the raw representation in memory of values)
are common to all built-in floating-point types (which are binary) but would not
make sense for decimal floating-point types.

__Why are there _not_ distinct protocols named `Integer` and  `BinaryInteger`?__  
The original name proposed for `BinaryInteger` was `Integer`; it was renamed to
avoid confusion with `Int`. Bit shifting and bitwise operations required by the
protocol manipulate the sequence of bits in the two's complement binary
representation of an integer _regardless of the actual underlying representation
in memory_. In other words, any integer type can fulfill all the requirements of
`BinaryInteger`.

__Why is the integer protocol hierarchy bifurcated below `BinaryInteger`?__  
It wouldn't make sense for an arbitrary-width type (`BigInt`) to support
overflow operators such as `&+` since overflow isn't possible, so those don't
belong as requirements on `BinaryInteger`. At the same time, signed integers,
whether fixed-width or not, share certain common semantics captured by
`SignedInteger`.

[ref 22-1]: /assets/images/numeric-protocols.svg

## Generic algorithms

Before implementation of Swift's current numeric protocols, users who wanted to
perform generic mathematical operations would often have to create their own
workarounds:

```swift
// Excerpt from `Foundation.NSScanner` (2016).

internal protocol _BitShiftable {
    static func >>(lhs: Self, rhs: Self) -> Self
    static func <<(lhs: Self, rhs: Self) -> Self
}
 
internal protocol _IntegerLike : Integer, _BitShiftable {
    init(_ value: Int)
    static var max: Self { get }
    static var min: Self { get }
}

extension Int : _IntegerLike { }
extension Int32 : _IntegerLike { }
extension Int64 : _IntegerLike { }
extension UInt32 : _IntegerLike { }
extension UInt64 : _IntegerLike { }

extension String {
    internal func scanHex<T: _IntegerLike>(_ skipSet: CharacterSet?, locationToScanFrom: inout Int, to: (T) -> Void) -> Bool {
        // ...
    }
}
```

These workarounds are no longer necessary. In the example above,
`Foundation._IntegerLike` actually requires _fixed-width_ integer semantics
because it expects conforming types to have the `max` and `min` properties, and
today's version of `String.scanHex` is indeed [generic over
`FixedWidthInteger`][ref 23-1].

However, there remain some caveats unique to generic programming with numbers.
Without attention to these details, generic implementations can suffer
significant performance penalties or even show unexpected behavior as compared
to concrete implementations. Two particular caveats are detailed below. First,
however, we'll review some general advice:

__Ask whether your algorithm should be generic at all.__  
[Reducing code duplication][ref 23-2] is one motivation that drives users to
explore generic solutions. However, not all instances of code duplication are
best eliminated by the use of generics.

Consider an algorithm that can operate on values of type `UInt` or `Double`. It
may be possible to write a single implementation generic over `Numeric` that is
indistinguishable from concrete implementations for any input of type `UInt` or
`Double`. However, if the algorithm relies on semantics common to `UInt` and
`Double` but not guaranteed by `Numeric`, inputs of type `Int8` or `Float` (or
of some third-party type) might produce completely unexpected results. In other
words, such an implementation can be _syntactically_ valid Swift without truly
being generic over `Numeric`. The compiler can't detect all invalid _semantic_
assumptions, and testing with a limited subset of conforming types can achieve
100% test coverage without revealing the problem.

Therefore, consider if a code generation tool such as [Sourcery][ref 23-3] might
be the most appropriate solution instead.

__Make your generic constraints as specific as possible.__  
For example, there are no built-in types that conform to `FloatingPoint` but not
`BinaryFloatingPoint`. (And `Foundation.Decimal`, for reasons previously
detailed, conforms to neither.) Meanwhile, `FloatingPoint` promises
significantly more restricted semantics and APIs for reasons we've discussed
above; the protocol doesn't even conform to `ExpressibleByFloatLiteral`. With no
straightforward way to test that a generic algorithm relies only on the more
limited semantics of `FloatingPoint`, and no way to profit from that limitation,
there's no reason to declare `func f<T: FloatingPoint>(_: T)`.

__Consider refining standard library protocols with custom protocols in order to
benefit from dynamic dispatch.__  
Suppose you extend an existing protocol such as `Numeric` with a method `f()`,
then write a faster specialized concrete implementation of `f()` on `Int`:

```swift
extension Numeric {
  func f() {
    // ...
    print("Numeric")
  }
}
extension Int {
  func f() {
    // ...
    print("Int")
  }
}
func f<T: Numeric>(_ value: T) {
  value.f()
}

42.f() // "Int"
f(42)  // "Numeric"
```

`42.f()` is a call to the concrete implementation, but `f(42)` is a call to the
slower generic implementation because protocol extension methods are
__statically dispatched__. However, if you create a protocol `CustomNumeric`
that _refines_ `Numeric` and adds `f()` as a requirement, then calls to `f()`
will be __dynamically dispatched__ to any concrete implementation that exists:

```swift
protocol CustomNumeric: Numeric {
  func f()
}

extension CustomNumeric {
  func f() {
    // ...
    print("CustomNumeric")
  }
}
extension Int: CustomNumeric {
  func f() {
    // ...
    print("Int")
  }
}
func f<T: CustomNumeric>(_ value: T) {
  value.f()
}

42.f() // "Int"
f(42)  // "Int"
```

[ref 23-1]: https://github.com/apple/swift-corelibs-foundation/blob/50b26ff4d77cee066361182c5eb50d20f3fe0012/Foundation/Scanner.swift#L285
[ref 23-2]: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
[ref 23-3]: https://github.com/krzysztofzablocki/Sourcery

### Heterogeneous comparison

[SE-0104: Protocol-oriented integers][ref 9-4] added heterogeneous comparison
and bit shift operators to Swift in order to improve the user experience. For
example, you can now check if an `Int` value is equal to a `UInt` value.

> Similar enhancements for operations such as addition are not yet possible
> because a design is lacking for how to express __promotion__. When (if) Swift
> allows integer constants in generic constraints, this may become a more
> realistic prospect, as promotion would then be expressible using generic
> constraints (e.g., `func + <T, U>(lhs: T, rhs: U) -> U where T: FixedWidthInteger, U: FixedWidthInteger, T.bitWidth < U.bitWidth`).

These heterogeneous operators behave as intended with concrete types. __However,
integer comparisons in generic algorithms behave differently. If one operand in
a generic context is a literal, overload resolution will favor heterogeneous
comparison with `IntegerLiteralType` over homogeneous comparison.__

> The same problem would occur in a nongeneric context but for _two_ hacks: (1)
> to improve type-checking performance, the compiler won't traverse the protocol
> hierarchy to rank all overloads of an operator function if it finds a matching
> overload defined in the concrete type; (2) to favor homogeneous comparison
> over heterogeneous comparison, [otherwise redundant concrete implementations
> have been added to built-in numeric types][ref 23-4].

This issue was encountered during review of the standard library's
implementation of `DoubleWidth`, which in fact [had a bug][ref 23-5] as a
consequence of the following behavior:

```swift
func f() -> Bool {
  return UInt.max == ~0
}
func g<T : FixedWidthInteger>(_: T.Type) -> Bool {
  return T.max == ~0
}

f()          // `true`
g(UInt.self) // `false`
```

In a generic context, even if the most refined protocol implements its own
overload of the homogeneous comparison operator, Swift will look for all
overloads of the operator by traversing the entire protocol hierarchy. Since
heterogeneous comparison operators are defined somewhere along the hierarchy,
the compiler will _always_ find an overload that takes the "preferred" integer
literal type (`IntegerLiteralType`, which is a type alias for `Int`) and
therefore infers the literal to be of type `Int`. As a result, in the expression
`g(UInt.self)`, we are actually comparing `UInt.max` to `~(0 as Int)`.

__To work around this issue, always explicitly specify the type of a numeric
literal in a generic context.__ For example:

```swift
func h<T : FixedWidthInteger>(_: T.Type) -> Bool {
  return T.max == ~(0 as T)
}
h(UInt.self) // `true`
```

> Heterogeneous comparison is also planned for floating-point types. However,
> until the issue described above is resolved, adding heterogeneous comparison
> would cause new unexpected results:
>
> ```swift
> func isOnePointTwo<T: BinaryFloatingPoint>(_ value: T) -> Bool {
>   return value == 1.2
> }
>
> isOnePointTwo(1.2 as Float80)
> // Currently `true`.
> // Would be `false` when heterogeneous comparison is implemented.
> ```

[ref 23-4]: https://github.com/apple/swift/pull/9909
[ref 23-5]: https://github.com/apple/swift/pull/9367#discussion_r118612475

### Hashing

In Swift 4.2+, the standard library uses a randomly seeded universal hash
function to compute `hashValue`.

> Changes to the implementation of `hashValue` were introduced as part of the
> Swift Evolution proposal [SE-0206: Hashable enhancements][ref 23-6].
>
> At the time of writing, the implementation uses [SipHash-1-3][ref 23-7], which
> is also used in [Rust][ref 23-8] and [Ruby][ref 23-9].

Prior to that change, not only were hash values equal across different
executions of a program, but `Int8` and `UInt8` had the following
implementations of `hashValue`:

```swift
// Swift 4.1:

extension Int8 : Hashable {
  public var hashValue: Int {
    @inline(__always)
    get {
      return Int(self)
    }
  }
}

extension UInt8 : Hashable {
  public var hashValue: Int {
    @inline(__always)
    get {
      return Int(Int8(bitPattern: self))
    }
  }
}
```

Other built-in types had similar implementations of `hashValue`, with the result
(for example) that `(42 as Int16).hashValue == (42 as UInt32).hashValue`.

Now, hash values are no longer equal across different executions of a program,
and integer types no longer simply convert a value to type `Int` when computing
the hash value. __Two values of different bit widths that compare equal using a
heterogeneous comparison operator won't have the same `hashValue` property.__
(To be clear, it was also the case previously that half of the representable
values of a built-in unsigned integer type would have a different hash value if
promoted to a wider type.) 

Therefore, if you require integer values of different types that compare equal
to be hashed in the same way, don't feed the values themselves into a hasher,
but use their `words` property instead:

```swift
let x = 42 as UInt64
let y = 42 as Int32

var hasher = Hasher()
hasher.combine(x)
let a = hasher.finalize()
hasher = Hasher()
hasher.combine(y)
let b = hasher.finalize()
a == b
// false

hasher = Hasher()
x.words.forEach { hasher.combine($0) }
let c = hasher.finalize()
hasher = Hasher()
y.words.forEach { hasher.combine($0) }
let d = hasher.finalize()
c == d
// true
```

[ref 23-6]: https://github.com/apple/swift-evolution/blob/master/proposals/0206-hashable-enhancements.md
[ref 23-7]: https://131002.net/siphash/
[ref 23-8]: https://github.com/rust-lang/rust/pull/33940
[ref 23-9]: https://github.com/ruby/ruby/pull/1501

## Conformance

As diagnostics have improved in each subsequent release of Swift, it has become
possible to use the "fix-it" feature to identify missing requirements that
prevent a type from conforming to a protocol. __However, relying solely on the
"fix-it" feature to conform a type to Swift's numeric protocols will produce
undesired results.__

It's highly recommended that you conform your type to Swift's numeric protocols
one at a time, beginning with `Equatable`, `ExpressibleByIntegerLiteral`, and
`Numeric`. Only when you have successfully conformed to these protocols should
you proceed with conformance to `BinaryInteger` or `FloatingPoint`, and so on.

It's true that a more refined protocol may provide a default implementation for
some requirements of less refined protocols. Therefore, conforming to protocols
in a stepwise manner will result in some duplicated effort (in that you will
write implementations subsequently made extraneous by default implementations).
However, the advantages of this approach outweigh the disadvantages. First, it
provides a logical sequence by which more advanced functionality is implemented
using less advanced building blocks. Second, it helps to avoid creating
unintentional infinite recursion either among your own concrete implementations
or as a result of relying on the standard library's default implementations (see
below).

Sometimes, a protocol has a nongeneric requirement such as `init(_: Int)` and a
generic requirement such as `init<T: Numeric>(_: T)`, and a default
implementation of the generic initializer calls the nongeneric initializer.
However, to the compiler, that default implementation satisfies _both_ the
nongeneric and the generic requirements because `Int` conforms to `Numeric`.
Therefore, no "fix-it" will be shown to alert you that there is a missing
implementation of the nongeneric requirement, and the default implementation of
the generic requirement becomes an infinitely recursive one. You will only know
about such requirements by reading the documentation for each protocol.

Many APIs guaranteed by Swift's numeric protocols have particular semantic
requirements described in detail in the accompanying documentation; they may
not be captured entirely by the spelling of those APIs and cannot be enforced by
the compiler. However, generic algorithms will require conforming types to
adhere to the documented semantics for their own correctness. Again, you will
only know about such requirements by reading the documentation for each
protocol.

The [`DoubleWidth` prototype][ref 24-1] found in the Swift code repository
demonstrates how a type can be conformed to numeric protocols according to
contemporary recommended practices.

<!--
Discuss methods guaranteed at each level of the hierarchy, what must be
implemented, and what cannot be overridden because they are exclusively protocol
extension methods.
-->

[ref 24-1]: https://github.com/apple/swift/blob/bd310140f3a5184d98e78abc9a95d179ef75b901/test/Prototypes/DoubleWidth.swift.gyb

### Default implementations and unintentional infinite recursion

Some requirements of numeric protocols come with a default implementation. These
implementations are possible because they build on other protocol requirements
that _don't_ have a default implementation. __As a general rule, never attempt
to implement a protocol requirement by relying on the default implementation of
another requirement of the same or a more refined protocol.__ For example:

```swift
struct CustomInteger {
  // ...
}

extension CustomInteger: FixedWidthInteger {
  init(integerLiteral value: Int) {
    self.init(value)
  }
  // No concrete implementation of `init(_:)`.
  // ...
}

42 as CustomInteger
// Infinite recursion!
```

Why does infinite recursion occur in the example above? `CustomInteger`
implements `init(integerLiteral:)`, a requirement of the protocol
`ExpressibleByIntegerLiteral`, by calling a generic conversion initializer that
it doesn't implement. Meanwhile, `FixedWidthInteger`, which transitively refines
`ExpressibleByIntegerLiteral`, provides the default implementation of that
generic conversion initializer and uses integer literals in that implementation.

You have no control over the standard library's default implementations. Even if
your method works today despite calling a default implementation you don't
control, you could end up with infinite recursion tomorrow if that default
implementation changes.

---

Previous:  
[Numeric types in Foundation](numeric-types-in-foundation.md)

_11–19 August 2018_
