Concrete binary floating-point types, part 3
============================================

## Integer literals (redux)

All floating-point types in Swift conform to the protocol
`ExpressibleByIntegerLiteral`. Therefore, it is possible to create a new
floating-point value using an __integer literal__.

In an earlier article, [nuances about the use of integer literals](integers-part-1.md#integer-literals)
were discussed that apply equally when they are used to express floating-point
values. Two issues are particularly salient for our purposes here:

1. Recall that integer literals do not support signed zero (in other words,
   `-0 as Float` evaluates to positive zero). Use either parentheses, as in
   `-(0 as Float)`, or use a __float literal__ as discussed below, to obtain the
   desired value.

1. Recall that using a converting initializer with an integer literal argument,
   such as `Double(42)`, is not recommended because it first coerces the literal
   value to type `IntegerLiteralType` and then converts that value to type
   `Double`. This is to be contrasted with using a __type coercion__ operator,
   such as `42 as Double`, where the literal value is directly coerced to type
   `Double`.

## Float literals

A __float literal__ in Swift is similar to analogous expressions in other "C
family" languages. It can be written in either base 10 or base 16 (hexadecimal).

> _Background:_
>
> In Swift, as in other "C family" languages, the whole part of a base 10 float
> literal can be followed by a fractional part beginning with a decimal
> separator dot (`.`), a decimal exponent beginning with `e` or `E`, or both (in
> that order). The digits of the integer exponent can optionally be preceded by
> `-` or `+`.
>
> As with integer literals, float literals can be prepended with the
> hyphen-minus character (`-`) to indicate a negative value.

However, in Swift, a float literal __cannot begin or end with a decimal
separator dot__:

```swift
let x = .5
// error: '.5' is not a valid floating point literal; it must be written '0.5'
let y = 5.
// error: expected member name following '.'
```

(Instead, Swift uses leading dot syntax for implicit member lookup.)

> The same requirement does not apply to conversions from `String`. For example,
> `Double(".5")! == 0.5`.

### Hexadecimal float literals

Unfamiliar to some users, hexadecimal float literals (also specified in C99 and
and C++17) are supported in Swift. They can be useful when you want to represent
the intended binary floating-point value exactly and a decimal literal is
impractical or impossible for the purpose.

Hexadecimal float literals use the base prefix `0x`. Then, the whole part (in
base 16) can optionally be followed by a fractional part (also in base 16)
beginning with the separator dot (`.`). Finally, the literal __must end with a
binary exponent__ beginning with `p` or `P`. The digits of the integer exponent
can optionally be preceded by `-` or `+`. For example:

```swift
let x = 0x1p2
// 1.0 * (2 ** 2) == 4
// Here, we use `**` to represent exponentiation.

let y = 0x1p-2
// 1.0 * (2 ** -2) == 0.25 

let z = 0x1.8p-1
// (1.0 + 8/16) * (2 ** -1) == 0.75

let a = 0xf.fffp-3
// (15.0 + 15/16 + 15/256 + 15/4096) * (2 ** -3)
//   == 1.999969482421875 
```

> In C, the binary exponent is not optional to avoid ambiguity between the
> hexadecimal digit `f` and a suffix `f` indicating that the constant has type
> `float`. In Swift, the binary exponent is not optional even though there is
> no possibility of ambiguity.

As with integer literals, the float literal can be prepended with the
hyphen-minus character (`-`) to indicate a negative value.

In Swift, the portion between the required base prefix and the required binary
exponent __cannot begin or end with the separator dot__, though as of the time
of writing, error messages are not particularly helpful in diagnosing the issue:

```swift
let x = 0x1.p2
// error: value of type 'Int' has no member 'p2'
let y = 0x.1p2
// error: '.' is not a valid hexadecimal digit (0-9, A-F) in integer literal
// error: 'p' is not a valid digit in integer literal
// error: consecutive statements on a line must be separated by ';'
// error: expected identifier after '.' expression
```

> Again, the same requirement does not apply to conversions from `String`.

### Type inference

As discussed previously, literals have no type of their own in Swift. Instead,
the type checker attempts to infer the type of a literal expression based on
other available information such as explicit type annotations.

Besides using an explicit type annotation, the __type coercion__ operator `as`
[(which is to be distinguished from __dynamic cast__ operators `as?`, `as!`, and
`is`)][ref 3-1] can be used to provide information for type inference.

```swift
let x = 42.0 as Float
```

In the absence of other available information, the inferred type of a float
literal expression defaults to `FloatLiteralType`, which is a type alias for
`Double` unless it is shadowed by the user.

__A frequent misunderstanding found even in the Swift project itself__ concerns
the use of a __type conversion__ initializer to indicate the desired type of a
literal expression. For example:

```swift
// Avoid writing such code.
let x = Float(42.0)
```

This frequently gives the intended result, but the function call is __not__
providing information for type inference. Instead, this statement creates an
instance of type `FloatLiteralType` (which again, by default, is a type alias
for `Double`) with the value `42.0`, then __converts__ that value to `Float`.

Since `Float` has less precision than `Double`, a literal value is rounded twice
when that statement is evaluated, which can lead to __double-rounding error__.

```swift
let correct = 8388608.5000000001 as Float
// 8388609
let incorrect = Float(8388608.5000000001)
// 8388608
```

Since `Float80` has more precision than `Double`, the same misunderstanding
causes loss of precision in floating-point values analogous to omission of the
suffix `l` in C/C++ (which must be used to indicate that a constant should have
`long double` type):

```swift
let precise = 3.14159265358979323846 as Float80
// 3.14159265358979323851
let imprecise = Float80(3.14159265358979323846)
// 3.141592653589793116
```

[ref 3-1]: https://github.com/apple/swift-evolution/blob/master/proposals/0083-remove-bridging-from-dynamic-casts.md

### Float literal precision

Notionally, a numeric literal is not limited by the precision of any type
because, again, it has no type.

Under the hood, however, an integer literal is first used to create an internal
2048-bit value (of type `_MaxBuiltinIntegerType`) that is then converted to the
intended type. Likewise, a float literal is first used to create an internal
value of type `_MaxBuiltinFloatType` that is then converted to the intended
type.

This design is more or less sufficient for integer literals (except that signed
zero cannot be supported) because integers with more than 600 decimal digits can
be represented in 2048 bits.

As of the time of writing, __float literals may be incorrectly rounded__ because
`_MaxBuiltinFloatType` is a type alias for `Float80` if supported and `Double`
otherwise. Consequently, float literals that cannot be represented exactly as a
value of type `_MaxBuiltinFloatType` are subject to __double-rounding error__
just as though the value were created using a converting initializer.

Hexadecimal float literals of no more than the maximum supported precision can
be used to avoid this double-rounding error for binary floating-point types.

> Double rounding of float literals is tracked by Swift bug [SR-7124:
> Double rounding in floating-point literal conversion][ref 13-1].

Since `_MaxBuiltinFloatType` is a __binary__ floating-point type, a decimal
floating-point type that conforms to the protocol `ExpressibleByFloatLiteral`
cannot distinguish between two values that have the same binary floating-point
representation rounded to fit `_MaxBuiltinFloatType`:

```swift
import Foundation

Decimal(string: "0.10000000000000001")!.description
// "0.10000000000000001"
(0.10000000000000001 as Decimal).description
// "0.1"
```

[ref 13-1]: https://bugs.swift.org/browse/SR-7124

## Conversions between floating-point types

_Incomplete_

## Other initializers

* Copying signs or bit patterns
* Sign, exponent, and significand
* Converting from a string

_Incomplete_

---

Previous:  
[Concrete binary floating-point types, part 2](floating-point-part-2.md)

Next:  
[Concrete binary floating-point types, part 4](floating-point-part-4.md)

_Draft: 27 February–11 March 2018_
