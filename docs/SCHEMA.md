# Database Schema - REQ-001

## Overview

The product-dashboard database uses PostgreSQL 15 with 5 core tables designed for MVP functionality with extensibility for future requirements.

**Design Principles:**
- Normalization to 3NF (Third Normal Form)
- Referential integrity via foreign keys
- Timestamps for audit trails (createdAt, updatedAt)
- Indexes on frequently queried fields
- Soft deletes optional (implemented via status field)

---

## Schema Diagram

```
┌─────────────────┐
│      roles      │
├─────────────────┤
│ id (PK)         │
│ name (UNIQUE)   │
│ description     │
│ createdAt       │
│ updatedAt       │
└────────┬────────┘
         │ (1:N)
         │
┌────────▼────────────┐
│   workspaces        │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ description         │
│ roleId (FK→Role)    │
│ createdAt           │
│ updatedAt           │
│ UNIQUE(name,roleId) │
└────────┬────────────┘
         │ (1:N)
         │
    ┌────┴──────────────┐
    │                   │
┌───▼──────────┐    ┌──▼──────────┐
│  projects    │    │    tasks     │
├──────────────┤    ├──────────────┤
│ id (PK)      │    │ id (PK)      │
│ name         │    │ title        │
│ description  │    │ description  │
│ status       │    │ status       │
│ workspaceId  │    │ priority     │
│ createdAt    │    │ projectId    │
│ updatedAt    │    │ workspaceId  │
└───┬──────────┘    │ voiceCreated │
    │               │ voiceTransc  │
    │ (1:N)         │ dueDate      │
    │               │ createdAt    │
┌───▼────────────┐  │ updatedAt    │
│  milestones    │  └──────────────┘
├────────────────┤
│ id (PK)        │
│ name           │
│ description    │
│ dueDate        │
│ projectId (FK) │
│ createdAt      │
│ updatedAt      │
└────────────────┘
```

---

## Table Definitions

### 1. Roles Table

Defines the three executive roles in the system.

```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_name (name)
);
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| name | VARCHAR(255) | NOT NULL, UNIQUE | Role name (CEO, CTO, COO) |
| description | TEXT | NULLABLE | Role description |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Sample Data:**

```sql
INSERT INTO roles (name, description) VALUES
('CEO', 'Chief Executive Officer - Full organizational visibility'),
('CTO', 'Chief Technology Officer - Technical initiatives focus'),
('COO', 'Chief Operating Officer - Operations and processes focus');
```

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `name`

---

### 2. Workspaces Table

Isolated work areas for different organizational units (one per role).

```sql
CREATE TABLE workspaces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  roleId INTEGER NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(name, roleId),
  INDEX idx_roleId (roleId)
);
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Workspace name |
| description | TEXT | NULLABLE | Workspace description |
| roleId | INTEGER | NOT NULL, FK(roles.id) | Associated role |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Relationships:**
- Foreign Key: `roleId` → `roles.id`
- Cascade Delete: Deleting role deletes workspaces

**Unique Constraints:**
- `(name, roleId)` - Same workspace name allowed across different roles

**Sample Data:**

```sql
INSERT INTO workspaces (name, description, roleId) VALUES
('CEO Dashboard', 'Strategic overview of all organizational initiatives', 1),
('CTO Tech Stack', 'Technology infrastructure and development initiatives', 2),
('COO Operations', 'Operational processes and efficiency improvements', 3);
```

**Indexes:**
- PRIMARY KEY on `id`
- FOREIGN KEY on `roleId`
- UNIQUE on `(name, roleId)`

---

### 3. Projects Table

High-level initiatives and programs within workspaces.

```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  workspaceId INTEGER NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX idx_workspaceId (workspaceId),
  INDEX idx_status (status)
);
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Project name |
| description | TEXT | NULLABLE | Project description |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'active' | Project status |
| workspaceId | INTEGER | NOT NULL, FK(workspaces.id) | Associated workspace |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Status Values:**
- `active` - Currently in progress
- `paused` - Temporarily paused
- `completed` - Successfully completed
- `archived` - Historical/reference only

**Relationships:**
- Foreign Key: `workspaceId` → `workspaces.id`
- Cascade Delete: Deleting workspace deletes projects

**Sample Query:**

```sql
-- Get all active projects in CEO workspace
SELECT p.* FROM projects p
JOIN workspaces w ON p.workspaceId = w.id
WHERE w.id = 1 AND p.status = 'active';
```

**Indexes:**
- PRIMARY KEY on `id`
- FOREIGN KEY on `workspaceId`
- INDEX on `status`

---

### 4. Tasks Table

Individual work items within projects (supports voice creation - REQ-007).

```sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'todo',
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  projectId INTEGER,
  workspaceId INTEGER NOT NULL,
  voiceCreated BOOLEAN NOT NULL DEFAULT FALSE,
  voiceTranscript TEXT,
  dueDate TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX idx_projectId (projectId),
  INDEX idx_workspaceId (workspaceId),
  INDEX idx_status (status)
);
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| title | VARCHAR(255) | NOT NULL | Task title |
| description | TEXT | NULLABLE | Detailed description |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'todo' | Task status |
| priority | VARCHAR(50) | NOT NULL, DEFAULT 'medium' | Priority level |
| projectId | INTEGER | NULLABLE, FK(projects.id) | Associated project |
| workspaceId | INTEGER | NOT NULL, FK(workspaces.id) | Associated workspace |
| voiceCreated | BOOLEAN | NOT NULL, DEFAULT FALSE | Created via voice (REQ-007) |
| voiceTranscript | TEXT | NULLABLE | Original voice transcript |
| dueDate | TIMESTAMP | NULLABLE | Task deadline |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Status Values:**
- `todo` - Not started
- `in-progress` - Currently being worked on
- `done` - Completed
- `blocked` - Blocked by dependency

