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

The __`FixedWidthInteger`__ protocol refines `BinaryInteger` to add overflowing
operations for those types that have a fixed bit width; it also adds notions of
endianness, but those APIs for handling endianness [may yet undergo further
revision][ref 21-1]. `FixedWidthInteger` additionally refines
`LosslessStringConvertible`.

As additional generics features have been added to the language, minor changes
have been made to existing numeric protocols to take advantage of those features
where possible. For example, as of Swift 4.2, `FloatingPoint` [has a
constraint][ref 21-2] that `Magnitude == Self`, which could not be expressed in
Swift 3; similarly, `FixedWidthInteger` [now has constraints][ref 21-3] that
`Magnitude : FixedWidthInteger & UnsignedInteger` and that
`Stride : FixedWidthInteger & SignedInteger`.

[ref 11-10]: https://github.com/apple/swift-evolution/blob/master/proposals/0067-floating-point-protocols.md
[ref 9-4]: https://github.com/apple/swift-evolution/blob/master/proposals/0104-improved-integers.md
[ref 21-1]: https://lists.swift.org/pipermail/swift-evolution/Week-of-Mon-20170227/033372.html
[ref 21-2]: https://github.com/apple/swift/pull/17323
[ref 21-3]: https://github.com/apple/swift/pull/17716

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
__Complex numbers__ have an equivalence relation, but they cannot be ordered and
therefore do not fulfill the semantic requirements of `Comparable`.

__Why are there distinct protocols named `FloatingPoint` and
`BinaryFloatingPoint`?__  
Certain requirements are shared among all IEEE 754 floating-point types. For
example, they all support representations of infinity and NaN ("not a number").
However, some APIs (many to do with the raw representation in memory of values)
are common to all built-in floating-point types (which are binary) but would not
make sense for __decimal floating-point types__.

__Why are there _not_ distinct protocols named `Integer` and  `BinaryInteger`?__  
The original name proposed for `BinaryInteger` was `Integer`; it was renamed to
avoid confusion with `Int`. The word "binary" was chosen because bit shifting
and bitwise operations required by the protocol manipulate the sequence of bits
in the two's-complement binary representation of an integer _regardless of the
actual underlying representation in memory_. All APIs required by the protocol,
including bit shifting and bitwise operations, are well defined and can be
computed for an integer regardless of the radix of its internal representation
in memory. Put another way, there aren't commonly used third-party types that
can't perform bit shifting and bitwise operations but could fulfill all the
other requirements of `BinaryInteger`.

__Why is the integer protocol hierarchy bifurcated below `BinaryInteger`?__  
It wouldn't make sense for an __arbitrary-width type__ (`BigInt`) to support
overflow operators such as `&+` since overflow isn't possible, so those don't
belong as requirements on `BinaryInteger`. At the same time, signed integers,
whether fixed-width or not, share certain common semantics captured by
`SignedInteger`.

[ref 22-1]: /assets/images/numeric-protocols.svg

## Generic algorithms

Before the implementation of Swift's current numeric protocols, users who wanted
to perform generic mathematical operations would often have to create their own
workarounds:

```swift
// Excerpt from `Foundation.NSScanner` (now `Foundation.Scanner`), 2016.

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

These workarounds are no longer necessary. For instance, in the example above,
`Foundation._IntegerLike` actually requires _fixed-width_ integer semantics
because we need `max` and `min`, and today's version of `String.scanHex` is
indeed [generic over `FixedWidthInteger`][ref 23-1].

However, there remain some caveats that are unique to generic programming with
numbers. Without attention to these details, generic implementations can suffer
significant performance penalties or even show unexpected behavior as compared
to concrete implementations. Three particular caveats are detailed below. First,
however, we'll review some general advice:

__Ask whether your algorithm should be generic at all.__  
[Reducing code duplication][ref 23-2] is one motivation that drives users to
explore generic solutions. However, not all instances of code duplication are
best eliminated by the use of generics. Consider an algorithm that can operate
on values of type `UInt` or `Double`. It may be possible to write a single
implementation generic over `Numeric` that is indistinguishable from concrete
implementations for any input of type `UInt` or `Double`. However, if the
algorithm relies on semantics common to `UInt` and `Double` but not guaranteed
by `Numeric`, inputs of type `Int8` or `Float` (or of some third-party type
correctly conforming to `Numeric`) might produce completely unexpected results.
In other words, such a generic implementation of the algorithm can be
_syntactically_ valid Swift without truly being generic over `Numeric`; the
compiler can't detect invalid _semantic_ assumptions, and testing with a limited
subset of conforming types can achieve 100% test coverage without revealing the
problem. Therefore, consider if a code generation tool such as
[Sourcery][ref 23-3] might be the most appropriate solution instead.

__Make your generic constraints as specific as possible.__  
For example, there are no built-in types that conform to `FloatingPoint` but not
`BinaryFloatingPoint`. (And `Foundation.Decimal`, for reasons previously
detailed, conforms to neither.) Meanwhile, `FloatingPoint` promises
significantly more restricted semantics and APIs for reasons we've discussed
above; the protocol doesn't even conform to `ExpressibleByFloatLiteral`. With no
straightforward way to test that a generic algorithm relies only on the more
limited semantics of `FloatingPoint`, and no way even to profit from that
limitation, there's no reason to declare `func f<T: FloatingPoint>(_: T)`.

__Consider refining standard library protocols with custom protocols that add
new requirements in order to benefit from dynamic dispatch.__  
Suppose you extend an existing protocol such as `Numeric` with a method `f()`,
then write a faster specialized concrete implementation of `f()` on `Int`.
`42.f()` is a call to the faster concrete implementation, as expected, but
`func f<T: Numeric>(_ t: T) { t.f() }; f(42)` is a call to the slower generic
implementation because protocol extension methods are __statically dispatched__.
However, if you create a protocol `CustomNumeric` that _refines_ `Numeric`
and adds `f()` as a requirement, then calls to `f()` will be __dynamically
dispatched__ to the concrete implementation on a conforming type (if one
exists), even if the call is from a generic context.

[ref 23-1]: https://github.com/apple/swift-corelibs-foundation/blob/50b26ff4d77cee066361182c5eb50d20f3fe0012/Foundation/Scanner.swift#L285
[ref 23-2]: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
[ref 23-3]: https://github.com/krzysztofzablocki/Sourcery

### Heterogeneous comparison

_Incomplete_

### Hashing

_Incomplete_

### Conversions

_Incomplete_

## Conformance

<!--
Discuss methods guaranteed at each level of the hierarchy, what must be
implemented, and what cannot be overridden because they are exclusively protocol
extension methods.
-->

### Unintentional recursive implementations

_Incomplete_

---

Previous:  
[Numeric types in Foundation](numeric-types-in-foundation.md)

_Draft: 11-18 August 2018_
