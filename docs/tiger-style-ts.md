# TigerStyle

## The Essence Of Style

> “There are three things extremely hard: steel, a diamond, and to know one's self.” — Benjamin
> Franklin

TigerBeetle's coding style is evolving. A collective give-and-take at the intersection of
engineering and art. Numbers and human intuition. Reason and experience. First principles and
knowledge. Precision and poetry. Just like music. A tight beat. A rare groove. Words that rhyme and
rhymes that break. Biodigital jazz. This is what we've learned along the way. The best is yet to
come.

## Why Have Style?

Another word for style is design.

> “The design is not just what it looks like and feels like. The design is how it works.” — Steve
> Jobs

Our design goals are safety, performance, and developer experience. In that order. All three are
important. Good style advances these goals. Does the code make for more or less safety, performance
or developer experience? That is why we need style.

Put this way, style is more than readability, and readability is table stakes, a means to an end
rather than an end in itself.

> “...in programming, style is not something to pursue directly. Style is necessary only where
> understanding is missing.” ─ [Let Over
> Lambda](https://letoverlambda.com/index.cl/guest/chap1.html)

This document explores how we apply these design goals to coding style. First, a word on simplicity,
elegance and technical debt.

## On Simplicity And Elegance

Simplicity is not a free pass. It's not in conflict with our design goals. It need not be a
concession or a compromise.

Rather, simplicity is how we bring our design goals together, how we identify the "super idea" that
solves the axes simultaneously, to achieve something elegant.

> “Simplicity and elegance are unpopular because they require hard work and discipline to achieve” —
> Edsger Dijkstra

Contrary to popular belief, simplicity is also not the first attempt but the hardest revision. It's
easy to say “let's do something simple”, but to do that in practice takes thought, multiple passes,
many sketches, and still we may have to [“throw one
away”](https://en.wikipedia.org/wiki/The_Mythical_Man-Month).

The hardest part, then, is how much thought goes into everything.

We spend this mental energy upfront, proactively rather than reactively, because we know that when
the thinking is done, what is spent on the design will be dwarfed by the implementation and testing,
and then again by the costs of operation and maintenance.

An hour or day of design is worth weeks or months in production:

> “the simple and elegant systems tend to be easier and faster to design and get right, more
> efficient in execution, and much more reliable” — Edsger Dijkstra

## Technical Debt

What could go wrong? What's wrong? Which question would we rather ask? The former, because code,
like steel, is less expensive to change while it's hot. A problem solved in production is many times
more expensive than a problem solved in implementation, or a problem solved in design.

Since it's hard enough to discover showstoppers, when we do find them, we solve them. We don't allow
potential memcpy latency spikes, or exponential complexity algorithms to slip through.

> “You shall not pass!” — Gandalf

In other words, TigerBeetle has a “zero technical debt” policy. We do it right the first time. This
is important because the second time may not transpire, and because doing good work, that we can be
proud of, builds momentum.

We know that what we ship is solid. We may lack crucial features, but what we have meets our design
goals. This is the only way to make steady incremental progress, knowing that the progress we have
made is indeed progress.

## Safety

> “The rules act like the seat-belt in your car: initially they are perhaps a little uncomfortable,
> but after a while their use becomes second-nature and not using them becomes unimaginable.” —
> Gerard J. Holzmann

[NASA's Power of Ten — Rules for Developing Safety Critical
Code](https://spinroot.com/gerard/pdf/P10.pdf) will change the way you code forever. To expand:

- Use **only very simple, explicit control flow** for clarity. **Do not use recursion** to ensure
  that all executions that should be bounded are bounded. Use **only a minimum of excellent
  abstractions** but only if they make the best sense of the domain. Abstractions are [never zero
  cost](https://isaacfreund.com/blog/2022-05/). Every abstraction introduces the risk of a leaky
  abstraction.

- **Put a limit on everything** because, in reality, this is what we expect—everything has a limit.
  For example, all loops and all queues must have a fixed upper bound to prevent infinite loops or
  tail latency spikes. This follows the [“fail-fast”](https://en.wikipedia.org/wiki/Fail-fast)
  principle so that violations are detected sooner rather than later. Where a loop cannot terminate
  (e.g. an event loop), this must be asserted.

- Use explicitly-sized types like `u32` for everything, avoid architecture-specific `usize`.

- **Assertions detect programmer errors. Unlike operating errors, which are expected and which must
  be handled, assertion failures are unexpected. The only correct way to handle corrupt code is to
  crash. Assertions downgrade catastrophic correctness bugs into liveness bugs. Assertions are a
  force multiplier for discovering bugs by fuzzing.**

  - **Assert all function arguments and return values, pre/postconditions and invariants.** A
    function must not operate blindly on data it has not checked. The purpose of a function is to
    increase the probability that a program is correct. Assertions within a function are part of how
    functions serve this purpose. The assertion density of the code must average a minimum of two
    assertions per function.

  - **[Pair assertions](https://tigerbeetle.com/blog/2023-12-27-it-takes-two-to-contract).** For
    every property you want to enforce, try to find at least two different code paths where an
    assertion can be added. For example, assert validity of data right before writing it to disk,
    and also immediately after reading from disk.

  - On occasion, you may use a blatantly true assertion instead of a comment as stronger
    documentation where the assertion condition is critical and surprising.

  - Split compound assertions: prefer `assert(a); assert(b);` over `assert(a and b);`.
    The former is simpler to read, and provides more precise information if the condition fails.

  - **Assert the relationships of compile-time constants** as a sanity check, and also to document
    and enforce [subtle
    invariants](https://github.com/coilhq/tigerbeetle/blob/db789acfb93584e5cb9f331f9d6092ef90b53ea6/src/vsr/journal.zig#L45-L47)
    or [type
    sizes](https://github.com/coilhq/tigerbeetle/blob/578ac603326e1d3d33532701cb9285d5d2532fe7/src/ewah.zig#L41-L53).
    Compile-time assertions are extremely powerful because they are able to check a program's design
    integrity _before_ the program even executes.

  - **The golden rule of assertions is to assert the _positive space_ that you do expect AND to
    assert the _negative space_ that you do not expect** because where data moves across the
    valid/invalid boundary between these spaces is where interesting bugs are often found. This is
    also why **tests must test exhaustively**, not only with valid data but also with invalid data,
    and as valid data becomes invalid.

  - Assertions are a safety net, not a substitute for human understanding. With simulation testing,
    there is the temptation to trust the fuzzer. But a fuzzer can prove only the presence of bugs,
    not their absence. Therefore:
    - Build a precise mental model of the code first,
    - encode your understanding in the form of assertions,
    - write the code and comments to explain and justify the mental model to your reviewer,
    - and use VOPR as the final line of defense, to find bugs in your and reviewer's understanding
      of code.

- All memory must be statically allocated at startup. **No memory may be dynamically allocated (or
  freed and reallocated) after initialization.** This avoids unpredictable behavior that can
  significantly affect performance, and avoids use-after-free. As a second-order effect, it is our
  experience that this also makes for more efficient, simpler designs that are more performant and
  easier to maintain and reason about, compared to designs that do not consider all possible memory
  usage patterns upfront as part of the design.

- Declare variables at the **smallest possible scope**, and **minimize the number of variables in
  scope**, to reduce the probability that variables are misused.

- Restrict the length of function bodies to reduce the probability of poorly structured code. We
  enforce a **hard limit of 70 lines per function**.

  Splitting code into functions requires taste. There are many ways to cut a wall of code into
  chunks of 70 lines, but only a few splits will feel right. Some rules of thumb:

  * Good function shape is often the inverse of an hourglass: a few parameters, a simple return
    type, and a lot of meaty logic between the braces.
  * Centralize control flow. When splitting a large function, try to keep all switch/if
    statements in the "parent" function, and move non-branchy logic fragments to helper
    functions. Divide responsibility. All control flow should be handled by _one_ function, the rest shouldn't
    care about control flow at all. In other words,
    ["push `if`s up and `for`s down"](https://matklad.github.io/2023/11/15/push-ifs-up-and-fors-down.html).
  * Similarly, centralize state manipulation. Let the parent function keep all relevant state in
    local variables, and use helpers to compute what needs to change, rather than applying the
    change directly. Keep leaf functions pure.

- Appreciate, from day one, **all compiler warnings at the compiler's strictest setting**.

- Whenever your program has to interact with external entities, **don't do things directly in
  reaction to external events**. Instead, your program should run at its own pace. Not only does
  this make your program safer by keeping the control flow of your program under your control, it
  also improves performance for the same reason (you get to batch, instead of context switching on
  every event). Additionally, this makes it easier to maintain bounds on work done per time period.

Beyond these rules:

- Compound conditions that evaluate multiple booleans make it difficult for the reader to verify
  that all cases are handled. Split compound conditions into simple conditions using nested
  `if/else` branches. Split complex `else if` chains into `else { if { } }` trees. This makes the
  branches and cases clear. Again, consider whether a single `if` does not also need a matching
  `else` branch, to ensure that the positive and negative spaces are handled or asserted.

- Negations are not easy! State invariants positively. When working with lengths and indexes, this
  form is easy to get right (and understand):

  ```zig
  if (index < length) {
    // The invariant holds.
  } else {
    // The invariant doesn't hold.
  }
  ```

  This form is harder, and also goes against the grain of how `index` would typically be compared to
  `length`, for example, in a loop condition:

  ```zig
  if (index >= length) {
    // It's not true that the invariant holds.
  }
  ```

- All errors must be handled. An [analysis of production failures in distributed data-intensive
  systems](https://www.usenix.org/system/files/conference/osdi14/osdi14-paper-yuan.pdf) found that
  the majority of catastrophic failures could have been prevented by simple testing of error
  handling code.

> “Specifically, we found that almost all (92%) of the catastrophic system failures are the result
> of incorrect handling of non-fatal errors explicitly signaled in software.”

- **Always motivate, always say why**. Never forget to say why. Because if you explain the rationale
  for a decision, it not only increases the hearer's understanding, and makes them more likely to
  adhere or comply, but it also shares criteria with them with which to evaluate the decision and
  its importance.

- **Explicitly pass options to library functions at the call site, instead of relying on the
  defaults**. For example, write `@prefetch(a, .{ .cache = .data, .rw = .read, .locality = 3 });`
  over `@prefetch(a, .{});`. This improves readability but most of all avoids latent, potentially
  catastrophic bugs in case the library ever changes its defaults.

## Performance

> “The lack of back-of-the-envelope performance sketches is the root of all evil.” — Rivacindela
> Hudsoni

- Think about performance from the outset, from the beginning. **The best time to solve performance,
  to get the huge 1000x wins, is in the design phase, which is precisely when we can't measure or
  profile.** It's also typically harder to fix a system after implementation and profiling, and the
  gains are less. So you have to have mechanical sympathy. Like a carpenter, work with the grain.

- **Perform back-of-the-envelope sketches with respect to the four resources (network, disk, memory,
  CPU) and their two main characteristics (bandwidth, latency).** Sketches are cheap. Use sketches
  to be “roughly right” and land within 90% of the global maximum.

- Optimize for the slowest resources first (network, disk, memory, CPU) in that order, after
  compensating for the frequency of usage, because faster resources may be used many times more. For
  example, a memory cache miss may be as expensive as a disk fsync, if it happens many times more.

- Distinguish between the control plane and data plane. A clear delineation between control plane
  and data plane through the use of batching enables a high level of assertion safety without losing
  performance. See our [July 2021 talk on Zig SHOWTIME](https://youtu.be/BH2jvJ74npM?t=1958) for
  examples.

- Amortize network, disk, memory and CPU costs by batching accesses.

- Let the CPU be a sprinter doing the 100m. Be predictable. Don't force the CPU to zig zag and
  change lanes. Give the CPU large enough chunks of work. This comes back to batching.

- Be explicit. Minimize dependence on the compiler to do the right thing for you.

  In particular, extract hot loops into stand-alone functions with primitive arguments without
  `self` (see [an example](https://github.com/tigerbeetle/tigerbeetle/blob/0.16.19/src/lsm/compaction.zig#L1932-L1937)).
  That way, the compiler doesn't need to prove that it can cache struct's fields in registers, and a
  human reader can spot redundant computations easier.

## Developer Experience

> “There are only two hard things in Computer Science: cache invalidation, naming things, and
> off-by-one errors.” — Phil Karlton

### Naming Things

- **Get the nouns and verbs just right.** Great names are the essence of great code, they capture
  what a thing is or does, and provide a crisp, intuitive mental model. They show that you
  understand the domain. Take time to find the perfect name, to find nouns and verbs that work
  together, so that the whole is greater than the sum of its parts.

- Use `snake_case` for function, variable, and file names. The underscore is the closest thing we
  have as programmers to a space, and helps to separate words and encourage descriptive names. We
  don't use Zig's `CamelCase.zig` style for "struct" files to keep the convention simple and
  consistent.

- Do not abbreviate variable names, unless the variable is a primitive integer type used as an
  argument to a sort function or matrix calculation. Use long form arguments in scripts: `--force`,
  not `-f`. Single letter flags are for interactive usage.

- Use proper capitalization for acronyms (`VSRState`, not `VsrState`).

- For the rest, follow the Zig style guide.

- Add units or qualifiers to variable names, and put the units or qualifiers last, sorted by
  descending significance, so that the variable starts with the most significant word, and ends with
  the least significant word. For example, `latency_ms_max` rather than `max_latency_ms`. This will
  then line up nicely when `latency_ms_min` is added, as well as group all variables that relate to
  latency.

- When choosing related names, try hard to find names with the same number of characters so that
  related variables all line up in the source. For example, as arguments to a memcpy function,
  `source` and `target` are better than `src` and `dest` because they have the second-order effect
  that any related variables such as `source_offset` and `target_offset` will all line up in
  calculations and slices. This makes the code symmetrical, with clean blocks that are easier for
  the eye to parse and for the reader to check.

- When a single function calls out to a helper function or callback, prefix the name of the helper
  function with the name of the calling function to show the call history. For example,
  `read_sector()` and `read_sector_callback()`.

- Callbacks go last in the list of parameters. This mirrors control flow: callbacks are also
  _invoked_ last.

- _Order_ matters for readability (even if it doesn't affect semantics). On the first read, a file
  is read top-down, so put important things near the top. The `main` function goes first.

  At the same time, not everything has a single right order. When in doubt, consider sorting
  alphabetically, taking advantage of big-endian naming.

- Don't overload names with multiple meanings that are context-dependent. For example, TigerBeetle
  has a feature called _pending transfers_ where a pending transfer can be subsequently _posted_ or
  _voided_. At first, we called them _two-phase commit transfers_, but this overloaded the
  _two-phase commit_ terminology that was used in our consensus protocol, causing confusion.

- Think of how names will be used outside the code, in documentation or communication. For example,
  a noun is often a better descriptor than an adjective or present participle, because a noun can be
  directly used in correspondence without having to be rephrased. Compare `replica.pipeline` vs
  `replica.preparing`. The former can be used directly as a section header in a document or
  conversation, whereas the latter must be clarified. Noun names compose more clearly for derived
  identifiers, e.g. `config.pipeline_max`.

- **Write descriptive commit messages** that inform and delight the reader, because your commit
  messages are being read.

- Don't forget to say why. Code alone is not documentation. Use comments to explain why you wrote
  the code the way you did. Show your workings.

- Don't forget to say how. For example, when writing a test, think of writing a description at the
  top to explain the goal and methodology of the test, to help your reader get up to speed, or to
  skip over sections, without forcing them to dive in.

- Comments are sentences, with a space after the slash, with a capital letter and a full stop, or a
  colon if they relate to something that follows. Comments are well-written prose describing the
  code, not just scribblings in the margin. Comments after the end of a line _can_ be phrases, with
  no punctuation.

### Cache Invalidation

- Don't duplicate variables or take aliases to them. This will reduce the probability that state
  gets out of sync.

- If you don't mean a function argument to be copied when passed by value, and if the argument type
  is more than 16 bytes, then pass the argument as `*const`. This will catch bugs where the caller
  makes an accidental copy on the stack before calling the function.

- Construct larger structs _in-place_ by passing an _out pointer_ during initialization.

  In-place initializations can assume **pointer stability** and **immovable types** while
  eliminating intermediate copy-move allocations, which can lead to undesirable stack growth.

  Keep in mind that in-place initializations are viral — if any field is initialized
  in-place, the entire container struct should be initialized in-place as well.

  **Prefer:**
  ```zig
  fn init(target: *LargeStruct) !void {
    target.* = .{
      // in-place initialization.
    };
  }

  fn main() !void {
    var target: LargeStruct = undefined;
    try target.init();
  }
  ```

  **Over:**
  ```zig
  fn init() !LargeStruct {
    return LargeStruct {
      // moving the initialized object.
    }
  }

  fn main() !void {
    var target = try LargeStruct.init();
  }
  ```

- **Shrink the scope** to minimize the number of variables at play and reduce the probability that
  the wrong variable is used.

- Calculate or check variables close to where/when they are used. **Don't introduce variables before
  they are needed.** Don't leave them around where they are not. This will reduce the probability of
  a POCPOU (place-of-check to place-of-use), a distant cousin to the infamous
  [TOCTOU](https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use). Most bugs come down to a
  semantic gap, caused by a gap in time or space, because it's harder to check code that's not
  contained along those dimensions.

- Use simpler function signatures and return types to reduce dimensionality at the call site, the
  number of branches that need to be handled at the call site, because this dimensionality can also
  be viral, propagating through the call chain. For example, as a return type, `void` trumps `bool`,
  `bool` trumps `u64`, `u64` trumps `?u64`, and `?u64` trumps `!u64`.

- Ensure that functions run to completion without suspending, so that precondition assertions are
  true throughout the lifetime of the function. These assertions are useful documentation without a
  suspend, but may be misleading otherwise.

- Be on your guard for **[buffer bleeds](https://en.wikipedia.org/wiki/Heartbleed)**. This is a
  buffer underflow, the opposite of a buffer overflow, where a buffer is not fully utilized, with
  padding not zeroed correctly. This may not only leak sensitive information, but may cause
  deterministic guarantees as required by TigerBeetle to be violated.

- Use newlines to **group resource allocation and deallocation**, i.e. before the resource
  allocation and after the corresponding `defer` statement, to make leaks easier to spot.

### Off-By-One Errors

- **The usual suspects for off-by-one errors are casual interactions between an `index`, a `count`
  or a `size`.** These are all primitive integer types, but should be seen as distinct types, with
  clear rules to cast between them. To go from an `index` to a `count` you need to add one, since
  indexes are _0-based_ but counts are _1-based_. To go from a `count` to a `size` you need to
  multiply by the unit. Again, this is why including units and qualifiers in variable names is
  important.

- Show your intent with respect to division. For example, use `@divExact()`, `@divFloor()` or
  `div_ceil()` to show the reader you've thought through all the interesting scenarios where
  rounding may be involved.

### Style By The Numbers

- Run `zig fmt`.

- Use 4 spaces of indentation, rather than 2 spaces, as that is more obvious to the eye at a
  distance.

- Hard limit all line lengths, without exception, to at most 100 columns for a good typographic
  "measure". Use it up. Never go beyond. Nothing should be hidden by a horizontal scrollbar. Let
  your editor help you by setting a column ruler. To wrap a function signature, call or data
  structure, add a trailing comma, close your eyes and let `zig fmt` do the rest.

- Add braces to the `if` statement unless it fits on a single line for consistency and defense in
  depth against "goto fail;" bugs.

### Dependencies

TigerBeetle has **a "zero dependencies" policy**, apart from the Zig toolchain. Dependencies, in
general, inevitably lead to supply chain attacks, safety and performance risk, and slow install
times. For foundational infrastructure in particular, the cost of any dependency is further
amplified throughout the rest of the stack.

### Tooling

Similarly, tools have costs. A small standardized toolbox is simpler to operate than an array of
specialized instruments each with a dedicated manual. Our primary tool is Zig. It may not be the
best for everything, but it's good enough for most things. We invest into our Zig tooling to ensure
that we can tackle new problems quickly, with a minimum of accidental complexity in our local
development environment.

> “The right tool for the job is often the tool you are already using—adding new tools has a higher
> cost than many people appreciate” — John Carmack

For example, the next time you write a script, instead of `scripts/*.sh`, write `scripts/*.zig`.

This not only makes your script cross-platform and portable, but introduces type safety and
increases the probability that running your script will succeed for everyone on the team, instead of
hitting a Bash/Shell/OS-specific issue.

Standardizing on Zig for tooling is important to ensure that we reduce dimensionality, as the team,
and therefore the range of personal tastes, grows. This may be slower for you in the short term, but
makes for more velocity for the team in the long term.

## The Last Stage

At the end of the day, keep trying things out, have fun, and remember—it's called TigerBeetle, not
only because it's fast, but because it's small!

> You don’t really suppose, do you, that all your adventures and escapes were managed by mere luck,
> just for your sole benefit? You are a very fine person, Mr. Baggins, and I am very fond of you;
> but you are only quite a little fellow in a wide world after all!”
>
> “Thank goodness!” said Bilbo laughing, and handed him the tobacco-jar.

## Assertion Examples (TypeScript)

Here are some examples illustrating the assertion principles in TypeScript:

```typescript
// Use named assert import for better tree-shaking
import { assert } from '@sindresorhus/is';
import { z } from 'zod'

/**
 * Example function demonstrating argument and precondition asserts.
 * Uses @sindresorhus/is for robust type assertions.
 *
 * @param options The options object.
 * @param options.userId The user ID (must be positive).
 * @param options.amount The amount (must be positive).
 * @returns The new balance (guaranteed positive).
 */
function processTransaction(options: {
  userId: number;
  amount: number;
}): number {
  // Assert arguments (preconditions) using built-in checkers
  z.object({
    userId: z.number().positive({
      message: `userId must be positive, got ${options.userId}`
    }),
    amount: z.number().positive({
      message: `amount must be positive, got ${options.amount}`
    }),
  })
  .refine((data) => isValidUserId(data.userId), {
    message: `User ID ${options.userId} is invalid`,
  })
  .refine((data) => hasSufficientFunds(data.userId, data.amount), {
    message: `User ${options.userId} lacks funds for ${options.amount}`,
    // Path can be specified for better error reporting if needed
    // path: ['amount'],
  })
  .parse(options); // Use parse to validate

  // Simulate fetching balance (replace with actual logic)
  const currentBalance = 100; // Assume fetched balance
  // Check invariants
  assert.positiveNumber(
    currentBalance,
    `Invariant failed: currentBalance ${currentBalance} is not positive`,
  );

  const newBalance = currentBalance - options.amount;

  // Assert postcondition
  // Check both positive and negative space
  assert.truthy(
    newBalance >= 0,
    `Postcondition failed: newBalance ${newBalance} cannot be negative`,
  );
  assert.truthy(
    newBalance < currentBalance,
    `Postcondition failed: newBalance ${newBalance} not less than currentBalance ${currentBalance}`,
  );

  // Split compound assertions for clarity and better error messages
  // These checks are now handled by the Zod schema refinements above.

  // Paired Assertion Concept (Conceptual Example):
  // These would use specific assertions based on data structure
  // Assert data validity before writing
  assertValidDataForStorage(data);
  writeDataToDisk(data);
  // ... later ...
  const readData = readDataFromDisk();
  // Assert data validity immediately after reading
  assertValidDataFromStorage(readData);

  // Assert return value type/condition
  assert.positiveNumber(
    newBalance,
    `Return value: newBalance ${newBalance} must be positive`
  );
  return newBalance;
}

// Helper functions (stubs for example)
function isValidUserId(id: number): boolean {
  // Example validation
  return id > 0 && Number.isInteger(id);
}
function hasSufficientFunds(
  userId: number,
  amount: number,
): boolean {
  // Example check - ensure parameters are valid numbers first
  assert.positiveNumber(userId, 'userId in hasSufficientFunds');
  assert.positiveNumber(amount, 'amount in hasSufficientFunds');
  return true; // Replace with actual fund checking logic
}

// Assume these exist and perform necessary checks
declare const data: unknown; // Use unknown for safety
function assertValidDataForStorage(
  data: unknown
): asserts data is { /* expected shape */ } {
  // Use specific asserts: assert.plainObject, assert.string, etc.
  assert.plainObject(data, 'Data for storage must be an object');
  // ... more checks
}
function writeDataToDisk(data: { /* expected shape */ }): void {
  /* write */
}
function readDataFromDisk(): unknown {
  return {}; /* read */
}
function assertValidDataFromStorage(
  data: unknown
): asserts data is { /* expected shape */ } {
  // Use specific asserts: assert.plainObject, assert.string, etc.
  assert.plainObject(data, 'Data from storage must be an object');
  // ... more checks
}
```



## @sindresorhus/is API

Here is a list of the methods available with the `assert.{method}()` syntax, categorized as they appear in the documentation:

**Primitives:**

*   `assert.undefined(value, message?)`
*   `assert.null(value, message?)`
*   `assert.string(value, message?)`
*   `assert.number(value, message?)`
*   `assert.boolean(value, message?)`
*   `assert.symbol(value, message?)`
*   `assert.bigint(value, message?)`

**Built-in types:**

*   `assert.array(value, assertion?, message?)`
*   `assert.function(value, message?)`
*   `assert.buffer(value, message?)`
*   `assert.blob(value, message?)`
*   `assert.object(value, message?)`
*   `assert.numericString(value, message?)`
*   `assert.regExp(value, message?)`
*   `assert.date(value, message?)`
*   `assert.error(value, message?)`
*   `assert.nativePromise(value, message?)`
*   `assert.promise(value, message?)`
*   `assert.generator(value, message?)`
*   `assert.generatorFunction(value, message?)`
*   `assert.asyncFunction(value, message?)`
*   `assert.asyncGenerator(value, message?)`
*   `assert.asyncGeneratorFunction(value, message?)`
*   `assert.boundFunction(value, message?)`
*   `assert.map(value, message?)`
*   `assert.set(value, message?)`
*   `assert.weakMap(value, message?)`
*   `assert.weakSet(value, message?)`
*   `assert.weakRef(value, message?)`

**Typed arrays:**

*   `assert.int8Array(value, message?)`
*   `assert.uint8Array(value, message?)`
*   `assert.uint8ClampedArray(value, message?)`
*   `assert.int16Array(value, message?)`
*   `assert.uint16Array(value, message?)`
*   `assert.int32Array(value, message?)`
*   `assert.uint32Array(value, message?)`
*   `assert.float32Array(value, message?)`
*   `assert.float64Array(value, message?)`
*   `assert.bigInt64Array(value, message?)`
*   `assert.bigUint64Array(value, message?)`

**Structured data:**

*   `assert.arrayBuffer(value, message?)`
*   `assert.sharedArrayBuffer(value, message?)`
*   `assert.dataView(value, message?)`
*   `assert.enumCase(value, enum, message?)` (TypeScript-only)
*   `assert.typedArray(value, message?)`
*   `assert.arrayLike(value, message?)`
*   `assert.tupleLike(value, guards, message?)`
*   `assert.positiveNumber(value, message?)`
*   `assert.negativeNumber(value, message?)`
*   `assert.inRange(value, range, message?)`
*   `assert.htmlElement(value, message?)`
*   `assert.nodeStream(value, message?)`
*   `assert.observable(value, message?)`
*   `assert.infinite(value, message?)`
*   `assert.evenInteger(value, message?)`
*   `assert.oddInteger(value, message?)`
*   `assert.propertyKey(value, message?)`
*   `assert.formData(value, message?)`
*   `assert.urlSearchParams(value, message?)`
*   `assert.validDate(value, message?)`



## Zod API


Based on the Zod documentation, here are the schema creation and manipulation methods available directly under the `z` namespace or as chainable methods on existing schemas:

**Primitive Types:**

*   `z.string(params?)`: Creates a string schema. `params` allows customizing error messages.
*   `z.number(params?)`: Creates a number schema. `params` allows customizing error messages.
*   `z.bigint(params?)`: Creates a bigint schema. `params` allows customizing error messages.
*   `z.boolean(params?)`: Creates a boolean schema. `params` allows customizing error messages.
*   `z.nan(params?)`: Creates a NaN schema. `params` allows customizing error messages.
*   `z.undefined()`: Creates an undefined schema.
*   `z.null()`: Creates a null schema.
*   `z.any()`: Creates a schema that accepts any value.
*   `z.unknown()`: Creates a schema that accepts any value but requires validation before use (safer than `any`).
*   `z.void()`: Creates a schema that accepts `undefined` and has `void` as its output type.
*   `z.never()`: Creates a schema that accepts no values.

**Complex Types:**

*   `z.object(shape)`: Creates an object schema with a defined `shape`.
*   `z.array(schema)`: Creates an array schema where elements match the provided `schema`.
*   `z.union([schemaA, schemaB, ...])`: Creates a schema that accepts values matching *any* of the provided schemas.
*   `z.intersection(schemaA, schemaB)`: Creates a schema that accepts values matching *both* schemaA and schemaB.
*   `z.tuple([schemaA, schemaB, ...])`: Creates a tuple schema with fixed element types.
*   `z.record(keySchema, valueSchema)`: Creates an object schema with keys matching `keySchema` and values matching `valueSchema`.
*   `z.map(keySchema, valueSchema)`: Creates a Map schema.
*   `z.set(valueSchema)`: Creates a Set schema.
*   `z.function(args?, return?)`: Creates a function schema, validating arguments and/or return type.
*   `z.promise(schema)`: Creates a Promise schema where the resolved value matches the provided `schema`.
*   `z.enum([val1, val2, ...])`: Creates a schema accepting only the provided literal string values.
*   `z.nativeEnum(enumObject)`: Creates a schema based on a TypeScript enum object.
*   `z.literal(value)`: Creates a schema accepting only the specific literal `value`.

**Schema Modifiers/Methods (Chainable):**

*   `.optional()`: Makes the schema accept `undefined`. Returns `ZodOptional`.
*   `.nullable()`: Makes the schema accept `null`. Returns `ZodNullable`.
*   `.nullish()`: Makes the schema accept `null` or `undefined` (shortcut for `.nullable().optional()`). Returns `ZodOptional<ZodNullable>`.
*   `.array()`: Creates an array schema of the current type (e.g., `z.string().array()` is `z.array(z.string())`). Returns `ZodArray`.
*   `.promise()`: Creates a promise schema of the current type (e.g., `z.string().promise()` is `z.promise(z.string())`). Returns `ZodPromise`.
*   `.or(otherSchema)`: Creates a union with another schema (e.g., `z.string().or(z.number())`). Returns `ZodUnion`.
*   `.and(otherSchema)`: Creates an intersection with another schema (e.g., `z.object({a: z.string()}).and(z.object({b: z.number()}))`). Returns `ZodIntersection`.
*   `.transform(func)`: Adds a transformation step after parsing. Returns `ZodEffects`.
*   `.refine(validator, params?)`: Adds a custom validation rule. Returns `ZodEffects`.
*   `.superRefine(validator)`: Advanced refinement allowing multiple issues/custom codes. Returns `ZodEffects`.
*   `.brand<T>()`: Adds a unique brand to the type for nominal typing simulation. Returns `ZodBranded`.
*   `.default(value)`: Provides a default value if the input is `undefined`.
*   `.catch(value)`: Provides a fallback value if parsing fails.
*   `.describe(description)`: Adds a description (metadata).
*   `.pipe(otherSchema)`: Chains parsing: output of the first schema is input to the second.
*   `.readonly()`: Marks the inferred type as `readonly`.
*   `.parse(data)`: Parses data, throwing a `ZodError` on failure.
*   `.safeParse(data)`: Parses data, returning a result object (`{ success: true, data: T } | { success: false, error: ZodError }`).
*   `.parseAsync(data)`: Parses data using async refinements/transforms.
*   `.safeParseAsync(data)`: Safely parses data using async refinements/transforms.

**Number Specific Methods (Chainable on `z.number()`):**

*   `.gt(value, message?)`: Greater than `value`.
*   `.gte(value, message?)` / `.min(value, message?)`: Greater than or equal to `value`.
*   `.lt(value, message?)`: Less than `value`.
*   `.lte(value, message?)` / `.max(value, message?)`: Less than or equal to `value`.
*   `.int(message?)`: Must be an integer.
*   `.positive(message?)`: Must be > 0.
*   `.nonnegative(message?)`: Must be >= 0.
*   `.negative(message?)`: Must be < 0.
*   `.nonpositive(message?)`: Must be <= 0.
*   `.multipleOf(value, message?)`: Must be a multiple of `value`.
*   `.finite(message?)`: Must be finite (not `Infinity` or `-Infinity`).
*   `.safe(message?)`: Must be a safe integer (`Number.MIN_SAFE_INTEGER` to `Number.MAX_SAFE_INTEGER`).

**BigInt Specific Methods (Chainable on `z.bigint()`):**

*   `.gt(value, message?)`
*   `.gte(value, message?)` / `.min(value, message?)`
*   `.lt(value, message?)`
*   `.lte(value, message?)` / `.max(value, message?)`
*   `.positive(message?)`
*   `.nonnegative(message?)`
*   `.negative(message?)`
*   `.nonpositive(message?)`
*   `.multipleOf(value, message?)`

**String Specific Methods (Chainable on `z.string()`):**

*   `.min(length, message?)`: Minimum length.
*   `.max(length, message?)`: Maximum length.
*   `.length(length, message?)`: Exact length.
*   `.email(message?)`
*   `.url(message?)`
*   `.emoji(message?)`
*   `.uuid(message?)`
*   `.cuid(message?)`
*   `.cuid2(message?)`
*   `.ulid(message?)`
*   `.regex(regex, message?)`
*   `.includes(value, message?)`
*   `.startsWith(value, message?)`
*   `.endsWith(value, message?)`
*   `.datetime(options?)`: ISO 8601 Datetime string.
*   `.ip(options?)`: IP address string.
*   `.trim()`: Trims whitespace before validation.
*   `.toLowerCase()`: Converts to lowercase before validation.
*   `.toUpperCase()`: Converts to uppercase before validation.

**Object Specific Methods (Chainable on `z.object()`):**

*   `.extend(shape)`: Adds new fields to the object schema.
*   `.merge(otherObjectSchema)`: Merges with another object schema.
*   `.pick({ key1: true, key2: true, ... })`: Creates a new schema with only the specified keys.
*   `.omit({ key1: true, key2: true, ... })`: Creates a new schema without the specified keys.
*   `.partial()`: Makes all fields optional.
*   `.deepPartial()`: Makes all fields (including nested objects) optional.
*   `.required()`: Makes all fields required.
*   `.passthrough()`: Allows extra keys not defined in the schema.
*   `.strict()`: Disallows extra keys.
*   `.strip()`: Strips extra keys (default behavior).
*   `.catchall(valueSchema)`: Allows any extra keys, validating their values against `valueSchema`.

**Array Specific Methods (Chainable on `z.array()`):**

*   `.min(length, message?)`: Minimum array length.
*   `.max(length, message?)`: Maximum array length.
*   `.length(length, message?)`: Exact array length.
*   `.nonempty(message?)`: Equivalent to `.min(1)`.

This list covers the core schema types and common methods mentioned or implied in the provided documentation snippets. Zod has even more specialized methods, but these are the fundamental building blocks.
