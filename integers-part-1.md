Concrete integer types, part 1
==============================

## Introduction

The Swift standard library provides ten concrete integer types, all defined as
value types wrapping [LLVM primitive types from the `Builtin` module][ref 1-1]:

```swift
@frozen
public struct UInt8 /* ... */ {
  /* ... */
  public var _value: Builtin.Int8
  /* ... */
}
```

Four signed types are of explicit bit width (`Int8`, `Int16`, `Int32`, `Int64`),
as are four unsigned types (`UInt8`, `UInt16`, `UInt32`, `UInt64`). [LLVM does
support 128-bit integer types on all platforms][ref 1-2], but this support is
not surfaced by the Swift standard library.

One signed type, `Int`, and one unsigned type, `UInt`, each has bit width [equal
to the platform's pointer bit width][ref 1-2.1].

> It is possible to determine the bit width of `Int` or `UInt` via the static or
> instance property named `bitWidth`, but there is no platform condition
> available in Swift to evaluate pointer bit width at compile time.

__Standard library integer types simultaneously model integers and the sequences
of bits that are used to represent them.__ In other words, some functions (such
as those that perform basic arithmetic) operate on the integer value that is
represented, while other functions operate on the [two's complement][ref 1-3]
binary representation of those values.

All built-in standard library integer types use two's complement representation
internally for signed values. However, standard library protocols don't preclude
a hypothetical arbitrary-width integer type ("BigInt") from using
[sign-and-magnitude][ref 1-4] or another representation _internally_, as long as
bit shifting and bitwise operations notionally manipulate the two's complement
representation.

The basic arithmetic infix operators `+`, `-`, `*`, `/`, `%`, and the prefix
operator `-`, have behavior that will be largely familiar to users of other "C
family" languages. __In Swift, however, these operators trap on integer
overflow.__ It can sometimes be overlooked that `-T.min` overflows if `T` is a
signed (and fixed-width) integer type. As we will discuss, other functions are
available that provide alternative overflow behavior.

Each of the basic arithmetic operators has a corresponding mutating (in-place)
counterpart. For the infix operators, those are the assignment operators `+=`,
`-=`, `*=`, `/=`, and `%=`. For prefix operator `-`, the mutating counterpart is
spelled as the instance method `negate()`. These functions also trap on integer
overflow.

[ref 1-1]: https://swift.org/compiler-stdlib/#standard-library-design
[ref 1-2]: https://github.com/rust-lang/rfcs/blob/master/text/1504-int128.md
[ref 1-2.1]: https://forums.swift.org/t/compilation-conditions-for-word-size/26995/29
[ref 1-3]: https://en.wikipedia.org/wiki/Two%27s_complement
[ref 1-4]: https://en.wikipedia.org/wiki/Signed_number_representations#Signed_magnitude_representation

## Integer literals

An integer value can be represented in Swift source code as an __integer
literal__. The same value can be written in any of four different bases; a
prefix is used to indicate bases other than 10:

```swift
let x = 42        // Decimal (base 10).
let y = 0b101010  // Binary (base 2).
let z = 0o52      // Octal (base 8).
let a = 0x2a      // Hexadecimal (base 16).
```

In Swift, leading zeros don't affect the base of an integer literal or its
represented value. Underscores (`_`) can be used to group digits in numeric
literals (e.g., `100_000_000`); they too have no effect on the value that is
represented. 

> In many other "C family" languages, leading `0` is used as an octal prefix.
> That is, numeric constants written with a leading `0` are [interpreted in base
> 8][ref 2-1]. This has been a source of error and confusion, and Swift does not
> perpetuate the convention.

Negative values can be represented by prepending the hyphen-minus character
(`-`). This is considered to be part of the integer literal. In other words, the
expression `-42` is lexed as a single value, not as a call to the prefix
operator `-` with `42` as its operand.

> By contrast, the expression `-(42)` is lexed as a call to the prefix operator
> `-`. The distinction can be observed when working with floating-point types
> that support distinct representations for `+0.0` and `-0.0`:
>
> ```swift
> let x: Double = -0
> x.sign // .plus
> 
> let y: Double = -(0)
> y.sign // .minus
> ```
>
> In the first example, a built-in integer literal is initialized to the value
> `-0`, but integer types do not support signed zero and the sign is ignored.
> Then, based on the type annotation, the integer value is converted to a
> positive floating-point value.
>
> In the second example, a built-in integer literal is initialized to the value
> `0`. Based on the type annotation, the value is converted to a positive
> floating-point value, then the floating-point prefix operator `-` is called to
> change the sign.

Note that the Swift standard library defines the prefix operator `+` for
symmetry but does _not_ consider a prepended `+` to be part of an integer
literal. Therefore, `+42` _is_ lexed as a call to the prefix operator `+` with
`42` as its operand.

In spite of these considerations, the member expression dot operator (`.`) binds
more tightly than both the prefix operator `-` and the prepended literal `-`:

```swift
-(42.trailingZeroBitCount) // -1
(-42).trailingZeroBitCount //  1
-42.trailingZeroBitCount   // -1
```

[ref 2-1]: https://blogs.msdn.microsoft.com/oldnewthing/20140116-00/?p=2063

### Type inference

In Swift, literals have no type of their own. Instead, the type checker attempts
to infer the type of a literal expression based on other available information
such as explicit type annotations:

```swift
let x: Int8 = 42
```

Besides using an explicit type annotation, the __type coercion__ operator `as`
[(which is to be distinguished from __dynamic cast__ operators `as?`, `as!`, and
`is`)][ref 3-1] can be used to provide information for type inference:

```swift
let x = 42 as Int8
```

In the absence of other available information, the inferred type of a literal
expression defaults to `IntegerLiteralType`, which is a type alias for `Int`
unless it is shadowed by the user:

```swift
typealias IntegerLiteralType = Int32
let x = 42
type(of: x) // Int32
```

> __The following caveat is no longer applicable since changes described in
> [SE-0213: Integer initialization via coercion][ref 3-2] were [implemented in
> July 2018][ref 3-3] and shipped:__
>
> A frequent misunderstanding found even in the Swift project itself concerns
> the use of a __type conversion__ initializer to indicate the desired type of a
> literal expression. For example:
>
> ```swift
> // Avoid writing such code.
> let x = Int8(42)
> ```
>
> This usage frequently gives the intended result, but the function call does
> _not_ provide information for type inference. Instead, this statement creates
> an instance of type `IntegerLiteralType` (which again, by default, is a type
> alias for `Int`) with the value `42`, then _converts_ this value to `Int8`.
>
> The distinction can be demonstrated as follows:
>
> ```swift
> let x = 32768 as Int16
> // Causes a compile time error:
> // integer literal '32768' overflows when stored into 'Int16'
>
> let i = 32768 as Int
> let y = Int16(i)
> // Causes a **runtime** error:
> // Not enough bits to represent a signed value
>
> let z = Int16(32768)
> // Causes a **runtime** error:
> // Not enough bits to represent a signed value
> ```
>
> Differences in diagnostics might be uninteresting to many users. However, the
> same misunderstanding with floating-point types can produce different results
> due to unintended rounding error:
>
> ```swift
> let a = 3.14159265358979323846 as Float80
> // 3.14159265358979323851
>
> let b = Float80(3.14159265358979323846)
> // 3.141592653589793116
> ```

[ref 3-1]: https://github.com/apple/swift-evolution/blob/master/proposals/0083-remove-bridging-from-dynamic-casts.md
[ref 3-2]: https://github.com/apple/swift-evolution/blob/master/proposals/0213-literal-init-via-coercion.md
[ref 3-3]: https://github.com/apple/swift/pull/17860

## Conversions among integer types

Five different initializers are available to convert between standard library
integer types. A value `source` of type `T` can be converted to a value of type
`U` as follows:

1. __`U(source)`__  
   Converts the given value if it can be represented exactly as a value of type
   `U`.  
   Otherwise, a runtime error occurs.

1. __`U(exactly: source)`__  
   _Failable initializer._  
   Converts the given value if it can be represented exactly as a value of type
   `U`.  
   Otherwise, returns `nil`.

1. __`U(clamping: source)`__  
   Converts the given value to the closest representable value of type `U`.  
   If `source > U.max`, then the result is `U.max`.  
   If `source < U.min`, then the result is `U.min`.

1. __`U(truncatingIfNeeded: source)`__  
   Creates a new value of type `U` from the binary representation in memory of
   `source`.  
   When `T` and `U` are not of the same bit width, the binary representation of
   `source` is [truncated or sign-extended][ref 4-1] as necessary.

1. __`U(bitPattern: source)`__  
   _Available only for conversion between signed and unsigned types of
   explicitly the same bit width._  
   Creates a new value of type `U` with the same binary representation in memory
   as that of `source`.

[ref 4-1]: https://developer.apple.com/documentation/swift/int/2926530-init

### A note about init(truncatingIfNeeded:)

In previous versions of Swift, the same initializer was named
`init(extendingOrTruncating:)`. It was renamed to emphasize the potentially
_lossy_ semantics of truncation over the _lossless_ semantics of sign-extension.

However, sign-extension produces what may be an unexpected result in one
scenario: given a value `source` of type `T`, if `source < 0`,
`T.bitWidth < U.bitWidth`, and `U` is an _unsigned_ type, the result of
`U(truncatingIfNeeded: source)` is equivalent to
`0 &- U(truncatingIfNeeded: -source)`.

---

Next:  
[Concrete integer types, part 2](integers-part-2.md)

_27 February–5 March 2018_  
_Updated 28 July 2019_
