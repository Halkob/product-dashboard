# Contributing Guide

Thank you for your interest in contributing to Product Dashboard! This guide explains how to contribute effectively.

## Code of Conduct

- Be respectful and inclusive
- Focus on the code, not the person
- Help others learn and grow
- Report issues confidently

## Development Setup

See [docs/SETUP.md](./docs/SETUP.md) for detailed setup instructions.

### Quick Setup

```bash
git clone https://github.com/your-org/product-dashboard.git
cd product-dashboard
npm install
cp .env.example .env
# Edit .env with your local database
npm run dev
```

## Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/short-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions

### 2. Make Changes

- Write code in TypeScript (strict mode required)
- Follow existing code style
- Keep commits small and logical
- Write meaningful commit messages

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:server

# Run in watch mode
npm run test:watch

# Generate coverage report
npm test -- --coverage
```

**Coverage Requirements:**
- Minimum 80% code coverage
- No coverage regressions
- All edge cases tested

### 4. Check Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build check
npm run build
```

### 5. Commit Changes

Commit message format:

```
feat: add new feature description
      
Optional detailed explanation if needed.
Can include breaking changes notes.
```

**Commit types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style (no logic change)
- `refactor:` - Code restructuring
- `test:` - Test additions
- `chore:` - Build/config changes

Examples:
```
feat: add health check endpoint
fix: resolve database connection timeout
docs: update setup guide with Docker instructions
refactor: extract error handling middleware
test: add unit tests for task creation
```

### 6. Push & Create Pull Request

```bash
git push origin feature/short-description
```

Create a Pull Request with:
- Clear title describing the changes
- Description of what and why
- Link to related issues (if any)
- Screenshots for UI changes
- Checklist completed

#### Pull Request Checklist

```markdown
- [ ] Tests pass locally (`npm test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Code lints successfully (`npm run lint`)
- [ ] Builds successfully (`npm run build`)
- [ ] Updated documentation if needed
- [ ] Added test coverage for new code
- [ ] No breaking changes (or documented)
- [ ] Follows code standards (see below)
```

### 7. Code Review

- Address reviewer feedback promptly
- Discuss concerns professionally
- Update code and push new commits
- Reviewer approves when satisfied

### 8. Merge

Once approved:
- Squash commits if needed
- Merge to main branch
- Delete feature branch
- Deployment happens via CI/CD

## Code Standards

### TypeScript

- **Strict Mode Required** - All files use `"strict": true`
- **No `any` type** - Use proper typing
- **Meaningful names** - Clear variable/function names
- **Comments for complex logic** - Explain the "why"

Example:
```typescript
// ✅ Good
interface Task {
  id: number;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
}

function createTask(title: string): Promise<Task> {
  // Validation happens first
  if (!title?.trim()) {
    throw new Error('Title is required');
  }
  return db.tasks.create({ title });
}

// ❌ Bad
function createTask(title: any) {
  const task: any = { title };
  return db.tasks.create(task);
}
```

### React Components

- **Functional components** - Use hooks
- **Props typing** - Type all props
- **Meaningful names** - Clear component names
- **Keep components small** - <200 lines preferred

Example:
```typescript
// ✅ Good
interface TaskItemProps {
  task: Task;
  onUpdate: (task: Task) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onUpdate }) => {
  const handleStatusChange = (newStatus: Task['status']) => {
    onUpdate({ ...task, status: newStatus });
  };

  return (
    <div className="task-item">
      {task.title}
      {/* ... */}
    </div>
  );
};

export default TaskItem;
```

### Testing

- **Test behavior, not implementation** - Focus on "what" not "how"
- **Clear test names** - "should..." format
- **Arrange-Act-Assert** - Clear structure
- **Mock external dependencies** - Isolate unit tests

Example:
```typescript
describe('TaskService', () => {
  describe('createTask', () => {
    it('should create task with provided title', async () => {
      // Arrange
      const mockDb = { tasks: { create: jest.fn() } };
      const service = new TaskService(mockDb);

      // Act
      const result = await service.createTask('New Task');

      // Assert
      expect(result.title).toBe('New Task');
      expect(mockDb.tasks.create).toHaveBeenCalled();
    });

    it('should reject empty title', async () => {
      const service = new TaskService({} as any);

      await expect(
        service.createTask('')
      ).rejects.toThrow('Title is required');
    });
  });
});
```

### API Endpoints

- **Consistent naming** - `/api/v1/resources`
- **RESTful conventions** - GET, POST, PUT, DELETE
- **Proper status codes** - 200, 201, 400, 404, 500
- **Error responses** - Consistent format

Example:
```typescript
// ✅ Good
router.post('/tasks', async (req, res) => {
  try {
    const { error } = taskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const task = await db.tasks.create(req.body);
    return res.status(201).json({ data: task });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to create task',
    });
  }
});
```

## Documentation

Update relevant documentation when:

- Adding new features
- Changing APIs
- Updating architecture
- Adding configuration options

### Files to Update

- `README.md` - If feature affects users
- `docs/SETUP.md` - If setup instructions change
- `docs/ARCHITECTURE.md` - If architecture changes
- `docs/API.md` - If adding/changing endpoints
- `docs/SCHEMA.md` - If database schema changes
- Code comments - Complex logic or non-obvious decisions

## Requirements

Each PR should address one of the active requirements:

- **REQ-001** - Infrastructure Setup (Current)
- **REQ-002** - Authentication & Authorization
- **REQ-003** - Project Management System
- **REQ-004** - Role-Based Workspaces
- **REQ-005** - Executive Dashboard
- **REQ-006** - Real-Time Updates
- **REQ-007** - AI Voice Task Assistant

Link your PR to the requirement:
```markdown
Fixes #REQ-002
Related to voice task feature work
```

## Getting Help

- 💬 Check existing [GitHub Discussions](https://github.com/your-org/product-dashboard/discussions)
- 📖 Read [documentation](./docs)
- 🐛 Search [GitHub Issues](https://github.com/your-org/product-dashboard/issues)
- 👥 Ask on team Slack

## Performance

- Profile before optimizing
- Focus on big wins (database queries, API calls)
- Use appropriate tools:
  - React DevTools Profiler
  - Chrome DevTools Performance
  - Database query logs

## Security

Never commit:
- Secrets (.env with real values)
- API keys
- Database credentials
- Private data

Use `.env.example` template for configuration.

## Dependencies

Before adding new dependencies:

1. Check if already included in npm tree
2. Verify active maintenance
3. Check bundle size impact
4. Update CHANGELOG if significant
5. Document rationale in PR

## Releases

Releases follow [Semantic Versioning](https://semver.org/):
- **Major (1.0.0)** - Breaking changes
- **Minor (0.1.0)** - New features
- **Patch (0.0.1)** - Bug fixes

Tagged releases automatically deploy to production via CI/CD.

## Questions?

- Open a GitHub issue
- Start a discussion
- DM team lead on Slack
- Email project owner

---

**Thank you for contributing!** 🎉

Your work helps make Product Dashboard better for everyone.
