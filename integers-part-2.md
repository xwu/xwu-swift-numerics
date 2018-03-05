Concrete integer types, part 2
==============================

## Operator precedence

In C, operators evolved over time, and [their precedence is a product of that
historical legacy][ref 5-1]. C++, Java, and other "C family" languages have
generally preserved the relative precedence of operators found in C.

In Swift, however, operator precedence has been rationalized. The resulting
[precedence table][ref 5-2] is similar to [that of Go][ref 5-3]. Consequently,
an integer expression in Swift can appear to be similar to an expression in
another language but evaluate quite differently:

```swift
var v = 42
v = v + (v >> 4) & 0x0F0F0F0F
// In Swift (and Go), `v` is equal to 44.
```

```javascript
var v = 42
v = v + (v >> 4) & 0x0F0F0F0F
// In JavaScript, `v` is equal to 12.
```

The relative precedence of infix operators __common to both C and Swift__ can be
compared as follows:

| C                                                     | Swift                                                 |
|:-----------------------------------------------------:|:-----------------------------------------------------:|
|                                                       | `<<` `>>`                                             |
| `*` `/` `%`                                           | `*` `/` `%` `&`                                       |
| `+` `-`                                               | `+` `-` `^` <code class="manual-escape">&#124;</code> |
| `<<` `>>`                                             |                                                       |
| `<` `<=` `>` `>=`                                     | `<` `<=` `>` `>=` `==` `!=`                           |
| `==` `!=`                                             |                                                       |
| `&`                                                   |                                                       |
| `^`                                                   |                                                       |
| <code class="manual-escape">&#124;</code>             |                                                       |
| `&&`                                                  | `&&` <code class="manual-escape">&#124;&#124;</code>  |
| <code class="manual-escape">&#124;&#124;</code>       |                                                       |
| `=` `*=` `/=` `%=` `+=` `-=` `<<=` `>>=` `&=` `^=` <code class="manual-escape">&#124;=</code> | `=` `*=` `/=` `%=` `+=` `-=` `<<=` `>>=` `&=` `^=` <code class="manual-escape">&#124;=</code> |

[ref 5-1]: https://www.lysator.liu.se/c/dmr-on-or.html
[ref 5-2]: https://developer.apple.com/documentation/swift/operator_declarations
[ref 5-3]: https://golang.org/ref/spec#Operator_precedence

## Overflow behavior

