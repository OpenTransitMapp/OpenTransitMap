# Architecture Decision Record (ADR) 0007: Testing and Code Quality Standards

Status: Accepted
Date: 2025-01-04

## Definitions

- **Comprehensive Test Coverage**: Every feature must have tests covering happy path, error cases, and edge conditions
- **Dependency Injection (DI)**: Design pattern where dependencies are provided to components rather than created internally
- **TSDoc**: TypeScript documentation comments using JSDoc-style syntax for better IDE support and documentation generation
- **Test Isolation**: Each test should be independent and not rely on external state or other tests

## Context

As the OpenTransitMap project grows, we need consistent standards for code quality and testing to ensure maintainability, reliability, and developer productivity. The current codebase has varying levels of test coverage and documentation, making it difficult for new developers to understand and contribute effectively.

**Problems:**
- Inconsistent test coverage across modules
- Lack of clear documentation for complex business logic
- Tightly coupled components that are difficult to test in isolation
- No clear standards for when and how to add tests

**Constraints:**
- Must not duplicate existing test coverage
- Should improve developer experience without slowing down development
- Must be practical for both new features and legacy code refactoring

## Decision

We will adopt three core standards for all new development and gradually apply them to existing code:

### What

1. **Comprehensive Test Coverage**: Every new feature must include thorough tests
2. **Clear TSDoc Documentation**: All public APIs and complex logic must be documented
3. **Dependency Injection Pattern**: Components should accept dependencies rather than creating them

### How

#### 1. Testing Standards

```typescript
// ✅ Good: Comprehensive test coverage
describe('UserService', () => {
  describe('createUser', () => {
    it('creates user with valid data', () => {
      // Happy path test
    });
    
    it('rejects invalid email format', () => {
      // Error case test
    });
    
    it('handles database connection failure', () => {
      // Edge case test
    });
  });
});
```

**Test Requirements:**
- **Unit Tests**: Test individual functions/methods in isolation
- **Integration Tests**: Test component interactions with mocked dependencies
- **Error Cases**: Test all error conditions and edge cases
- **No Duplication**: Don't test the same behavior multiple times

#### 2. TSDoc Documentation Standards

```typescript
// ✅ Good: Clear, concise TSDoc
/**
 * Creates a new viewport scope for train tracking.
 * 
 * This endpoint provisions a new viewport scope based on the provided bounding box.
 * It performs several normalization steps to ensure consistent scope identifiers:
 * 1. Validates the request body
 * 2. Clamps coordinates to Web Mercator bounds
 * 3. Quantizes the bounding box for stable keys
 * 4. Computes a deterministic scope ID
 * 
 * @param cityId - City identifier for the scope
 * @param bbox - Bounding box coordinates (in degrees)
 * @returns Promise resolving to the created scope
 * @throws {ValidationError} When bbox coordinates are invalid
 * 
 * @example
 * ```typescript
 * const scope = await createScope('nyc', {
 *   south: 40.7, west: -74, north: 40.8, east: -73.9
 * });
 * ```
 */
async function createScope(cityId: string, bbox: BBox): Promise<Scope> {
  // Implementation
}
```

**Documentation Requirements:**
- **Public APIs**: All exported functions, classes, and interfaces
- **Complex Logic**: Business rules and algorithms
- **Parameters**: Clear descriptions with types
- **Return Values**: What the function returns and when
- **Examples**: Practical usage examples
- **Error Conditions**: What can go wrong and when

#### 3. Dependency Injection Pattern

```typescript
// ✅ Good: DI pattern for testability
interface MetricsDeps {
  logger: Logger;
  config: MetricsConfig;
}

class MetricsService {
  constructor(private deps: MetricsDeps) {}
  
  recordRequest(method: string, duration: number) {
    this.deps.logger.info('Request recorded');
    // Implementation
  }
}

// In tests
const mockLogger = createMockLogger();
const metrics = new MetricsService({ logger: mockLogger, config: testConfig });
```

