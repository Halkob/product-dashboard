/**
 * REQ-009 — Typed API client for project management endpoints.
 * Uses the shared `api` axios instance from authSlice (includes interceptors).
 */
import { api } from '../store/authSlice';

/* ─── Types ──────────────────────────────────────────────────────── */

export interface UserRef {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Project {
  id: number;
  key: string;
  name: string;
  description: string | null;
  status: string;
  workspaceId: number;
  startDate: string | null;
  endDate: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserRef;
  _count: { issues: number; sprints: number };
}

export interface Issue {
  id: number;
  key: string;
  issueNumber: number;
  projectId: number;
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimate: number | null;
  sprintId: number | null;
  parentId: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: UserRef | null;
  reporter: UserRef | null;
  sprint: { id: number; name: string } | null;
  parent?: { id: number; key: string; title: string } | null;
  children?: Issue[];
  comments?: Comment[];
  activityLogs?: ActivityLog[];
  incomingLinks?: IssueLink[];
  outgoingLinks?: IssueLink[];
}

export interface Sprint {
  id: number;
  projectId: number;
  name: string;
  goal: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { issues: number };
}

export interface Comment {
  id: number;
  issueId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: UserRef;
}

export interface ActivityLog {
  id: number;
  issueId: number;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: UserRef;
}

export interface IssueLink {
  id: number;
  type: string;
  sourceIssue?: { id: number; key: string; title: string; status: string };
  targetIssue?: { id: number; key: string; title: string; status: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

/* ─── Workspaces ─────────────────────────────────────────────────── */

export interface Workspace {
  id: number;
  name: string;
  description: string | null;
  roleId: number;
}

export async function fetchWorkspaces() {
  const res = await api.get<{ data: Workspace[] }>('/workspaces');
  return res.data.data;
}

export async function fetchUsers() {
  const res = await api.get<{ data: UserRef[] }>('/users');
  return res.data.data;
}

/* ─── Projects ───────────────────────────────────────────────────── */

export async function fetchProjects(params?: Record<string, string | number>) {
  const res = await api.get<PaginatedResponse<Project>>('/projects', { params });
  return res.data;
}

export async function fetchProject(id: number) {
  const res = await api.get<{ data: Project }>(`/projects/${id}`);
  return res.data.data;
}

export async function createProject(data: {
  key: string;
  name: string;
  description?: string;
  workspaceId: number;
  startDate?: string;
  endDate?: string;
}) {
  const res = await api.post<{ data: Project }>('/projects', data);
  return res.data.data;
}

export async function updateProject(id: number, data: Record<string, unknown>) {
  const res = await api.put<{ data: Project }>(`/projects/${id}`, data);
  return res.data.data;
}

export async function deleteProject(id: number) {
  const res = await api.delete(`/projects/${id}`);
  return res.data;
}

/* ─── Issues ─────────────────────────────────────────────────────── */

export async function fetchIssues(projectId: number, params?: Record<string, string | number>) {
  const res = await api.get<PaginatedResponse<Issue>>(`/projects/${projectId}/issues`, { params });
  return res.data;
}

export async function fetchIssue(issueId: number) {
  const res = await api.get<{ data: Issue }>(`/issues/${issueId}`);
  return res.data.data;
}

export async function createIssue(projectId: number, data: Record<string, unknown>) {
  const res = await api.post<{ data: Issue }>(`/projects/${projectId}/issues`, data);
  return res.data.data;
}

export async function updateIssue(issueId: number, data: Record<string, unknown>) {
  const res = await api.put<{ data: Issue }>(`/issues/${issueId}`, data);
  return res.data.data;
}

export async function deleteIssue(issueId: number) {
  const res = await api.delete(`/issues/${issueId}`);
  return res.data;
}

/* ─── Sprints ────────────────────────────────────────────────────── */

export async function fetchSprints(projectId: number, params?: Record<string, string>) {
  const res = await api.get<{ data: Sprint[] }>(`/projects/${projectId}/sprints`, { params });
  return res.data.data;
}

export async function createSprint(projectId: number, data: Record<string, unknown>) {
  const res = await api.post<{ data: Sprint }>(`/projects/${projectId}/sprints`, data);
  return res.data.data;
}

export async function updateSprint(projectId: number, sprintId: number, data: Record<string, unknown>) {
  const res = await api.put<{ data: Sprint }>(`/projects/${projectId}/sprints/${sprintId}`, data);
  return res.data.data;
}

export async function closeSprint(projectId: number, sprintId: number) {
  const res = await api.post<{ data: Sprint }>(`/projects/${projectId}/sprints/${sprintId}/close`);
  return res.data.data;
}

export async function fetchBacklog(projectId: number) {
  const res = await api.get<{ data: Issue[]; pagination: unknown }>(`/projects/${projectId}/sprints/backlog/items`);
  return res.data.data;
}

export async function fetchBoard(projectId: number, sprintId: number) {
  const res = await api.get<{ data: { sprint: Sprint; board: Record<string, Issue[]> } }>(`/projects/${projectId}/sprints/${sprintId}/board`);
  return res.data.data.board;
}

/* ─── Comments ───────────────────────────────────────────────────── */

export async function createComment(projectId: number, issueId: number, content: string) {
  const res = await api.post<{ data: Comment }>(`/projects/${projectId}/issues/${issueId}/comments`, { content });
  return res.data.data;
}

export async function updateComment(commentId: number, content: string) {
  const res = await api.put<{ data: Comment }>(`/comments/${commentId}`, { content });
  return res.data.data;
}

export async function deleteComment(commentId: number) {
  const res = await api.delete(`/comments/${commentId}`);
  return res.data;
}

/* ─── Activity ───────────────────────────────────────────────────── */

export async function fetchActivity(issueId: number, params?: Record<string, string | number>) {
  const res = await api.get<PaginatedResponse<ActivityLog>>(`/issues/${issueId}/activity`, { params });
  return res.data;
}

export interface SearchIssueResult {
  id: number;
  key: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  estimate: number | null;
  projectId: number;
  assignee: UserRef | null;
  project: { id: number; key: string; name: string } | null;
}

export interface SearchResponse {
  data: {
    issues?: SearchIssueResult[];
    projects?: unknown[];
    issueTotal?: number;
    projectTotal?: number;
  };
  pagination: { page: number; limit: number };
}

/* ─── Search ─────────────────────────────────────────────────────── */

export async function searchIssues(params: Record<string, string | number>) {
  const res = await api.get<SearchResponse>('/search', { params });
  return res.data;
}
