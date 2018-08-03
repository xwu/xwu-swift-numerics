Numeric types in Foundation
===========================

## Foundation.Decimal

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
> results on Linux prior to [Swift 4.1.3][ref 19-1].

[ref 19-1]: https://bugs.swift.org/browse/SR-7650

## Foundation.NSNumber

Available on Apple platforms and on Linux, `NSNumber` is a Foundation reference
type that wraps (or "boxes") C numeric values. It is a subclass of `NSValue` and
bridges the Core Foundation types `CFNumber` and `CFBoolean` both on Apple
platforms and on Linux; its instances are always immutable.

The underlying reason for the existence of such a wrapper type is grounded in
Objective-C:

> Objective-C has a divide between objects and non-objects.... [N]on-objects are
> everything that comes from C, from the integer `42` to the string
> `"Hello, world"` to complicated structs. Boxing is the process of placing
> these non-objects into an object so that they can be used like other objects,
> typically so that they can be placed in a collection. `NSNumber` is the
> [Foundation] class used to box C numbers. You can't have an `NSArray` of
> `int`, but you can have an `NSArray` of `NSNumber`. `NSNumber` shows up a lot
> in Cocoa programming.
>
> [— Mike Ash, Jul. 6, 2012][ref 20-1]

`NSNumber` provides, in addition to boxing functionality for Boolean and numeric
types, functionality to convert among these types. Since not all values are
representable in all types, conversion is sometimes lossy, resulting in loss of
precision or entirely erroneous results:

```swift
import Foundation

let x = -42 as NSNumber
x.uintValue // 18446744073709551574
```

In Swift, `NSNumber` supports bridging using the dynamic cast operators (`as?`,
`as!`, `is`) to and from Boolean and numeric types in addition to a handful of
different converting initializers. The purpose of this discussion is principally
to survey the behavior of these different ways of converting among numeric types
via `NSNumber`. These conversions differ among themselves and from similarly
named conversions between standard library types; moreover, their behavior has
changed over time.

Note that support for `NSNumber` bridging using `as?`, `as!`, and `is` is
[available for Linux only in Swift 4.2+][ref 20-2].

> [In Swift 3][ref 20-3], an `NSNumber` instance created from a Swift value
> preserved the original type information and could be bridged using dynamic
> casting (on macOS) back to the original type, whereas an `NSNumber` instance
> created from Cocoa could be bridged using dynamic casting to any type for
> which the value is exactly representable.
>
> The design was problematic for optimizations in Foundation and caused
> inconsistent behavior depending on the context in which an `NSNumber` instance
> was created. It was abandoned with adoption of [SE-0170: NSNumber bridging and
> Numeric types][ref 20-4], implemented in Swift 4.

[ref 20-1]: https://www.mikeash.com/pyblog/friday-qa-2012-07-06-lets-build-nsnumber.html
[ref 20-2]: https://forums.swift.org/t/bridging-for-swift-corelibs-foundation-on-linux/11994
[ref 20-3]: https://github.com/apple/swift-evolution/blob/master/proposals/0139-bridge-nsnumber-and-nsvalue.md
[ref 20-4]: https://github.com/apple/swift-evolution/blob/master/proposals/0170-nsnumber_bridge.md


### Conversions among integer types

When a value `source` of integer type `T` is boxed into an `NSNumber` instance
`boxed`, the following conversions are possible to an integer type `U`:

1. __`boxed as? U`__  
   _Failable, equivalent to `U(exactly: boxed)` and `U(exactly: source)`._  
   Converts the given value if the result can be represented exactly as a value
   of type `U`.  
   Otherwise, returns `nil`.

1. __`U(exactly: boxed)`__  
   _Failable initializer, equivalent to `boxed as? U` and `U(exactly: source)`._

1. __`U(truncating: boxed)`__  
   _Equivalent to `boxed.{u}int{#}Value` and `U(truncatingIfNeeded: source)`._  
   Creates a new value of type `U` from the binary representation in memory of
   `source` (notionally).  
   When `T` and `U` are not of the same bit width, the binary representation of
   `source` is [truncated or sign-extended][ref 4-1] as necessary.  

1. __`boxed.{u}int{#}Value`__ (e.g., `boxed.int64Value`, `boxed.uint64Value`)  
   _Equivalent to `U(truncating: boxed)` and `U(truncatingIfNeeded: source)`._

[ref 4-1]: https://developer.apple.com/documentation/swift/int/2926530-init

### Conversions among binary floating-point types

When a value `source` of floating-point type `T` is boxed into an `NSNumber`
instance `boxed`, the following conversions are possible to a floating-point
type `U`:

1. __`boxed as? U`__  
   _Failable, __not equivalent__ to `U(exactly: boxed)` and
   `U(exactly: source)`._  
   The result of an __inexact__ conversion is either `nil` (if
   [strict][ref 20-5]) or rounded to the nearest representable value (if
   [lenient][ref 20-6]).  
   The result of an __overflowing__ conversion is `nil`.  
   The result of an __underflowing__ conversion is either `nil` (if strict) or
   zero (if lenient).  
   The result of converting __NaN__ is `U.nan`.

1. __`U(exactly: boxed)`__  
   _Failable initializer, equivalent to `U(exactly: source)`._  
   Converts the given value if the result can be represented "exactly" as a
   value of type `U`; any result that is not `nil` can be converted back to a
   value of type `T` that compares equal to `source`.  
   The result of an __inexact__ conversion is `nil`.  
   The result of an __overflowing__ conversion is `nil`.  
   The result of an __underflowing__ conversion is `nil`.  
   The result of converting __NaN__ (however encoded) is `nil`, since NaN never
   compares equal to NaN.

1. __`U(truncating: boxed)`__  
   _Equivalent to `boxed.{float|double}Value` and `U(source)`._  
   The result of an __inexact__ conversion is rounded to the nearest
   representable value.  
   The result of an __overflowing__ conversion is infinite.  
   The result of an __underflowing__ conversion is zero.  
   The result of converting __NaN__ is some encoding of NaN that varies based on
   the underlying architecture; any __signaling NaN__ is always converted to a
   quiet NaN.

1. __`boxed.{float|double}Value`__    
   _Equivalent to `U(truncating: boxed)` and `U(source)`._

[ref 20-5]: https://github.com/apple/swift/commit/956e793ef0814c939ef150536e5d207914eefc91#diff-390bd9aed62915ecd0c43c8d6ecf0e08
[ref 20-6]: https://github.com/apple/swift/commit/c358afe6555e5e32633e879f96a3664dc7a5f3dc#diff-390bd9aed62915ecd0c43c8d6ecf0e08

### Conversions between numeric types and Bool

_Incomplete_

### Conversions from integer types to binary floating-point types

_Incomplete_

### Conversions from binary floating-point types to integer types

_Incomplete_

<!--

  https://github.com/apple/swift-corelibs-foundation/blob/8848f6e9ca00fdebd951e5547043d128184570a4/Foundation/NSNumber.swift#L895

  https://github.com/apple/swift/pull/16022/files

-->

---

Previous:  
[Concrete binary floating-point types, part 4](floating-point-part-4.md)

Next:  
Numeric protocols

_Draft: 3 August 2018_