> Rust now takes a similar approach for handling integer overflow; therefore,
> Swift users may find [a write-up about Rust's design evolution][ref 6-1] to be
> useful.

As mentioned previously, Swift's standard arithmetic operators trap on integer
overflow. Integer overflow checking is [disabled][ref 6-2] in `-Ounchecked`
mode, which is not recommended for general use.

A runtime error also occurs in case of overflow in methods such as:

`abs(_:)`  
`negate()`  
`dividingFullWidth(_:)`  
`quotientAndRemainder(dividingBy:)`

In Swift, `abs(_:)` returns a value of the __same type__ as the argument.
(Specifically, the function returns the absolute value of the argument.) For a
signed (and fixed-width) integer type `T`, therefore, a runtime error occurs
when evaluating `abs(T.min)` because the result cannot be represented in `T`.

By contrast, evaluating `T.min.magnitude` does not cause a runtime error;
however, the value is not of type `T` but rather of the __associated type__
`T.Magnitude`. 

> At the time of writing, `dividingFullWidth(_:)` [does not behave as
> documented][ref 6-3] in case of overflow.

[ref 6-1]: https://huonw.github.io/blog/2016/04/myths-and-legends-about-integer-overflow-in-rust/
[ref 6-2]: https://github.com/apple/swift/blob/master/docs/OptimizationTips.rst#enabling-optimizations
[ref 6-3]: https://github.com/apple/swift/blob/642cbbad7cefd08efa9242fd2d75cee356285727/stdlib/public/core/Integers.swift.gyb#L3514

### Overflow operators

In C, the result of an __unsigned__ integer operation that is too large to be
represented __"wraps around"__ (that is, the return value consists of the least
significant bits of the result), while __signed__ integer overflow is
[__undefined behavior__][ref 6-4].

Sometimes, "wrapping" behavior can be desired in Swift (for example, when
performing bitwise manipulations). The Swift standard library offers
alternatives to some standard arithmetic operators that can be used in these
scenarios.

__Three overflow operators__ allow the user to choose C-like "wrapping"
behavior: `&+` (overflow addition), `&-` (overflow subtraction), and `&*`
(overflow multiplication). The behavior of these operations is fully defined for
unsigned and signed integer types.

> The overflow operators `&/` and `&%` were [removed in Swift 1.2][ref 6-5]
> because they did not provide two's-complement behavior like other overflow
> operators.

[ref 6-4]: https://en.wikipedia.org/wiki/Undefined_behavior
[ref 6-5]: https://github.com/apple/swift/blob/master/CHANGELOG.md#swift-12

### Methods reporting overflow

__Five methods reporting overflow__ are provided, largely analogous to Rust's
`overflowing_*` methods:

`addingReportingOverflow(_:)`  
`subtractingReportingOverflow(_:)`  
`multipliedReportingOverflow(by:)`  
`dividedReportingOverflow(by:)`  
`remainderReportingOverflow(dividingBy:)`

In general, these operations return a tuple of a numeric value and a Boolean
value. The numeric value is either the entire result if no overflow occurred
during the operation or the "wrapped" partial result if overflow occurred; the
Boolean value indicates whether or not overflow occurred.

Some caveats are important to point out:

In Swift, `x.dividedReportingOverflow(by: 0)` is documented to return
`(x, true)`. Nonetheless, at time of writing, a division-by-zero error occurs if
the right-hand side (RHS) is expressed as a literal `0`. For example:

```swift
let x = 42
let y = 0
x.dividedReportingOverflow(by: y)
// (partialValue: 42, overflow: true)

x.dividedReportingOverflow(by: 0)
// error: division by zero
```

In Swift, `x.remainderReportingOverflow(dividingBy: 0)` returns `(x, true)`, as
the remainder is mathematically undefined. Otherwise, the method returns
`(0, true)` if the operation overflows (i.e., when dividing by `-1`).
Mathematically, of course, the remainder of division by −1 is always 0. At the
time of writing, a division-by-zero error occurs if the RHS is expressed as a
literal `0`.

> Internally, there are no LLVM primitives for checking overflow after division,
> so checking is [implemented in native Swift][ref 6-6].
>
> Prior to Swift 4.2, `remainderReportingOverflow(dividingBy:)` did not return
> the correct remainder when dividing by `-1`. The behavior was [fixed in early
> 2018][ref 6-7].

[ref 6-6]: https://github.com/apple/swift/blob/642cbbad7cefd08efa9242fd2d75cee356285727/stdlib/public/core/Integers.swift.gyb#L3132
[ref 6-7]: https://github.com/apple/swift/pull/14219

### Unsafe methods

__Four unsafe methods__ are provided:

`unsafeAdding(_:)`  
`unsafeSubtracting(_:)`  
`unsafeMultiplied(by:)`  
`unsafeDivided(by:)`

The behavior of these methods is __undefined__ in case of overflow. Therefore,
they are useful only for avoiding the performance cost of overflow checking, and
they should only be used if it is certain that the result will not overflow. In
debug mode, however, overflow does cause a precondition failure.

It is unclear as to the rationale behind omission of
`unsafeRemainder(dividingBy:)`, although that method is unlikely to be of much
use.

### Full-width methods

Two primitive operations are exposed by the Swift standard library that can be
useful for implementation of an arbitrary-width integer type:

`multipliedFullWidth(by:)` returns a tuple of the high and low parts of a
product that overflows standard multiplication.

`dividingFullWidth(_:)` returns the quotient and remainder after the argument (a
double-width value expressed as a tuple of high and low parts) is divided by the
receiver. As mentioned above, a runtime error may occur if the quotient is not
representable within the bounds of the type.

At the time of writing, the implemented behavior of `dividingFullWidth(_:)` in
case of overflow does not match the documented behavior.

## Integer remainder

The remainder operator `%` (known as the modulo operator in other languages)
adopts [the same truncated division convention observed in many "C family"
languages][ref 7-1], including C99, C++11, C#, D, Java, JavaScript, and Rust.
The result has the same sign as the dividend.

Evaluating `x % 0` results in a division-by-zero error.

[ref 7-1]: https://en.wikipedia.org/wiki/Modulo_operation

## Bitwise operations

Every integer value has the instance property `bitWidth`, which is the number of
bits in the binary representation of the value. All standard library integer
types have a fixed bit width; fixed-width integer types have a __static__
property `bitWidth` which, unsurprisingly, is equal to the instance property
`bitWidth` for any value of that type.

> In generic code, it can be useful to work with the bit width of a fixed-width
> integer type without having to instantiate an instance of that type. A key
> overarching goal of Swift's protocol-based designs is to enable useful generic
> algorithms; this is the reason why fixed-width integers have an instance
> property and a static property that are equal in value.

The following properties of a value's binary representation are also available
in Swift:

* __Count trailing zeros (ctz)__, the number of zero bits that follow the least
  significant one bit in the value's binary representation:
  `trailingZeroBitCount`.
* __Count leading zeros (clz)__, the number of zero bits that precede the most
  significant one bit in the value's binary representation:
  `leadingZeroBitCount`.
* __Population count__, the number of one bits in the value's binary
  representation: `nonzeroBitCount`.

Swift 4+ now has two sets of bit shifting operators to avoid undefined behavior
in the case of overshift or undershift:

* __Smart shifts__ are spelled `<<` and `>>`, with corresponding assignment
  operators.
* __Masking shifts__ are spelled `&<<` and `&>>`, with corresponding assignment
  operators.

The result of a bit shift is always of the same type as the left-hand side
(LHS). In Swift 4+, the type of the right-hand side (RHS) does not need to match
that of the LHS.

### Smart shifts

As in Java, Go, and other languages, `>>` is a right [__arithmetic
shift__][ref 9-1] for signed integers. In other words, the result has the same
sign bit as the LHS.

__Undershift__ occurs when the RHS is negative. A _right_ smart shift by a
negative RHS value `x` is equivalent to a _left_ smart shift by `x.magnitude`,
and vice versa. For example, `x >> -42` is equivalent to `x << 42`.

__Overshift__ occurs when the RHS equals or exceeds the bit width of the LHS. A
_left_ smart shift by such a value is equivalent to filling in each bit of the
result with zero; in other words, the result is `0`. A _right_ smart shift by
such a value is equivalent to filling each bit of the result with the LHS sign
bit; in other words, the result is either `-1` if the LHS is negative or `0` if
the LHS is non-negative.

[ref 9-1]: https://en.wikipedia.org/wiki/Arithmetic_shift

### Masking shifts

Masking shifts, introduced in Swift 4, offer an alternative when branches for
handling undershift and overshift in smart shifts cannot be optimized away by
the compiler and are of concern to performance.

> In Rust, the same operations are known as [__wrapping shifts__][ref 9-2].

These operations are called "masking" because the result is notionally obtained
by shifting the LHS as an abstract binary integer operation (with padding as
necessary), then [masking the result to the number of bits in LHS][ref 9-3].

To obtain the result, the RHS is preprocessed to ensure that it is in the range
`0..<lhs.bitWidth`. For a LHS of arbitrary bit width, preprocessing would
require computing the [modulus after floored division][ref 9-4]. In other words,
the amount by which to shift the LHS can be obtained as follows:

```swift
var shift = rhs % lhs.bitWidth
if shift < 0 { shift += lhs.bitWidth }
```

When the bit width of the LHS is a power of two (as is the case for all standard
library types), the same result can be obtained using a bitwise operation:

```swift
var shift = rhs & (lhs.bitWidth - 1)
```

On most architectures, masking is performed by the CPU's shift instructions and
therefore incurs no additional performance cost.

> Masking shifts and smart shift semantics were introduced as part of the Swift
> Evolution proposal [SE-0104: Protocol-oriented integers][ref 9-5].

[ref 9-2]: https://doc.rust-lang.org/std/primitive.isize.html#method.wrapping_shl
[ref 9-3]: https://forums.swift.org/t/i-think-masking-shift-is-an-incorrect-name/10490/3
[ref 9-4]: https://en.wikipedia.org/wiki/Modulo_operation
[ref 9-5]: https://github.com/apple/swift-evolution/blob/master/proposals/0104-improved-integers.md

<!--
## Words
-->

<!--
> Recommendations:
> * Complete the set of operators with overflow assignment operators (`&+=`)
> * Fix overflow-related bugs
> * Introduce `endian` and `pointerBitWidth` platform conditions
-->

_27 February–4 March 2018_