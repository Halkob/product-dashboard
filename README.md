# Product Dashboard - Executive Project Management System

A unified project management platform designed specifically for C-suite executives (CEO, CTO, COO) with role-specific workspaces, real-time task visibility, and AI-powered voice task creation.

## 🎯 Vision

Empower executive leadership with an intuitive, real-time dashboard that provides:
- **Cross-role visibility** of all organizational projects and tasks
- **Role-specific workspaces** (CEO, CTO, COO) tailored to each executive's focus
- **Voice-activated task creation** via AI assistant
- **Real-time updates** across all devices
- **Executive insights** with key metrics and KPIs

## ✨ Key Features

### Current (MVP - REQ-001)
- ✅ Monorepo project structure with Express backend & React frontend
- ✅ PostgreSQL database with 5 core tables (roles, workspaces, projects, tasks, milestones)
- ✅ RESTful API foundation with health checks
- ✅ Comprehensive documentation and setup guides

### Coming Soon
- 🔲 **Authentication & Authorization** (REQ-002) - JWT-based login with role-based access control
- 🔲 **Project Management** (REQ-003) - Create, update, and manage projects and tasks
- 🔲 **Role-Based Workspaces** (REQ-004) - CEO, CTO, COO specialized views
- 🔲 **Executive Dashboard** (REQ-005) - Real-time KPIs, progress tracking, analytics
- 🔲 **Real-Time Updates** (REQ-006) - WebSocket support for live collaboration
- 🔲 **AI Voice Task Assistant** (REQ-007) - Voice commands → AI transcription → Auto task creation

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x LTS
- PostgreSQL 15
- npm 10.x or yarn

### Installation

```bash
# 1. Clone repository
git clone https://github.com/your-org/product-dashboard.git
cd product-dashboard

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your database URL and settings

# 4. Setup database
createdb dashboard_dev
npx prisma migrate dev --name init
npx prisma db seed  # Optional: populate with sample data

# 5. Start development
npm run dev
```

