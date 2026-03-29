# Architecture Overview - REQ-001

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Product Dashboard                          │
│                     (Executive Dashboard)                       │
└────────────────────┬──────────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┬────────────┐
        │                           │            │
    ┌───▼──────┐            ┌──────▼────┐  ┌───▼──────┐
    │  Browser │            │  Browser  │  │ Browser  │
    │  (React) │            │  (React)  │  │ (React)  │
    └───┬──────┘            └──────┬────┘  └───┬──────┘
        │                          │            │
        │    HTTPS/WebSocket       │            │
        │   ┌──────────────────────┘            │
        │   │                                   │
    ┌───▼───┴───────────────────────────────────▼───┐
    │         Reverse Proxy / Load Balancer          │
    │              (AWS ALB/NLB)                     │
    └───┬──────────────────────────────────────────┬┘
        │                                          │
    ┌───▼────────────────────────────────────────┬┘
    │        Express.js API Server               │
    │     (Node.js 20.x - Dockerized)           │
    │                                            │
    │  ┌──────────────────────────────────────┐ │
    │  │      Request Pipeline                │ │
    │  │  CORS → Auth → Routes → Errors       │ │
    │  └──────────────────┬───────────────────┘ │
    │                     │                      │
    │  ┌──────────────────▼───────────────────┐ │
    │  │  API Routes (v1)                     │ │
    │  │  • /api/health                       │ │
    │  │  • /api/projects (REQ-003)           │ │
    │  │  • /api/tasks (REQ-003)              │ │
    │  │  • /api/workspaces (REQ-004)         │ │
    │  │  • /api/auth (REQ-002)               │ │
    │  │  • /api/voice (REQ-007)              │ │
    │  │  • /api/dashboard (REQ-005)          │ │
    │  └──────────────────┬───────────────────┘ │
    └─────────────────────┼─────────────────────┘
                          │
          ┌───────────────┼──────────────────┬─────────────────┐
          │               │                  │                 │
      ┌───▼────┐      ┌──▼──────┐  ┌────────▼────┐  ┌────────▼────┐
      │PostgreSQL      │ Prisma  │  │   Google    │  │   OpenAI    │
      │Database        │ ORM     │  │   Speech    │  │    GPT-4    │
      │(RDS)          │         │  │   (Voice)   │  │  (AI Tasks) │
      └────────┘      └─────────┘  └─────────────┘  └─────────────┘
```

## Technology Stack

### Backend
- **Runtime**: Node.js 20.x LTS
- **Framework**: Express.js 4.18
- **Language**: TypeScript 5.3 (strict mode)
- **ORM**: Prisma 5.0
- **Validation**: Zod 3.22

### Database
- **Primary**: PostgreSQL 15 (via AWS RDS)
- **Cache**: Redis 7 (via AWS ElastiCache)

### Frontend
- **Framework**: React 18.2
- **State Management**: Redux Toolkit 1.9
- **UI Library**: Material-UI 5.14
- **Routing**: React Router 6.20
- **HTTP Client**: Axios 1.6
- **Charts**: Recharts 2.10

### Testing
- **Backend**: Jest 29.7 + Supertest 6.3
- **Frontend**: Vitest 1.0 + React Testing Library 14.1

### DevOps
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Deployment**: AWS ECS
- **Infrastructure as Code**: Terraform (future)

## Directory Structure

```
product-dashboard/
├── .github/
│   └── workflows/
│       ├── test.yml          # Lint, type-check, test pipeline
│       └── build.yml         # Docker build & deployment
├── docs/
│   ├── SETUP.md             # Setup guide
│   ├── ARCHITECTURE.md      # This file
│   ├── SCHEMA.md            # Database schema details
│   └── API.md               # API endpoint documentation
├── prisma/
│   ├── schema.prisma        # Database schema (5 tables)
│   └── seed.ts              # Database seed script
├── src/
│   ├── server/              # Express backend
│   │   ├── config/          # Configuration & env
│   │   ├── routes/          # API route handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── __tests__/       # Backend unit tests
│   │   ├── app.ts           # Express app setup
│   │   └── index.ts         # Entry point
│   └── client/              # React frontend
│       ├── components/      # Reusable React components
│       ├── pages/           # Page components
│       ├── store/           # Redux store & slices
│       ├── __tests__/       # Frontend unit tests
│       └── index.tsx        # React entry point
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── Dockerfile               # Docker image definition
├── docker-compose.yml       # Local development stack
├── jest.config.js           # Jest testing configuration
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript configuration
├── tsconfig.server.json     # Backend TypeScript config
├── tsconfig.client.json     # Frontend TypeScript config
└── README.md                # Project overview
```

## Request Flow

```
HTTP Request
    ↓