**DI Requirements:**
- **Constructor Injection**: Dependencies passed via constructor
- **Interface Segregation**: Use small, focused interfaces
- **Test Doubles**: Easy to mock dependencies for testing
- **Configuration**: External configuration, not hardcoded values

### Why

#### Testing Benefits
- **Confidence**: Changes can be made safely knowing tests will catch regressions
- **Documentation**: Tests serve as living documentation of expected behavior
- **Design**: Writing tests first often leads to better API design
- **Debugging**: Failing tests quickly identify the source of problems

#### Documentation Benefits
- **Onboarding**: New developers can understand code faster
- **IDE Support**: Better autocomplete and type checking
- **Maintenance**: Clear intent reduces bugs during refactoring
- **API Design**: Forces developers to think about the interface

#### DI Benefits
- **Testability**: Easy to swap dependencies for testing
- **Flexibility**: Can change implementations without changing consumers
- **Single Responsibility**: Each component has a clear, focused purpose
- **Configuration**: Runtime behavior can be configured without code changes

### Analogy

Think of these standards like building a house:

- **Tests** are like the foundation and load-bearing walls - they provide structural integrity and catch problems early
- **Documentation** is like the blueprints and instruction manual - they help anyone understand how to use and maintain the system
- **Dependency Injection** is like using standard electrical outlets instead of hardwiring everything - it makes components interchangeable and easier to work with

## Consequences

### Pros
- **Higher Code Quality**: Consistent standards lead to more maintainable code
- **Faster Development**: Clear patterns reduce decision fatigue
- **Better Onboarding**: New developers can contribute more quickly
- **Reduced Bugs**: Comprehensive testing catches issues early
- **Easier Refactoring**: Well-tested, documented code is safer to change

### Cons
- **Initial Overhead**: More time required upfront for new features
- **Learning Curve**: Team needs to adapt to new patterns
- **Legacy Code**: Existing code may not meet standards immediately

### Mitigations
- **Gradual Adoption**: Apply standards to new code first, refactor legacy code over time
- **Code Reviews**: Use PR reviews to enforce standards
- **Documentation**: Provide examples and guidelines for team reference
- **Tooling**: Use linters and formatters to automate some standards

## Alternatives Considered

### 1. Minimal Testing Approach
- **What**: Only test critical paths and happy cases
- **Why Rejected**: Insufficient coverage leads to bugs in production

### 2. External Documentation Only
- **What**: Keep documentation in separate files (README, wiki)
- **Why Rejected**: Documentation becomes outdated and disconnected from code

### 3. Service Locator Pattern
- **What**: Use a global registry to find dependencies
- **Why Rejected**: Harder to test and creates hidden dependencies

## Implementation Notes

### Phase 1: New Code Standards (Immediate)
- All new features must follow these standards
- Update code review checklist to include standards
- Add linting rules for TSDoc and test coverage

### Phase 2: Legacy Code Refactoring (Gradual)
- Refactor high-risk modules first
- Add tests when fixing bugs or adding features
- Document complex business logic as encountered

### Phase 3: Tooling and Automation (Ongoing)
- Set up coverage thresholds in CI
- Add TSDoc linting rules
- Create templates and examples for common patterns

## Metrics & Observability

### Code Quality Metrics
- **Test Coverage**: Maintain >95% statement coverage
- **Documentation Coverage**: Track percentage of public APIs documented
- **Cyclomatic Complexity**: Monitor complexity of functions and classes

### Development Metrics
- **Bug Rate**: Track bugs per feature over time
- **Time to First Contribution**: Measure onboarding effectiveness
- **Code Review Time**: Monitor impact on development velocity

## Security & Privacy

- **Test Data**: Use synthetic data in tests, never real user data
- **Mock Services**: Ensure test doubles don't leak sensitive information
- **Documentation**: Be careful not to expose internal security details

## Open Questions

1. **Coverage Thresholds**: Should we set different coverage requirements for different types of code?
2. **Legacy Migration**: What's the priority order for refactoring existing modules?
3. **Tooling**: Which specific linting and testing tools should we adopt?

## Changelog

- 2025-01-04: Initial proposal and acceptance based on current codebase improvements
