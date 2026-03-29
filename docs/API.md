# API Reference - REQ-001 Foundation

## Base URL

```
http://localhost:3001/api
```

## Health Check

### GET /health

Returns the health status of the API server.

**Endpoint**: `GET http://localhost:3001/api/health`

**Response** (200 OK):

```json
{
  "status": "healthy",
  "timestamp": "2026-03-29T10:00:00.000Z",
  "uptime": 42.5,
  "environment": "development",
  "version": "0.1.0-alpha"
}
```

**Purpose**: 
- Monitor server health
- Used by load balancers
- Verify API connectivity

**Use Cases**:
- Startup checks
- Health monitoring dashboards
- Load balancer heartbeats

---

## Response Format

All API responses follow a standard format:

### Success Response (2xx)

```json
{
  "data": { /* actual response data */ },
  "status": "success",
  "timestamp": "2026-03-29T10:00:00.000Z"
}
```

### Error Response (4xx, 5xx)

```json
{
  "error": {
    "message": "Descriptive error message",
    "statusCode": 500,
    "timestamp": "2026-03-29T10:00:00.000Z"
  }
}
```

---

## Future API Endpoints (Planned)

### Authentication (REQ-002)
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh JWT token

### Projects (REQ-003)
- `GET /projects` - List projects
- `POST /projects` - Create project
- `GET /projects/:id` - Get project details
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project

### Tasks (REQ-003)
- `GET /tasks` - List tasks
- `POST /tasks` - Create task
- `GET /tasks/:id` - Get task details
- `PUT /tasks/:id` - Update task
- `DELETE /tasks/:id` - Delete task

### Workspaces (REQ-004)
- `GET /workspaces` - List workspaces
- `GET /workspaces/:id` - Get workspace details
- `GET /workspaces/:id/projects` - Get workspace projects
- `GET /workspaces/:id/tasks` - Get workspace tasks

### Dashboard (REQ-005)
- `GET /dashboard` - Get dashboard data for current user
- `GET /dashboard/summary` - Quick summary statistics

### Real-Time Updates (REQ-006)
- `WS /socket` - WebSocket connection for real-time updates
- Events: task-created, task-updated, project-created, etc.

### Voice Tasks (REQ-007)
- `POST /voice/transcribe` - Upload audio and get transcript
- `POST /voice/create-task` - Create task from voice transcript
- `GET /voice/tasks` - List voice-created tasks
- `GET /voice/transcript/:id` - Get transcript details

---

## HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource successfully created |
| 204 | No Content | Request successful, no response body |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required (REQ-002) |
| 403 | Forbidden | Access denied / insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Server temporarily unavailable |

---

## Request Headers

Standard headers for all requests:

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>  [REQ-002+]
```

---

## Error Handling

### Validation Errors

When request validation fails:

```json
{
  "error": {
    "message": "Validation failed",
    "statusCode": 422,
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### Server Errors

For 5xx errors, minimal information is returned:

```json
{
  "error": {
    "message": "Internal Server Error",
    "statusCode": 500,
    "timestamp": "2026-03-29T10:00:00.000Z"
  }
}
```

Details are logged on the server (not exposed to clients for security).

---

## Pagination (Future)

List endpoints will support pagination:

```
GET /api/projects?page=1&limit=20&sort=-createdAt
```

Response:

```json
{
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## Rate Limiting (Future)

Rate limiting headers (REQ-002):

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1643023200
```

When limit exceeded (429):

```json
{
  "error": {
    "message": "Rate limit exceeded",
    "statusCode": 429,
    "retryAfter": 60
  }
}
```

---

## CORS Policy

Allowed origins configured in `.env`:

```
CORS_ORIGIN=http://localhost:3000
```

Multiple origins (production):

```
CORS_ORIGIN="https://dashboard.example.com,https://app.example.com"
```

---

## API Versioning

Current version: **v1**

All endpoints are under `/api/v1/` path:

```
GET http://localhost:3001/api/v1/projects
```

Future versions will maintain backward compatibility:

```
GET http://localhost:3001/api/v2/projects
```

---

## Testing the API

### Using cURL

```bash
# Health check
curl http://localhost:3001/api/health

# With JSON output pretty-print
curl -s http://localhost:3001/api/health | jq
```

### Using Postman

1. Import `postman-collection.json` (to be created)
2. Set environment variable: `BASE_URL=http://localhost:3001/api`
3. Run requests from collection

### Using REST Client (VS Code)

Create `requests.http`:

```http
### Health Check
GET http://localhost:3001/api/health

### Get All Projects (Future)
GET http://localhost:3001/api/v1/projects
Authorization: Bearer <token>

### Create Task (Future)
POST http://localhost:3001/api/v1/tasks
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "New Task",
  "description": "Task description",
  "projectId": 1,
  "priority": "high"
}
```

---

## Webhook Events (Future)

Events posted to configured webhook URLs:

```
POST https://your-webhook-url.com
Content-Type: application/json
X-Webhook-Signature: sha256=...

{
  "event": "task.created",
  "timestamp": "2026-03-29T10:00:00.000Z",
  "data": {
    "id": 123,
    "title": "Task Title",
    "projectId": 1
  }
}
```

---

## GraphQL API (Future)

Optional GraphQL endpoint alongside REST:

```
POST http://localhost:3001/graphql
```

Benefits:
- Flexible querying
- Single request for multiple resources
- Reduced over-fetching

---

## SDK & Client Libraries (Future)

Official client libraries:

- `@product-dashboard/sdk-js` - JavaScript/TypeScript
- `@product-dashboard/sdk-python` - Python
- `@product-dashboard/sdk-go` - Go

---

## Documentation

- [Setup Guide](./SETUP.md) - Getting started
- [Architecture](./ARCHITECTURE.md) - System design
- [Database Schema](./SCHEMA.md) - Data models
- [Contributing Guide](../CONTRIBUTING.md) - Development guidelines

---

## Support

For API issues:
1. Check [troubleshooting section](./SETUP.md#troubleshooting)
2. Review error response details
3. Check server logs: `tail -f logs/server.log`
4. Open GitHub issue with details
