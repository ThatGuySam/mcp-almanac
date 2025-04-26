# Assertions for Tiger Style


### When Asserts ARE Used:

1. Function Contracts:
- For validating function arguments, return values, pre/postconditions and invariants
- Every function must have at least 2 assertions on average
- Used to ensure functions don't operate blindly on unchecked data

2. Paired Assertions:
- Properties are asserted in at least two different code paths
- Example: Asserting data validity both before writing to disk and after reading from disk
- This "two to contract" pattern helps catch bugs at boundaries

3. Control Plane Operations:
- Used unconditionally in control plane (e.g. VSR protocol) code
- Overhead is negligible due to batching
- Acceptable to spend O(N) time verifying O(1) computation

4. Data Plane Operations (with conditions):
- Used for O(1) assertions before O(N) loops (e.g. bounds checks)
- Used for per-iteration asserts if performance impact is acceptable
- Guarded by `if (constants.verify)` if assert would be too costly

5. Documentation:
- Sometimes used as stronger documentation than comments for critical/surprising invariants
- Split into separate asserts for better error messages (prefer `assert(a); assert(b);` over `assert(a and b);`)

### When Asserts are NOT Used:

1. Performance Critical Paths:
- Avoided in data plane code if they would cause >5% slowdown in production
- Avoided inside loops if they would cause significant performance degradation
- Never use O(N) asserts for O(1) computations in data plane

2. Test Coverage Impact:
- Avoided when slow thorough assertions would decrease overall test coverage
- Test coverage is proportional to number of tests run, so slow asserts reduce coverage

3. Already Covered Cases:
- Not used when a property is already verified by other means
- Not duplicated when existing asserts provide sufficient coverage

4. Non-Critical Paths:
- Not used for expected operational errors that must be handled
- Not used for normal error conditions that should be handled gracefully

### Special Cases:

1. Compile-Time Assertions:
- Used to check program design integrity before execution
- Used to enforce subtle invariants and type sizes
- These have no runtime cost

2. Test-Only Assertions:
- Some data structures use compile-time parameters to enable extra costly verification only during unit tests
- Tests may tolerate up to 5x slowdown from assertions

3. Client Libraries:
- Special assertion handling in different language clients (Java, .NET, Python, etc.)
- Assertions are treated as unrecoverable fatal errors in client code

The key principle is that assertions are used proactively to detect programmer errors and corrupt code early, turning potential correctness bugs into liveness bugs that can be caught and fixed. However, they are carefully balanced against performance requirements, especially in the data plane where performance is critical.
