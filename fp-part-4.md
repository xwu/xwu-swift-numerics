Concrete binary floating-point types, part 4
============================================

## Signed zero, infinity, and NaN

> _Background:_
>
> IEEE 32-bit and 64-bit binary floating-point types have no more than one
> representation of each non-zero finite number, and each representation has
> only one encoding. (For historical reasons, the extended-precision 80-bit
> binary floating-point type does support a second, non-canonical encoding of
> some representations.)
>
> Because the sign is represented independently of the significand, there are
> two representations of zero: positive zero and negative zero. They compare
> equal to one another but are not substitutable for all arithmetic operations.
> For example, the reciprocal of positive zero is positive infinity, but the
> reciprocal of negative zero is negative infinity. This behavior is specified
> by the IEEE 754 standard and is common to many languages.
>
> When all the bits used to encode the exponent are non-zero, the encoded value
> is not finite. Instead, that value is positive infinity, negative infinity, or
> [NaN ("not a number")][ref XX-1]. The rationale for supporting these values is
> beyond the scope of this article. Briefly, however:
>
> The result of an operation that is too large in magnitude to be represented as
> a finite value __overflows__ to positive or negative infinity. (The result of
> an operation that is too small in magnitude to be represented as a non-zero
> value __underflows__ to zero.)
>
> Dividing 0.0 by 0.0 is considered "invalid" and the result of that operation
> is NaN, as specified by the IEEE 754 standard. Other cases in which the result
> of an operation is NaN are carefully enumerated by the standard; the rationale
> for such behavior is well beyond the scope of this article.
>
> However, for the present purposes, it is helpful to know that NaN results can
> be safely propagated (not unlike "optional chaining" in Swift) through most
> subsequent floating-point calculations so that it is generally unnecessary to
> check whether each intermediate result is NaN during a complicated calculation
> (if the ultimate result is of a floating-point type that can represent NaN).
> The behavior of NaN operands can be different if using an alternative
> floating-point exception behavior; as mentioned previously, it is not possible
> to change the floating-point exception behavior in Swift.
>
> NaN values can be counterintuitive for users unfamiliar with floating-point
> arithmetic. The IEEE 754 standard requires that NaN compare not equal to any
> value, including itself. Many generic algorithms expect __reflexivity__ of
> equality—that is, every value should be equal to itself—but this expectation
> does not hold in the case of NaNs.
>
> Because most bits available to encode a floating-point value are not necessary
> to indicate that the value is NaN, the IEEE 754 standard specifies that unused
> bits can encode a __payload__, which can represent diagnostic information or
> can be put to some other use that is entirely left to the user's discretion.
> The payload is ignored by all required IEEE 754 operations but is propagated
> when possible. NaNs with different payloads are nonetheless all considered to
> represent NaN.
>
> Signaling NaNs are a reserved subset of NaNs that are intended to signal an
> "invalid" floating-point exception when used as input for operations; they are
> then "quieted" for propagation like other NaNs. As mentioned previously,
> floating-point exceptions are ignored in the default floating-point exception
> behavior, and it is not possible to change the default behavior in Swift.

In Swift, zero and infinity (available as the static property `infinity`) behave
as they do in other languages. The sign of zero or infinity can be changed using
the prefix operator `-`.

> Recall that __integer__ literals do not support signed zero (in other words,
> `-0 as Float` evaluates to positive zero). Use either parentheses, as in
> `-(0 as Float)`, or use a __float__ literal, as in `-0.0 as Float`, to obtain
> the desired value.

In Swift, the static property `nan` is a quiet NaN of the corresponding binary
floating-point type, and the static property `signalingNaN` is a signaling NaN
of that type. The instance property `isNaN` evaluates to `true` for any NaN
value, quiet or signaling; the instance property `isSignalingNaN` evaluates to
`true` only for a signaling NaN.

> Always use the expression `x.isNaN` (or, as is idiomatic in other languages,
> `x != x`) instead of using the expression `x == .nan` to test for the presence
> of NaN.

It is possible to create a particular encoding of NaN by using the initializer
`init(nan:signaling:)`, where the first argument is the payload and the second
is a Boolean value to indicate whether the result should be a signaling NaN. To
change the sign of NaN, use the prefix operator `-`.

IEEE 754-2008 specifies that, for encodings of NaN, the most significant bit of
the significand field is a flag that is non-zero if the NaN is quiet and zero if
the NaN is signaling. All remaining bits of the significand field are part of
the payload.

However, Swift also reserves the second-most significant bit of the significand
field as a flag; that bit is nonzero when NaN is signaling. (The converse is not
true: if the most significant bit of the significand field is non-zero, then NaN
is quiet, as required by IEEE 754-2008, regardless of the value of the
second-most significant bit.)

Therefore, the maximum bit width of the NaN payload is one less than specified
by IEEE 754-2008. For example, a runtime error results when attempting to use a
51-bit payload for a NaN of type `Double`:

