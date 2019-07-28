Concrete binary floating-point types, part 1
============================================

## Introduction

The Swift standard library provides, depending on the platform, either two or
three concrete floating-point types. Again, these are all defined as value types
wrapping [LLVM primitive types from the `Builtin` module][ref 11-1]:

```swift
@frozen
public struct Float {
  public // @testable
  var _value: Builtin.FPIEEE32
  /* ... */
}
```

Two floating-point types, `Float` and `Double`, are available on all platforms
supported by Swift. They are 32-bit and 64-bit types, respectively, and [type
aliases][ref 11-2] are provided so that users can instead refer to these types
as `Float32` and `Float64`.

For the `i386` and `x86_64` architectures, the extended-precision floating-point
type `Float80` is also supported, except on Windows. On supported platforms, C's
`long double` data type is [mapped][ref 11-3] to `Float80` in Swift 4.2+, which
makes it possible to use the full set of math functions for `Float80` that are
available on the platform. (In C/C++ programming with the Win32 API, the
`long double` data type [maps to `double`][ref 11-4].)

LLVM [does support half-precision (16-bit) and quadruple-precision (128-bit)
binary floating-point types][ref 11-4.1], but this support is not surfaced by
the Swift standard library. Some platforms offer limited native support for
arithmetic using these formats.

> A future version of Swift [may include][ref 11-4.2] support for a 16-bit IEEE
> 754 binary floating-point type, which would likely be named `Float16`.

[ref 11-1]: https://swift.org/compiler-stdlib/#standard-library-design
[ref 11-2]: https://github.com/apple/swift/blob/bfddc4a763d1ae2f53a8c3281d2d6f08cd1211a0/stdlib/public/core/Policy.swift#L56
[ref 11-3]: https://github.com/apple/swift/pull/14971/
[ref 11-4]: https://msdn.microsoft.com/en-us/library/9cx8xs15.aspx
[ref 11-4.1]: https://internals.rust-lang.org/t/pre-rfc-introduction-of-half-and-quadruple-precision-floats-f16-and-f128/7521
[ref 11-4.2]: https://forums.swift.org/t/add-float16/19370

### IEEE 754

Swift, like many other languages, attempts to provide a floating-point
implementation faithful to the [IEEE 754][ref 11-5] technical standard.

> _Background:_
>
> For floating-point types, IEEE 754 defines basic and interchange formats,
> rounding rules, required operations, and exception handling that are meant to
> enable reliability and portability.
>
> A full overview of IEEE 754 is well beyond the scope of this article; some key
> aspects of the standard are as follows:
>
> * Data types are able to represent __NaN__ ("not a number"), positive and
>   negative infinity, and [__subnormal numbers__][ref 11-6] that are very close
>   to zero. 
>
> * Addition, subtraction, multiplication, division, and square root are
>   required operations that must be __correctly rounded__; that is, the result
>   must be the representable value closest to the exact mathematical answer,
>   rounded according to the chosen __rounding mode__.
>
> * There are five types of __floating-point exceptions__--invalid, division by
>   zero, overflow, underflow, and inexact--which (controversially) are to be
>   logged using global flags.
>
> * A large set of functions (such as sine and cosine) are recommended but not
>   required.

Until recently, LLVM lacked [constrained floating-point intrinsics][ref 11-7] to
support the use of dynamic rounding modes or floating-point exception behavior.
By default, the rounding mode is assumed to be round-to-nearest and
floating-point exceptions are ignored.

Swift does not expose any APIs to change the rounding mode or floating-point
exception behavior, nor is it possible to interrogate floating-point status
flags. (Such limitations are [also found in Rust][ref 11-8].)

> Note that the __rounding mode__, or the rounding rule used to fit a result to
> the precision of a given floating-point format (IEEE 754-2008 §4.3), is _not_
> necessarily the same as the rounding rule used to round a value to the nearest
> integer (IEEE 754-2008 §5.9). In Swift, it is not possible to change the
> former, but it is possible to choose any rule for the latter.
>
> Note that __floating-point exceptions__ are to be distinguished from Swift
> errors and from runtime traps.

