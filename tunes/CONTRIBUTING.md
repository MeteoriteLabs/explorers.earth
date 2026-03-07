# Contributing to Cosmic

Thank you for your interest in contributing to Cosmic! We welcome contributions from the community to help make this project better.

## Code of Conduct

Please review and follow our code of conduct to help us maintain a welcoming and inclusive environment for everyone.

## How to Contribute

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes
4. Write or update tests as needed
5. Update documentation if required
6. Submit a pull request

### Pull Request Process

1. Ensure your code follows the existing style conventions
2. Update the README.md with details of changes to the interface
3. The PR will be merged once you have the sign-off of at least one maintainer

## Development Setup

1. Clone your fork locally
```bash
git clone https://github.com/your-username/cosmic.git
cd cosmic
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file with the required environment variables (see README.md)

4. Set up the database
```bash
# Initialize database tables
npm run db:push
```

## Code Style

- Use TypeScript for type safety
- Follow the existing code formatting
- Write meaningful commit messages
- Add comments for complex logic
- Include JSDoc comments for functions and components

### TypeScript Guidelines

- Always define proper types/interfaces
- Use type inference when possible
- Avoid using `any`
- Use proper error handling

### React Component Guidelines

- Use functional components
- Implement proper prop types
- Use hooks appropriately
- Keep components focused and reusable

### API Guidelines

- Follow RESTful conventions
- Implement proper error handling
- Use appropriate HTTP methods
- Include proper validation

### Real-time Communication Guidelines

- Use Socket.IO for all real-time features
- Follow the established event protocol in README.md
- Handle connection/disconnection gracefully
- Implement proper error handling
- Test real-time functionality thoroughly

## Testing

- Write unit tests for new features
- Ensure all tests pass before submitting a PR
- Add integration tests where appropriate
- Test WebSocket functionality thoroughly

### Test Guidelines

- Use descriptive test names
- Test edge cases
- Mock external services
- Ensure proper cleanup

## Documentation

- Update documentation for any changed functionality
- Include JSDoc comments for new functions and components
- Update the README.md if adding new features or changing setup instructions
- Document any new environment variables

### Documentation Guidelines

- Use clear and concise language
- Include code examples where appropriate
- Document breaking changes
- Update API documentation

## Database Changes

- Add new migrations in `shared/schema.ts`
- Run `npm run db:push` to apply changes
- Never modify production data directly
- Test migrations thoroughly
- Document schema changes

## Questions or Problems?

Feel free to open an issue in the repository if you have any questions or encounter any problems.

### Issue Guidelines

- Use issue templates if available
- Provide clear reproduction steps
- Include relevant error messages
- Specify your environment

## Deployment

- Test changes in a staging environment
- Follow the deployment checklist
- Monitor for any issues
- Document deployment changes

Thank you for contributing to Cosmic!