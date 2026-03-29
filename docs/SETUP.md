# Setup Guide - REQ-001 Infrastructure

## Prerequisites

- Node.js 20.x LTS
- npm 10.x or yarn
- PostgreSQL 15
- Git

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This installs all required packages from `package.json`.

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your local configuration:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://user:password@localhost:5432/dashboard_dev"
DATABASE_URL_TEST="postgresql://user:password@localhost:5432/dashboard_test"
REDIS_URL="redis://localhost:6379"
REACT_APP_API_URL="http://localhost:3001/api"
CORS_ORIGIN="http://localhost:3000"
LOG_LEVEL="debug"
```

### 3. Setup Database

Create PostgreSQL databases:

```bash
createdb dashboard_dev
createdb dashboard_test
```

### 4. Run Prisma Migrations

Initialize database schema:

```bash
npx prisma migrate dev --name init
```

This:
- Creates the 5 core tables (roles, workspaces, projects, tasks, milestones)
- Generates Prisma client
- Runs migrations

### 5. Seed Sample Data (Optional)

```bash
npx prisma db seed
```

This populates the database with:
- 3 executive roles (CEO, CTO, COO)
- 3 workspaces (one per role)
- Sample projects and tasks

## Development

### Start Development Server

```bash
npm run dev
```

This runs both backend and frontend concurrently:
- **Backend**: http://localhost:3001 (Express server with hot reload)
- **Frontend**: http://localhost:3000 (React development server)

### Start Backend Only

```bash
npm run dev:server
```

### Start Frontend Only

```bash
npm run dev:client
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Server Tests Only

```bash
npm run test:server
```

### Run Client Tests Only

```bash
npm run test:client
```

### Run Tests with Coverage

```bash
npm run test:server -- --coverage
npm run test:client -- --coverage
```

## Building

### Build Both Applications

```bash
npm run build
```

### Build Server Only

```bash
npm run build:server
```

### Build Client Only

```bash
npm run build:client
```

## Code Quality

### Lint Code

```bash
npm run lint
```

### Check Types

```bash
npm run type-check
```

## Database Management

### View Database with Prisma Studio

```bash
npx prisma studio
```

Opens interactive GUI at http://localhost:5555 to browse database.

### Reset Database

```bash
npx prisma migrate reset
```

⚠️ Warning: This deletes all data and reapplies migrations.

## Docker Setup (Optional)

### Build Docker Image

```bash
npm run docker:build
```

### Run with Docker Compose

```bash
docker-compose up
```

This starts:
- PostgreSQL database
- Redis cache
- Backend server
- Frontend server

## Troubleshooting

### TypeScript Compilation Errors

If you see TypeScript errors about missing types:

```bash
npm install
npx tsc --version
```

### Database Connection Issues

1. Verify PostgreSQL is running:
   ```bash
   psql postgres
   ```

2. Check `DATABASE_URL` in `.env`

3. Test connection:
   ```bash
   npx prisma db execute --stdin < /dev/null
   ```

### Port Already in Use

If port 3001 or 3000 is already in use:

```bash
# Change PORT in .env
PORT=3002

# Or kill process using port:
lsof -ti:3001 | xargs kill -9
```

### Prisma Client Generation

If Prisma client is out of sync:

```bash
npx prisma generate
```

## Health Check

Verify server is running:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-29T10:00:00.000Z",
  "uptime": 42.5,
  "environment": "development",
  "version": "0.1.0-alpha"
}
```

## Next Steps

1. ✅ Infrastructure setup complete (REQ-001)
2. 🔲 Authentication & Authorization (REQ-002)
3. 🔲 Project Management System (REQ-003)
4. 🔲 Role-Based Workspaces (REQ-004)
5. 🔲 Executive Dashboard (REQ-005)
6. 🔲 Real-Time Updates (REQ-006)
7. 🔲 AI Voice Task Assistant (REQ-007)

## Support

For issues or questions, refer to:
- `/docs/ARCHITECTURE.md` - System design
- `/docs/SCHEMA.md` - Database schema
- `/docs/API.md` - API endpoints
