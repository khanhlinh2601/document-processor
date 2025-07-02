I want to refactor structure code based on clean architecture:
## Logger
1. Enhance Logger implementation:
   - Create structured logging format (JSON)
   - Add correlation IDs for request tracking
   - Implement proper context handling
   - Add log rotation and retention strategies

## Not use any type
1. Remove TypeScript types gradually:
   - Replace TypeScript interfaces with runtime validation
   - Use class-validator for input validation
   - Implement proper error handling without type dependencies

## Follow SOLID Principles
1. Single Responsibility:
   - Split services into smaller focused classes
   - Each class should have only one reason to change

2. Open/Closed:
   - Create extension points for future functionality
   - Use abstractions to allow extending behavior without modifying code

3. Liskov Substitution:
   - Ensure proper inheritance hierarchies
   - Subtypes must be substitutable for their base types

4. Interface Segregation:
   - Create focused interfaces
   - Clients should not depend on methods they don't use

5. Dependency Inversion:
   - High-level modules should not depend on low-level modules
   - Use dependency injection for better testability

## Additional Improvements
1. Improve error handling:
   - Create domain-specific error classes
   - Implement consistent error response format
   - Add proper logging for errors
   - Implement retry mechanisms for transient failures

2. Implement dependency injection:
   - Add a lightweight DI container
   - Configure services via DI
   - Make testing easier with mock dependencies

3. Update AWS infrastructure:
   - Align CDK code with clean architecture
   - Separate infrastructure concerns
   - Implement proper environment configuration

5. Documentation:
   - Update architecture documentation
   - Create API documentation
   - Add code comments where necessary
   - Document refactoring decisions