**Priority Values:**
- `low` - Nice to have
- `medium` - Standard priority
- `high` - Important
- `critical` - Must be done ASAP

**Relationships:**
- Foreign Key: `projectId` → `projects.id` (optional, can exist without project)
- Foreign Key: `workspaceId` → `workspaces.id`
- Set NULL on Delete: Deleting project doesn't delete orphaned tasks
- Cascade Delete: Deleting workspace deletes tasks

**Sample Queries:**

```sql
-- Get all high priority tasks in progress
SELECT * FROM tasks 
WHERE status = 'in-progress' AND priority = 'high'
ORDER BY dueDate ASC;

-- Get voice-created tasks (REQ-007)
SELECT * FROM tasks 
WHERE voiceCreated = TRUE 
ORDER BY createdAt DESC;

-- Count tasks by status
SELECT status, COUNT(*) as count 
FROM tasks 
GROUP BY status;
```

**Indexes:**
- PRIMARY KEY on `id`
- FOREIGN KEY on `projectId`
- FOREIGN KEY on `workspaceId`
- INDEX on `status` (frequently filtered)

---

### 5. Milestones Table

Key dates and deliverables for projects.

```sql
CREATE TABLE milestones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  dueDate TIMESTAMP NOT NULL,
  projectId INTEGER NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_projectId (projectId)
);
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Milestone name |
| description | TEXT | NULLABLE | Milestone details |
| dueDate | TIMESTAMP | NOT NULL | Deadline date |
| projectId | INTEGER | NOT NULL, FK(projects.id) | Associated project |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Relationships:**
- Foreign Key: `projectId` → `projects.id`
- Cascade Delete: Deleting project deletes milestones

**Sample Query:**

```sql
-- Get upcoming milestones (next 30 days)
SELECT m.* FROM milestones m
WHERE m.dueDate BETWEEN NOW() AND NOW() + INTERVAL '30 days'
ORDER BY m.dueDate ASC;
```

**Indexes:**
- PRIMARY KEY on `id`
- FOREIGN KEY on `projectId`

---

## Database Constraints & Rules

### Referential Integrity

```
roles (1) ──→ (N) workspaces
  │
  └─→ Cascade Delete: Deleting role deletes all workspaces

workspaces (1) ──→ (N) projects
workspaces (1) ──→ (N) tasks
  │
  └─→ Cascade Delete: Deleting workspace deletes projects & tasks

projects (1) ──→ (N) tasks
  │
  └─→Set NULL: Deleting project sets task.projectId to NULL (orphaned tasks allowed)

projects (1) ──→ (N) milestones
  │
  └─→ Cascade Delete: Deleting project deletes milestones
```

### Data Validation

| Table | Field | Rules |
|-------|-------|-------|
| roles | name | NOT NULL, UNIQUE, 3-50 chars |
| workspaces | name | NOT NULL, max 255 chars |
| workspaces | roleId | NOT NULL, must exist in roles |
| projects | name | NOT NULL, max 255 chars |
| projects | status | NOT NULL, in (active, paused, completed, archived) |
| tasks | title | NOT NULL, max 255 chars |
| tasks | status | NOT NULL, in (todo, in-progress, done, blocked) |
| tasks | priority | NOT NULL, in (low, medium, high, critical) |
| tasks | voiceCreated | NOT NULL, default FALSE |
| milestones | name | NOT NULL, max 255 chars |
| milestones | dueDate | NOT NULL |

---

## Indexes

Indexes optimize query performance:

```sql
-- Explicit indexes
CREATE INDEX idx_workspaces_roleId ON workspaces(roleId);
CREATE INDEX idx_projects_workspaceId ON projects(workspaceId);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_tasks_projectId ON tasks(projectId);
CREATE INDEX idx_tasks_workspaceId ON tasks(workspaceId);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_milestones_projectId ON milestones(projectId);

-- Foreign key indexes (automatic)
CREATE INDEX idx_tasks_voiceCreated ON tasks(voiceCreated);
```

**Index Selection:**
- Foreign keys (for joins)
- Status/state fields (frequent WHERE clauses)
- voiceCreated (REQ-007 filtering)

---

## Migrations

Prisma handles migrations automatically:

```bash
# Create initial migration
npx prisma migrate dev --name init

# View migrations
ls prisma/migrations/

# Reset database
npx prisma migrate reset
```

Migration history stored in `prisma/migrations/` directory with timestamps.

---

## Growth Projections

**Estimated data volume (Year 1):**

| Table | Records | Size |
|-------|---------|------|
| roles | 3 | < 1 KB |
| workspaces | 5-10 | < 1 KB |
| projects | 50-100 | ~100 KB |
| tasks | 500-1000 | ~1 MB |
| milestones | 100-200 | ~100 KB |

**Total**: ~1-2 MB for Year 1

---

## Backup & Recovery

**Backup Strategy:**
```bash
# Full backup
pg_dump dashboard_dev > backup.sql

# Restore
psql dashboard_dev < backup.sql

# Point-in-time recovery (AWS RDS)
- Automated backups (7-35 days retention)
- Manual snapshots available
```

---

## Performance Tuning (Future)

### Query Optimization
- Analyze slow queries with `EXPLAIN ANALYZE`
- Add indexes based on query patterns
- Use prepared statements (Prisma does this)

### Connection Pooling
- PgBouncer for connection pooling
- AWS RDS Proxy for managed pooling

### Partitioning (if needed)
- Partition tasks table by year/quarter
- Reduces query scan time for large datasets

---

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Setup Guide](./SETUP.md)
- [API Reference](./API.md)
- [Prisma Docs](https://www.prisma.io/docs/)