[ref 11-5]: http://eng.umb.edu/~cuckov/classes/engin341/Reference/IEEE754.pdf
[ref 11-6]: https://en.wikipedia.org/wiki/Denormal_number
[ref 11-7]: http://llvm.org/docs/LangRef.html#constrained-floating-point-intrinsics
[ref 11-8]: https://github.com/rust-lang/rust/issues/10186

### C mathematical functions

The Swift standard library provides an "overlay" that makes some changes to
improve the user experience of working with C mathematical functions and
disables certain incompatible functions.

IEEE 754 recommends, but does not require, implementations to provide elementary
functions such as sine, arctangent, and binary logarithm. The Swift standard
library will offer APIs for such operations [in a future version of
Swift][ref 11-8.1]. For now, the Swift standard library provides only IEEE 754
required operations such as square root; for other functions, users need to use
the C standard library, which can be imported on macOS as part of the `Darwin`
module and on Linux as part of the `Glibc` module (alternatively, users can
import the `Foundation` module instead).

> LLVM provides intrinsics that are equivalent to some C mathematical functions,
> including sine and cosine. The Swift overlay substitutes the LLVM intrinsic
> for the corresponding C library function where possible.

Note that not all functions are implemented with identical precision in `Darwin`
and `Glibc`, and the same discrepancies among platforms are applicable to
functions provided by the Swift standard library.

A comparison of IEEE 754 required and recommended operations, their Swift
standard library names, and their C standard library overlay names is presented
below (where `x`, `y`, `z` are values of floating-point type `T`, `n` is a value
of type `Int`, and "Swift x" is a future version of Swift).