```swift
Double(nan: 1 << 50, signaling: false)
// Fatal error: NaN payload is not encodable
```

However, if a `Double` value with such a payload is initialized by other means,
Swift does correctly treat the value as a quiet NaN:

```swift
let x = Double(bitPattern: 0x7ffc000000000000)
(x.isNaN, x.isSignalingNaN)  // (true, false)
```

When an operation required by IEEE 754 returns NaN, its exact encoding is not
specified by the standard. In Swift, the encoding can vary based on the
underlying architecture, and results may not match that obtained in C/C++ on the
same machine.

For example, in Swift on x86_64 macOS:

```swift
let x = -Double.nan
let y = x + 0

print(x.bitPattern == y.bitPattern)
// Prints "false"
```

By contrast, in C on x86_64 macOS:

```c
#include <stdio.h>
#include <math.h>

union f64 {
  uint64_t u64;
  double d;
};

int main(int argc, const char * argv[]) {
  union f64 x;
  x.d = -nan("");
  union f64 y;
  y.d = x.d + 0.;

  printf("%s\n", x.u64 == y.u64 ? "true" : "false");
  return 0;
}
// Prints "true"
```

[ref XX-1]: https://en.wikipedia.org/wiki/NaN

### Describing NaN

In Swift, any NaN value is described as "nan":

```swift
Double.nan.description                   // "nan"
(-Double.nan).description                // "nan"
Double.signalingNaN.description          // "nan"
(-Double.signalingNaN).description       // "nan"
Double(nan: 1, signaling: false)
  .description                           // "nan"
```

The debug description can be used to obtain more information about the sign and
payload of NaN values:

```swift
Double.nan.debugDescription              // "nan"
(-Double.nan).debugDescription           // "-nan"
Double.signalingNaN.debugDescription     // "snan"
(-Double.signalingNaN).debugDescription  // "-snan"
Double(nan: 1, signaling: false)
  .debugDescription                      // "nan(0x1)"
```

These debug descriptions round-trip correctly when converted back to the
floating-point type:

```swift
Double("snan")!.isSignalingNaN 
// true
Double("nan(0x1)")!.isNaN
// true
String(Double("nan(0x1)")!.bitPattern, radix: 16)
// 7ff8000000000001
```

### Minimum, maximum, and total order

_Incomplete_

## Floating-point remainder

> _Background:_
>
> IEEE 754 specifies a remainder operation that has behavior unlike that of the
> binary integer remainder operation.

In Swift, as in other languages, two similar remainder operations exist for
floating-point types:

|          | Nearest-to-zero remainder  | Truncating remainder |
|----------|----------------------------|----------------------|
| Swift    | <code class="manual-escape">x.remainder(&#8203;dividingBy: y)</code> | <code class="manual-escape">x.truncatingRemainder(&#8203;dividingBy: y)</code> |
| C        | `remainder(x, y)`          | `fmod(x, y)`         |
| C#       | `Math.IEEERemainder(x, y)` | `x % y`              |
| Java     | `Math.IEEEremainder(x, y)` | `x % y`              |
| Kotlin   | `x.IEEErem(y)`             | `x % y`              |

The __nearest-to-zero remainder__ of _x_ dividing by _y_ is the exact result _r_
such that _x_ = _y_&nbsp;×&nbsp;_q_&nbsp;+&nbsp;_r_, where _q_ is the nearest
integer value to _x_&nbsp;÷&nbsp;_y_. (The actual computation is performed
without intermediate rounding and _q_ does not need to be representable as a
value of any type.) Notice that _r_ could be positive or negative, regardless of
the sign of the operands; the magnitude of _r_ is no more than half of the
magnitude of the divisor _y_.

The __truncating remainder__ of _x_ dividing by _y_ is the exact result _s_ such
that _x_ = _y_&nbsp;×&nbsp;_p_&nbsp;+&nbsp;_s_, where _p_ is the result of
_x_&nbsp;÷&nbsp;_y_ rounded toward zero to an integer value. (The actual
computation is performed without intermediate rounding and _p_ does not need to
be representable as value of any type.) Notice that the sign of _s_ is the same
as the sign of the dividend _x_; the magnitude of _s_ is always less than the
magnitude of the divisor _y_.

For both operations, the remainder of dividing an infinite value by any value,
or of dividing any value by zero, is NaN.

> In early versions of Swift, the truncating remainder operation was spelled
> `%`. However, it was thought that users often used the operator incorrectly,
> so it was removed from floating-point types in the Swift Evolution proposal
> [SE-0067: Enhanced floating-point protocols][ref XX-2].

[ref XX-2]: https://github.com/apple/swift-evolution/blob/master/proposals/0067-floating-point-protocols.md

## Significand representation

_Incomplete_

---

Previous:  
Concrete binary floating-point types, part 3

Next:  
Foundation.Decimal and Foundation.NSNumber

_Draft: 9–10 March 2018_
