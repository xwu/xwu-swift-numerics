Numeric types in Foundation
===========================

## Decimal

Available on Apple platforms and on Linux, `Decimal` is a Foundation value type;
on Apple platforms, it bridges the `NSDecimalNumber` class. The binary
representation of values is the same across platforms and does not align with
any decimal floating-point representation defined in the IEEE 754-2008 standard,
since `NSDecimalNumber` itself pre-dates that standard and has been available
since Mac OS X 10.0. Each value requires 160 bits of memory, and the stored
properties of `Decimal` are defined in swift-corelibs-foundation as follows:

```swift
public struct Decimal {
  fileprivate var __exponent: Int8
  fileprivate var __lengthAndFlags: UInt8
  fileprivate var __reserved: UInt16
  public var _mantissa:
    (UInt16, UInt16, UInt16, UInt16, UInt16, UInt16, UInt16, UInt16)
}
```

The purpose of this discussion is not to rehash the existing documentation, but
to place this type in the context of Swift's other numeric types and protocols.

Many methods available on `Float` and `Double` are also available on `Decimal`.
However, `Decimal` does not __and cannot__ conform to `FloatingPoint` because it
does not adhere to all of the requirements of that protocol (which align with
IEEE 754 requirements). For example, __`Decimal` has no representation for
negative zero or infinity__.

Facilities uniquely available for `Decimal` values are those that perform
arithmetic operations using a specified rounding mode (`Decimal.RoundingMode`)
and return a result signaling loss of precision, overflow, underflow, or other
errors (`Decimal.CalculationError`).

(A rounding __mode__ to fit a result to a given precision is not necessarily the
same as a rounding rule for rounding a value to the nearest integer. Recall that
Swift provides no way to use a dynamic rounding __mode__ for calculations
involving binary floating-point types, and that Swift provides no way to
interrogate the global flags that signal binary floating-point exceptions.)

Facilities not yet available on `Decimal` include instance methods such as
`addingProduct(_:_:)`, `remainder(dividingBy:)`,
`truncatingRemainder(dividingBy:)`, `squareRoot()`, and `rounded(_:)`; and
static methods such as `minimum(_:_:)` and `maximum(_:_:)`.

Because the significand of a `Decimal` value is represented differently than
that of a binary floating-point value, the unit in the last place (or __ulp__)
of a `Decimal` value is __not__ equivalent to the distance between itself and
the nearest representable value greater in magnitude, and the properties
`nextUp` and `nextDown` consequently do not behave as documented at present:

```swift
import Foundation

(10 as Decimal).ulp.description    // "10"
(10 as Decimal).nextUp.description // "20"
```

As previously discussed, initalization of any type conforming to
`ExpressibleByFloatLiteral` from a float literal involves first initializing a
value of type `_MaxBuiltinFloatType`, which is a type alias for `Float80` if
supported and `Double` otherwise, and then converting that value to the desired
type.

Since `_MaxBuiltinFloatType` is a __binary__ floating-point type, a decimal
floating-point type that conforms to the protocol `ExpressibleByFloatLiteral`
cannot distinguish between two values that have the same binary floating-point
representation when rounded to fit `_MaxBuiltinFloatType`:

```swift
import Foundation

(0.1 as Decimal).description
// "0.1"
(0.10000000000000001 as Decimal).description
// "0.1"

Decimal(string: "0.1")!.description
// "0.1"
Decimal(string: "0.10000000000000001")!.description
// "0.10000000000000001"
```

> Note that addition and subtraction of `Decimal` values produced erroneous
> results on Linux prior to [Swift 4.1.3][ref XXX-1].

[ref XXX-1]: https://bugs.swift.org/browse/SR-7650


## NSNumber

_Incomplete_

### Bridging and conversions to other numeric types

_Incomplete_

<!--

  https://github.com/apple/swift-evolution/blob/master/proposals/0139-bridge-nsnumber-and-nsvalue.md

  https://github.com/apple/swift-evolution/blob/master/proposals/0170-nsnumber_bridge.md

  https://github.com/apple/swift/commit/c358afe6555e5e32633e879f96a3664dc7a5f3dc#diff-390bd9aed62915ecd0c43c8d6ecf0e08

  https://github.com/apple/swift/commit/956e793ef0814c939ef150536e5d207914eefc91#diff-390bd9aed62915ecd0c43c8d6ecf0e08

  --

  https://forums.swift.org/t/bridging-for-swift-corelibs-foundation-on-linux/11994

  https://github.com/apple/swift/pull/16022/files

-->

---

Previous:  
[Concrete binary floating-point types, part 4](floating-point-part-4.md)

Next:  
Numeric protocols

_Draft: 3 August 2018_
