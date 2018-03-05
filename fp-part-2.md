Concrete binary floating-point types, part 2
============================================

## Floating-point precision

> __Floating point is the worst approximation to the real numbers except for
> all the others.__
>
> [— Stephen Canon, Nov. 1, 2017][ref 12-1]

Swift's floating-point types are intended to model the real numbers, but (as
with all such models) it is inexact; in fact, almost all real numbers cannot be
represented exactly in binary floating-point format.

> _Background:_
>
> Even for beginners, some caveats can be important to keep in mind when working
> with binary floating-point values:
>
> * Many modest decimal fractions, such as 0.1, cannot be represented exactly.
> * Not all integral values less than `greatestFiniteMagnitude` can be
>   represented exactly.
> * Basic arithmetic operations are often inexact; for example, `a + b - b == a`
>   does not always evaluate to `true`.

Although out the scope of this article, some alternative choices for modeling
real numbers are as follows:

> __Binary floating point__  
> Pro: represents modest integers exactly, extremely fast hardware
> implementations, fixed memory size, and rounding errors are extremely
> uniform—they don't vary much with the number being represented.  
> Con: almost no decimal fractions have exact representations.
>
> __Decimal floating point__  
> Pro: represents modest integers and decimal fractions exactly, slower than
> binary but still faster than almost anything else, fixed memory size.  
> Con: at least an order of magnitude slower than binary floating point, and
> rounding error is significantly less scale-invariant.
>
> __Fixed-size rationals__  
> Pro: represents all modestly-sized integers and fractions exactly, fixed
> memory size, four basic operations are exact until you hit the limits of
> representation.  
> Con: denominators quickly grow too quickly to be used for non-trivial
> computations (this is usually a deal-breaker).
>
> __Arbitrary-precision rationals__  
> Pro: closed under four basic operations, represents most numbers most people
> will use exactly.  
> Con: representations get extremely large extremely quickly, large memory
> footprint if you have more than a few numbers.
>
> __Computable real numbers__  
> Pro: any number you can describe, you can work with.  
> Con: your numbers are now computer programs, and you arithmetic system is
> Turing-complete. Testing for equality is equivalent to solving the halting
> problem.
>
> [— Stephen Canon, Sep. 12, 2016][ref 12-2]

The Swift standard library provides binary floating-point types. Foundation
offers a decimal floating-point type discussed below, and alternative
implementations that adhere to IEEE 754, such as those from [IBM][ref 12-3] (ICU
License) or [Intel][ref 12-4] (BSD License) can be wrapped in Swift. Third-party
libraries can provide a [fixed-width rational type][ref 12-5], and existing
libraries with C interfaces can be wrapped to provide an arbitrary-precision
rational type (or one can be implemented natively in Swift).

[ref 12-1]: https://forums.swift.org/t/rationalizing-floatingpoint-conformance-to-equatable/6861/82
[ref 12-2]: https://forums.swift.org/t/provide-native-decimal-data-type/4003/4
[ref 12-3]: http://speleotrove.com/decimal/decnumber.html
[ref 12-4]: http://www.netlib.org/misc/intel/
[ref 12-5]: https://github.com/xwu/NumericAnnex/blob/master/Sources/Rational.swift

### Striding

> _Background:_
>
> As would occur in any other language, repeated addition of a `stride` amount
> to a binary floating-point value can cause accumulation of rounding error. For
> instance:
> 
> ``` swift
> let stride = 0.1
> var x = 1.0
> 
> x += stride
> x += stride
> print(x - 1.2)  // 2.2204460492503131e-16
> 
> x += stride
> x += stride
> print(x - 1.4)  // 4.4408920985006262e-16
> ```

In Swift 4.0, `stride(from: 1.0, to: 2.0, by: 0.1)` avoids accumulation of
rounding error by instead computing the sequence of values as follows: `1.0`,
`1.0 + 1.0 * 0.1`, `1.0 + 2.0 * 0.1`, `1.0 + 3.0 * 0.1`...

Although this method of computing the sequence avoids an undesired artifact,
users should nonetheless be aware that the result will not be equivalent to that
obtained by repeated addition.

### Fused multiply-add

In Swift 4.0, the sequence `stride(from: -0.2, through: 1.0, by: 0.2)` does not
include the value `1.0`.

Despite avoiding _accumulated_ rounding error from repeated addition, the
expression `-0.2 + 6.0 * 0.2` evaluates to `1.0000000000000002` due to
intermediate rounding error.

The IEEE 754 operation fusedMultiplyAdd allows the same operation to be
performed in one step with a single rounding, improving the accuracy of the
result. This operation is available in Swift as the instance method
`addingProduct(_:_:)`. For example:

```swift
-0.2 + 6.0 * 0.2               // 1.0000000000000002
(-0.2).addingProduct(6.0, 0.2) // 1
```

By altering the implementation of `stride(from:through:by:)` in Swift 4.1 to
use the fused multiply-add operation, the sequence
`stride(from: -0.2, through: 1.0, by: 0.2)` now includes the value `1.0`.

> The fusedMultiplyAdd operation was added to Swift as part of the Swift
> Evolution proposal [SE-0067: Enhanced floating-point protocols][ref 11-9].
> Intermediate rounding error in floating-point strides was eliminated in the
> Swift standard library in [late 2017][ref 12-6].

__A brief caveat about fused multiply-add operations:__ Although eliminating
intermediate rounding can improve the accuracy of results, it is not always the
case that an algorithm will benefit from its use. [William Kahan points
out][ref 12-7] that, for a sufficiently large value `a`, we observe:

```swift
let a = 9007199254740991.0
(a * a - a * a).squareRoot()              // 0, as expected
(a * a).addingProduct(-a, a).squareRoot() // nan
```

This result is observed because `a * a` cannot be represented exactly as a value
of type `Double`. In fact, `(a * a).addingProduct(-a, a)` actually computes the
amount by which `a * a` is inexact. Since `a * a` is rounded down, that amount
is negative, and therefore taking the square root gives NaN.

[ref 11-9]: https://github.com/apple/swift-evolution/blob/master/proposals/0067-floating-point-protocols.md
[ref 12-6]: https://github.com/apple/swift/pull/13007
[ref 12-7]: https://people.eecs.berkeley.edu/~wkahan/ieee754status/ieee754.ps

### Approximating π

In Swift, each floating-point type has a static property `pi` that provides the
value for π at its best possible precision, accurately __rounded toward zero__.

The purpose of rounding toward zero is to avoid angles computed in radians
from being rounded to a different quadrant. As a consequence,
`Float.pi < Float(Double.pi)` evaluates to `true`.

### Unit in the last place

_Incomplete_

### Subnormal values on arm32

_Incomplete_

### Rounding direction

_Incomplete_

---

Previous:  
[Concrete binary floating-point types, part 1](fp-part-1.md)

Next:  
Concrete binary floating-point types, part 3

_Draft: 27 February–4 March 2018_