CORS Middleware (check origin)
    ↓
Body Parser Middleware (parse JSON)
    ↓
Express Router (route matching)
    ↓
Route Handler
    ├─ Validation (Zod)
    ├─ Database Query (Prisma)
    └─ Response Formatting
    ↓
Error Handler (catch errors)
    ↓
JSON Response (200, 400, 500, etc)
```

## Data Models (REQ-001 Foundation)

### 1. Role
- id (Primary Key)
- name (CEO, CTO, COO)
- description
- timestamps

### 2. Workspace
- id (Primary Key)
- name (workspace title)
- description
- roleId (Foreign Key → Role)
- timestamps
- Contains: Projects, Tasks

### 3. Project
- id (Primary Key)
- name (project title)
- description
- status (active, paused, completed, archived)
- workspaceId (Foreign Key → Workspace)
- timestamps
- Contains: Tasks, Milestones

### 4. Task
- id (Primary Key)
- title (task title)
- description
- status (todo, in-progress, done, blocked)
- priority (low, medium, high, critical)
- projectId (Foreign Key → Project)
- workspaceId (Foreign Key → Workspace)
- voiceCreated (Boolean - for REQ-007)
- voiceTranscript (String - for REQ-007)
- dueDate (optional)
- timestamps

### 5. Milestone
- id (Primary Key)
- name (milestone name)
- description
- dueDate (deadline)
- projectId (Foreign Key → Project)
- timestamps

## Environment Configuration

Configuration is managed via environment variables (`.env`):

```env
# Server
NODE_ENV=development|production
PORT=3001

# Database
DATABASE_URL=postgresql://...
DATABASE_URL_TEST=postgresql://...

# Frontend
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=debug|info|warn|error

# Future (REQ-002)
# JWT_SECRET=...
# JWT_EXPIRATION=15m
```

## Development Workflow

1. **Create Branch**: `git checkout -b feature/task-name`
2. **Make Changes**: Modify source files
3. **Type Check**: `npm run type-check`
4. **Lint**: `npm run lint`
5. **Test**: `npm test`
6. **Build**: `npm run build`
7. **Commit**: `git commit -m "feat: description"`
8. **Push**: `git push origin feature/task-name`
9. **Pull Request**: Create PR for review

## Testing Strategy

### Unit Tests
- Test individual functions and components
- Jest for backend, Vitest for frontend
- Target: 80%+ code coverage

### Integration Tests
- Test API endpoints with database
- Use Supertest for backend
- Test workflow scenarios

### E2E Tests (Future)
- Test full user workflows
- Playwright or Cypress

### Performance Tests (Future)
- Load testing with k6
- Database query optimization

## Deployment Architecture

```
GitHub Repository
    ↓ (Push to main)
GitHub Actions CI/CD
    ├─ Lint
    ├─ Type Check
    ├─ Unit Tests
    ├─ Build Docker Image
    └─ Push to AWS ECR
        ↓
AWS ECS (Elastic Container Service)
    ├─ Backend Service (Express)
    ├─ Frontend Service (React via Nginx)
    └─ RDS PostgreSQL
        ↓
AWS CloudFront (CDN)
    ↓
End Users
```

## Security Considerations

### Current (REQ-001)
- CORS configuration
- Input validation (Zod)
- Error handling (no sensitive data in responses)

### Future (REQ-002+)
- JWT authentication
- Role-based access control (RBAC)
- Rate limiting
- SQL injection prevention (via Prisma)
- HTTPS/TLS enforcement
- OWASP Top 10 protections

## Performance Optimization

### Database
- Indexes on frequently queried fields
- Connection pooling
- Query optimization via Prisma

### Caching
- Redis for session data
- Frontend caching headers
- Memoization in React components

### Frontend
- Code splitting via React.lazy()
- Image optimization
- Bundle size optimization

## Monitoring & Observability (Future)

- **Logging**: Winston/Pino
- **Metrics**: Prometheus
- **Tracing**: Jaeger
- **Alerts**: CloudWatch
- **APM**: New Relic or DataDog

## Related Documentation

- [Setup Guide](./SETUP.md) - Installation & running
- [Database Schema](./SCHEMA.md) - Detailed table definitions
- [API Reference](./API.md) - Endpoint documentation