**Access Points:**
- 🔙 Backend API: http://localhost:3001
- 🖥️ Frontend: http://localhost:3000
- 🏥 Health Check: http://localhost:3001/api/health
- 📊 Prisma Studio: `npx prisma studio` (http://localhost:5555)

## 📁 Project Structure

```
product-dashboard/
├── src/
│   ├── server/              # Express.js backend
│   │   ├── config/          # Configuration & environment
│   │   ├── routes/          # API route handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── __tests__/       # Backend tests
│   │   ├── app.ts           # Express app setup
│   │   └── index.ts         # Server entry point
│   └── client/              # React frontend
│       ├── components/      # Reusable components
│       ├── pages/           # Page components
│       ├── store/           # Redux state management
│       ├── __tests__/       # Frontend tests
│       └── index.tsx        # React entry point
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Seed script
├── docs/
│   ├── SETUP.md             # Setup guide
│   ├── ARCHITECTURE.md      # System architecture
│   ├── SCHEMA.md            # Database schema details
│   └── API.md               # API documentation
├── .github/workflows/       # CI/CD pipelines
├── jest.config.js           # Jest configuration
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## 🛠️ Development

### Available Commands

```bash
# Development
npm run dev              # Start backend + frontend concurrently
npm run dev:server      # Start backend only (http://localhost:3001)
npm run dev:client      # Start frontend only (http://localhost:3000)

# Testing
npm test                # Run all tests
npm run test:server     # Backend tests only
npm run test:client     # Frontend tests only

# Code Quality
npm run lint            # Lint all code
npm run type-check      # TypeScript type checking
npm run build           # Build for production

# Database
npx prisma studio      # Interactive database viewer
npx prisma migrate dev # Create new migration

# Docker
npm run docker:build    # Build Docker image
docker-compose up       # Start full stack (Postgres, Redis, services)
```

### Tech Stack

**Backend:**
- Node.js 20.x LTS
- Express 4.18
- TypeScript 5.3 (strict mode)
- Prisma 5.0 ORM
- Zod for validation

**Frontend:**
- React 18.2
- Redux Toolkit 1.9
- Material-UI 5.14
- React Router 6.20
- Axios for HTTP

**Database:**
- PostgreSQL 15
- Redis 7 (caching)

**Testing:**
- Jest 29.7 (backend)
- Vitest 1.0 (frontend)
- Supertest 6.3 (API testing)

**DevOps:**
- Docker & Docker Compose
- GitHub Actions (CI/CD)
- AWS ECS (deployment target)

## 📚 Documentation

Comprehensive documentation available in the `/docs` directory:

- **[SETUP.md](./docs/SETUP.md)** - Detailed installation & configuration guide
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System design & component overview
- **[SCHEMA.md](./docs/SCHEMA.md)** - Database schema with 5 core tables
- **[API.md](./docs/API.md)** - RESTful API endpoint reference

## 🧪 Testing

```bash
# Run all tests with coverage
npm test -- --coverage

# Watch mode (auto-run tests on file changes)
npm test -- --watch

# Run specific test file
npm test -- health.test.ts

# Generate coverage report
npm test -- --coverage --coverageReporter=html
```

**Coverage Target:** 80%+ across all modules

## 🔐 Security

### Current Implementation
- CORS configuration
- Request validation with Zod
- Error handling (no sensitive data in responses)
- SQL injection prevention (Prisma ORM)

### Future (REQ-002+)
- JWT authentication & authorization
- Role-based access control (RBAC)
- Rate limiting
- HTTPS/TLS enforcement
- OWASP Top 10 protections

## 📈 Performance

- **Database Indexes** on frequently queried fields
- **Connection Pooling** via Prisma
- **Redis Caching** for frequently accessed data
- **Frontend Code Splitting** with React.lazy()
- **Static Asset Optimization** via CDN

## 🚢 Deployment

### Docker

```bash
# Build image
docker build -t product-dashboard:latest .

# Run container
docker run -p 3001:3001 -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  product-dashboard:latest
```

### Docker Compose (Local)

```bash
docker-compose up
```

Starts: PostgreSQL, Redis, backend, frontend

### AWS Deployment

```bash
# Via GitHub Actions CI/CD
git push origin main
# → Triggers GitHub Actions
# → Linting, type-check, testing
# → Build Docker image
# → Push to AWS ECR
# → Deploy to AWS ECS
```

## 📋 Requirements & Status

| Req | Title | Status | ETA |
|-----|-------|--------|-----|
| REQ-001 | **Project Setup & Infrastructure** | ✅ In Progress | Week 1 |
| REQ-002 | Authentication & Authorization | 🔲 Planned | Week 2-3 |
| REQ-003 | Project Management System | 🔲 Planned | Week 3-4 |
| REQ-004 | Role-Based Workspaces | 🔲 Planned | Week 4-5 |
| REQ-005 | Executive Dashboard | 🔲 Planned | Week 5-6 |
| REQ-006 | Real-Time Updates | 🔲 Planned | Week 6-7 |
| REQ-007 | AI Voice Task Assistant | 🔲 Planned | Week 7+ |

**Timeline:** ~15 weeks to MVP completion

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Workflow
1. Create feature branch: `git checkout -b feature/description`
2. Make changes and test: `npm test`
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feature/description`
5. Create Pull Request for review

### Code Standards
- TypeScript strict mode required
- 80%+ test coverage required
- Linting must pass: `npm run lint`
- Types must check: `npm run type-check`

## 📝 License

MIT License - see LICENSE file for details

## 👥 Team

**Product Owner:** Executive Leadership
**Tech Lead:** CTO
**Team:** Full-stack engineers

## 📞 Support

- 📖 Check [docs/SETUP.md](./docs/SETUP.md#troubleshooting) for common issues
- 🐛 [Open a GitHub issue](https://github.com/your-org/product-dashboard/issues)
- 💬 Start a GitHub discussion for questions

## 🎉 Acknowledgments

Built with ❤️ using modern TypeScript, React, and Node.js

---

**Status:** 🟡 In Active Development (Week 1 of 15)

Last Updated: March 29, 2026