<div class="table-wrapper">
<table>
	<thead>
		<tr>
			<th>IEEE 754</th>
			<th>Swift standard library</th>
			<th>C standard library overlay</th>
		</tr>
	</thead>
	<tfoot>
		<tr>
			<td colspan="3"><em>Not shown: conversion and comparison operations<br />
			Not available in Swift: conformance predicates and operations on subsets of flags</em></td>
		</tr>
	</tfoot>
	<tbody>
		<tr>
			<th scope="rowgroup" colspan="3">Homogeneous general computational operations</th>
		</tr>
		<tr>
			<td>roundToIntegral&#8203;TiesToEven(<em>x</em>)</td>
			<td><code>x.rounded(&#8203;.toNearestOrEven)</code></td>
			<td></td>
		</tr>
		<tr>
			<td>roundToIntegral&#8203;TiesToAway(<em>x</em>)</td>
			<td><code>x.rounded()</code><br />
				&nbsp;&nbsp;<em>or</em><br />
				<code>x.rounded(&#8203;.toNearestOrAwayFromZero)</code></td>
			<td><code>round(x)</code></td>
		</tr>
		<tr>
			<td>roundToIntegral&#8203;TowardZero(<em>x</em>)</td>
			<td><code>x.rounded(&#8203;.towardZero)</code></td>
			<td><code>trunc(x)</code></td>
		</tr>
		<tr>
			<td>roundToIntegral&#8203;TowardPositive(<em>x</em>)</td>
			<td><code>x.rounded(.up)</code></td>
			<td><code>ceil(x)</code></td>
		</tr>
		<tr>
			<td>roundToIntegral&#8203;TowardNegative(<em>x</em>)</td>
			<td><code>x.rounded(.down)</code></td>
			<td><code>floor(x)</code></td>
		</tr>
		<tr>
			<td>roundToIntegral&#8203;Exact(<em>x</em>)</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>nextUp(<em>x</em>)</td>
			<td><code>x.nextUp</code></td>
			<td><em>Unavailable (Swift x):</em><br /><code>nextafter(x, .infinity)</code></td>
		</tr>
		<tr>
			<td>nextDown(<em>x</em>)</td>
			<td><code>x.nextDown</code></td>
			<td><em>Unavailable (Swift x):</em><br /><code>nextafter(x, -.infinity)</code></td>
		</tr>
		<tr>
			<td>remainder(<em>x</em>, <em>y</em>)</td>
			<td><code>x.remainder(&#8203;dividingBy: y)</code></td>
			<td><code>remainder(x, y)</code></td>
		</tr>
		<tr>
			<td></td>
			<td><code>x.truncatingRemainder(&#8203;dividingBy: y)</code></td>
			<td><code>fmod(x, y)</code></td>
		</tr>
		<tr>
			<td>minNum(<em>x</em>, <em>y</em>)</td>
			<td><code>T.minimum(x, y)</code></td>
			<td><em>Unavailable (Swift x):</em><br /><code>fmin(x, y)</code></td>
		</tr>
		<tr>
			<td>maxNum(<em>x</em>, <em>y</em>)</td>
			<td><code>T.maximum(x, y)</code></td>
			<td><em>Unavailable (Swift x):</em><br /><code>fmax(x, y)</code></td>
		</tr>
		<tr>
			<td></td>
			<td><code>Swift.max(x - y, 0)</code></td>
			<td><code>fdim(x, y)</code></td>
		</tr>
		<tr>
			<td>minNumMag(<em>x</em>, <em>y</em>)</td>
			<td><code>T.minimumMagnitude(&#8203;x, y)</code></td>
			<td></td>
		</tr>
		<tr>
			<td>maxNumMag(<em>x</em>, <em>y</em>)</td>
			<td><code>T.maximumMagnitude(&#8203;x, y)</code></td>
			<td></td>
		</tr>
	</tbody>
	<tbody>
		<tr>
			<th scope="rowgroup" colspan="3">Scaling operations</th>
		</tr>
		<tr>
			<td>scaleB(<em>x</em>, <em>n</em>)</td>
			<td><code>T(sign: .plus, exponent: n, significand: x)</code></td>
			<td><code>scalbn(x, n)</code></td>
		</tr>
		<tr>
			<td>logB(<em>x</em>)</td>
			<td><code>x.exponent</code></td>
			<td><em>Unavailable (Swift 4.2):</em><br /><code>ilogb(x)</code></td>
		</tr>
	</tbody>
	<tbody>
		<tr>
			<th scope="rowgroup" colspan="3">Arithmetic operations (excluding conversion operations)</th>
		</tr>
		<tr>
			<td>addition(<em>x</em>, <em>y</em>)</td>
			<td><code>x + y</code></td>
			<td></td>
		</tr>
		<tr>
			<td>subtraction(<em>x</em>, <em>y</em>)</td>
			<td><code>x - y</code></td>
			<td></td>
		</tr>
		<tr>
			<td>multiplication(<em>x</em>, <em>y</em>)</td>
			<td><code>x * y</code></td>
			<td></td>
		</tr>
		<tr>
			<td>division(<em>x</em>, <em>y</em>)</td>
			<td><code>x / y</code></td>
			<td></td>
		</tr>
		<tr>
			<td>squareRoot(<em>x</em>)</td>
			<td><code>x.squareRoot()</code><br />
				&nbsp;&nbsp;<em>or (Swift x)</em><br />
				<code>T.sqrt(x)</code></td>
			<td><code>sqrt(x)</code></td>
		</tr>
		<tr>
			<td>fusedMultiplyAdd(<em>x</em>, <em>y</em>, <em>z</em>)</td>
			<td><code>z.addingProduct(x, y)</code></td>
			<td><code>fma(x, y, z)</code></td>
		</tr>
	</tbody>
	<tbody>
		<tr>
			<th scope="rowgroup" colspan="3">Sign bit operations</th>
		</tr>
		<tr>
			<td>copy(<em>x</em>)</td>
			<td><code>x</code></td>
			<td></td>
		</tr>
		<tr>
			<td>negate(<em>x</em>)</td>
			<td><code>-x</code></td>
			<td></td>
		</tr>
		<tr>
			<td>abs(<em>x</em>)</td>
			<td><code>abs(x)</code><br />
				&nbsp;&nbsp;<em>or</em><br />
				<code>x.magnitude</code></td>
			<td><em>Unavailable (Swift 4.2):</em><br /><code>fabs(x)</code></td>
		</tr>
		<tr>
			<td>copySign(<em>x</em>, <em>y</em>)</td>
			<td><code>T(signOf: y, magnitudeOf: x)</code></td>
			<td><code>copysign(x, y)</code></td>
		</tr>
	</tbody>
	<tbody>
		<tr>
			<th scope="rowgroup" colspan="3">General non-computational operations</th>
		</tr>
		<tr>
			<td>class(<em>x</em>)</td>
			<td><code>x.floatingPointClass</code></td>
			<td><em>Unavailable:</em><br /><code>fpclassify(x)</code></td>
		</tr>
		<tr>
			<td>isSignMinus(<em>x</em>)</td>
			<td><code>x.sign == .minus</code></td>
			<td><em>Unavailable:</em><br /><code>signbit(x)</code></td>
		</tr>
		<tr>
			<td>isNormal(<em>x</em>)</td>
			<td><code>x.isNormal</code></td>
			<td><em>Unavailable:</em><br /><code>isnormal(x)</code></td>
		</tr>
		<tr>
			<td>isFinite(<em>x</em>)</td>
			<td><code>x.isFinite</code></td>
			<td><em>Unavailable:</em><br /><code>isfinite(x)</code></td>
		</tr>
		<tr>
			<td>isZero(<em>x</em>)</td>
			<td><code>x.isZero</code></td>
			<td></td>
		</tr>
		<tr>
			<td>isSubnormal(<em>x</em>)</td>
			<td><code>x.isSubnormal</code></td>
			<td></td>
		</tr>
		<tr>
			<td>isInfinite(<em>x</em>)</td>
			<td><code>x.isInfinite</code></td>
			<td><em>Unavailable:</em><br /><code>isinf(x)</code></td>
		</tr>
		<tr>
			<td>isNaN(<em>x</em>)</td>
			<td><code>x.isNaN</code></td>
			<td><em>Unavailable:</em><br /><code>isnan(x)</code></td>
		</tr>
		<tr>
			<td>isSignaling(<em>x</em>)</td>
			<td><code>x.isSignalingNaN</code></td>
			<td></td>
		</tr>
		<tr>
			<td>isCanonical(<em>x</em>)</td>
			<td><code>x.isCanonical</code></td>
			<td></td>
		</tr>
		<tr>
			<td>radix(<em>x</em>)</td>
			<td><code>T.radix</code></td>
			<td></td>
		</tr>
		<tr>
			<td>totalOrder(<em>x</em>, <em>y</em>)</td>
			<td><code>x.isTotallyOrdered(&#8203;belowOrEqualTo: y)</code></td>
			<td></td>
		</tr>
		<tr>
			<td>totalOrderMag(<em>x</em>, <em>y</em>)</td>
			<td></td>
			<td></td>
		</tr>
	</tbody>
	<tbody>
		<tr>
			<th scope="rowgroup" colspan="3">Additional elementary functions (Swift x)</th>
		</tr>
		<tr>
			<td>sin</td>
			<td><code>T.sin(x)</code></td>
			<td><code>sin(x)</code></td>
		</tr>
		<tr>
			<td>cos</td>
			<td><code>T.cos(x)</code></td>
			<td><code>cos(x)</code></td>
		</tr>
		<tr>
			<td>tan</td>
			<td><code>T.tan(x)</code></td>
			<td><code>tan(x)</code></td>
		</tr>
		<tr>
			<td>sinPi</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>cosPi</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>asin</td>
			<td><code>T.asin(x)</code></td>
			<td><code>asin(x)</code></td>
		</tr>
		<tr>
			<td>acos</td>
			<td><code>T.acos(x)</code></td>
			<td><code>acos(x)</code></td>
		</tr>
		<tr>
			<td>atan</td>
			<td><code>T.atan(x)</code></td>
			<td><code>atan(x)</code></td>
		</tr>
		<tr>
			<td>atanPi</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>sinh</td>
			<td><code>T.sinh(x)</code></td>
			<td><code>sinh(x)</code></td>
		</tr>
		<tr>
			<td>cosh</td>
			<td><code>T.cosh(x)</code></td>
			<td><code>cosh(x)</code></td>
		</tr>
		<tr>
			<td>tanh</td>
			<td><code>T.tanh(x)</code></td>
			<td><code>tanh(x)</code></td>
		</tr>
		<tr>
			<td>asinh</td>
			<td><code>T.asinh(x)</code></td>
			<td><code>asinh(x)</code></td>
		</tr>
		<tr>
			<td>acosh</td>
			<td><code>T.acosh(x)</code></td>
			<td><code>acosh(x)</code></td>
		</tr>
		<tr>
			<td>atanh</td>
			<td><code>T.atanh(x)</code></td>
			<td><code>atanh(x)</code></td>
		</tr>
		<tr>
			<td>exp</td>
			<td><code>T.exp(x)</code></td>
			<td><code>exp(x)</code></td>
		</tr>
		<tr>
			<td>exp2</td>
			<td><code>T.exp2(x)</code></td>
			<td><code>exp2(x)</code></td>
		</tr>
		<tr>
			<td>exp10</td>
			<td><code>T.exp10(x)</code><br />
				&nbsp;&nbsp;<em>or</em><br />
				<code>exp10(x)</code></td>
			<td></td>
		</tr>
		<tr>
			<td>expm1</td>
			<td><code>T.expm1(x)</code></td>
			<td><code>expm1(x)</code></td>
		</tr>
		<tr>
			<td>exp2m1</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>exp10m1</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>log</td>
			<td><code>T.log(x)</code></td>
			<td><code>log(x)</code></td>
		</tr>
		<tr>
			<td>log2</td>
			<td><code>T.log2(x)</code></td>
			<td><code>log2(x)</code></td>
		</tr>
		<tr>
			<td></td>
			<td><code>T.log2(x)&#8203;.rounded(.down)</code></td>
			<td><em>Unavailable (Swift x):</em><br /><code>logb(x)</code></td>
		</tr>
		<tr>
			<td>log10</td>
			<td><code>T.log10(x)</code></td>
			<td><code>log10(x)</code></td>
		</tr>
		<tr>
			<td>logp1</td>
			<td><code>T.log1p(x)</code></td>
			<td><code>log1p(x)</code></td>
		</tr>
		<tr>
			<td>log2p1</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>log10p1</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>compound(<em>x</em>, <em>n</em>)</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>pow(<em>x</em>, <em>y</em>)</td>
			<td><code>T.pow(x, y)</code></td>
			<td><code>pow(x, y)</code></td>
		</tr>
		<tr>
			<td>powr(<em>x</em>, <em>y</em>)</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>pown(<em>x</em>, <em>n</em>)</td>
			<td><code>T.pow(x, n)</code><br />
				&nbsp;&nbsp;<em>or</em><br />
				<code>pow(x, n)</code></td>
			<td></td>
		</tr>
		<tr>
			<td>rootn(<em>x</em>, <em>n</em>)</td>
			<td><code>T.root(x, n)</code><br />
				&nbsp;&nbsp;<em>or</em><br />
				<code>root(x, n)</code></td>
			<td></td>
		</tr>
		<tr>
			<td></td>
			<td><code>T.root(x, 3)</code><br />
				&nbsp;&nbsp;<em>or</em><br />
				<code>root(x, 3)</code></td>
			<td><code>cbrt(x)</code></td>
		</tr>
		<tr>
			<td>rSqrt</td>
			<td></td>
			<td></td>
		</tr>
	</tbody>
	<tbody>
		<tr>
			<th scope="rowgroup" colspan="3">Additional real operations (Swift x)</th>
		</tr>
		<tr>
			<td>atan2(<em>y</em>, <em>x</em>)</td>
			<td><code>T.atan2(y: y, x: x)</code><br />
				&nbsp;&nbsp;<em>or</em><br />
				<code>atan2(y: y, x: x)</code></td>
			<td><code>atan2(y, x)</code></td>
		</tr>
		<tr>
			<td>atan2Pi(<em>y</em>, <em>x</em>)</td>
			<td></td>
			<td></td>
		</tr>
		<tr>
			<td>hypot(<em>x</em>, <em>y</em>)</td>
			<td><code>T.hypot(x, y)</code></td>
			<td><code>hypot(x, y)</code></td>
		</tr>
		<tr>
			<td></td>
			<td><code>T.erf(x)</code></td>
			<td><code>erf(x)</code></td>
		</tr>
		<tr>
			<td></td>
			<td><code>T.erfc(x)</code></td>
			<td><code>erfc(x)</code></td>
		</tr>
		<tr>
			<td></td>
			<td><code>T.gamma(x)</code><br />
				&nbsp;&nbsp;<em>or</em><br />
				<code>gamma(x)</code></td>
			<td><code>tgamma(x)</code></td>
		</tr>
		<tr>
			<td></td>
			<td><code>(T.logGamma(x), T.signGamma(x) == .plus ? 1 : -1)</code><br />
				&nbsp;&nbsp;<em>or</em><br />
				<code>(logGamma(x), signGamma(x) == .plus ? 1 : -1)</code></td>
			<td><code>lgamma(x)</code></td>
		</tr>
	</tbody>
</table>
</div>

> Current implementations of `T.pow(x, n)` and `T.root(x, n)` give inaccurate
> results if `n` is so large that conversion to `T` would round.

> For more information on the additional elementary functions and real
> operations to be added in a future version of Swift, see the Swift Evolution
> proposal [SE-0246: Generic math(s) functions][ref 11-8.2].

[ref 11-8.1]: https://github.com/apple/swift/pull/25302
[ref 11-8.2]: https://github.com/apple/swift-evolution/blob/master/proposals/0246-mathable.md

### Finite constants

Similarly, some finite constants defined in the C standard library have
equivalent static properties in the Swift standard library with clarified names.

<div class="table-wrapper" markdown="1">

| Swift                     | C (`float`)    | C (`double`)   |
|---------------------------|----------------|----------------|
| `greatestFiniteMagnitude` | `FLT_MAX`      | `DBL_MAX`      |
| `leastNormalMagnitude`    | `FLT_MIN`      | `DBL_MIN`      |
| `leastNonzeroMagnitude`   | `FLT_TRUE_MIN` | `DBL_TRUE_MIN` |
| `pi`                      |                | `M_PI`         |
| `ulpOfOne`                | `FLT_EPSILON`  | `DBL_EPSILON`  |

</div>

The use of "max" and "min" can be misleading. Even [within the Swift project
itself][ref 11-9], users have mistaken `FLT_MIN` for the minimum representable
value (by analogy with `Int.min`). However, `FLT_MIN` is not even negative. Nor
is it the least representable _positive_ value if the platform supports
subnormal values: in C, that value is known as `FLT_TRUE_MIN`.

Note that `.pi` is rounded toward zero for reasons discussed later.
Consequently, `Float(M_PI) != .pi`.

The use of "epsilon" was avoided because that term has varying definitions among
other programming languages and suggests that it might be appropriate for use as
a measure of tolerance for floating-point comparisons, which is generally
inadvisable.

> For more information on the rationale for names chosen in Swift, see the Swift
> Evolution proposal [SE-0067: Enhanced floating-point protocols][ref 11-10].

[ref 11-9]: https://github.com/apple/swift-corelibs-foundation/pull/631
[ref 11-10]: https://github.com/apple/swift-evolution/blob/master/proposals/0067-floating-point-protocols.md

---

Previous:  
[Concrete integer types, part 2](integers-part-2.md)

Next:  
[Concrete binary floating-point types, part 2](floating-point-part-2.md)

_27 February–3 March 2018_  
_Updated 28 July 2019_
