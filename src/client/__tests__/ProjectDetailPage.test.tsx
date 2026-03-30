/**
 * REQ-009 AC-003/AC-006 — ProjectDetailPage component tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as projectApi from '../api/projectApi';
import ProjectDetailPage from '../pages/ProjectDetailPage';

vi.mock('../api/projectApi');

const mockProject: projectApi.Project = {
  id: 1,
  key: 'PROJ',
  name: 'Test Project',
  description: 'A project description',
  status: 'Active',
  workspaceId: 1,
  startDate: null,
  endDate: null,
  archivedAt: null,
  createdAt: '2026-03-29T00:00:00.000Z',
  updatedAt: '2026-03-29T00:00:00.000Z',
  createdBy: { id: 1, firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
  _count: { issues: 2, sprints: 1 },
};

const mockActiveSprint: projectApi.Sprint = {
  id: 10,
  projectId: 1,
  name: 'Sprint 1',
  goal: 'Deliver MVP',
  status: 'active',
  startDate: '2026-03-01',
  endDate: '2026-03-14',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

const mockIssue: projectApi.Issue = {
  id: 100,
  key: 'PROJ-1',
  issueNumber: 1,
  projectId: 1,
  type: 'Task',
  summary: 'Fix the login bug',
  description: null,
  status: 'In Progress',
  priority: 'High',
  estimate: 3,
  sprintId: 10,
  parentId: null,
  archivedAt: null,
  createdAt: '2026-03-29T00:00:00.000Z',
  updatedAt: '2026-03-29T00:00:00.000Z',
  assignee: { id: 2, firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com' },
  reporter: null,
  sprint: { id: 10, name: 'Sprint 1' },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/1']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a loading spinner initially', () => {
    vi.mocked(projectApi.fetchProject).mockReturnValue(new Promise(() => {}));
    vi.mocked(projectApi.fetchSprints).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders project name and key after load with active sprint board', async () => {
    vi.mocked(projectApi.fetchProject).mockResolvedValue(mockProject);
    vi.mocked(projectApi.fetchSprints).mockResolvedValue([mockActiveSprint]);
    vi.mocked(projectApi.fetchBoard).mockResolvedValue({ 'In Progress': [mockIssue] });
    vi.mocked(projectApi.fetchBacklog).mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Test Project')).toBeInTheDocument());
    expect(screen.getByText('PROJ')).toBeInTheDocument();
    expect(screen.getByText('A project description')).toBeInTheDocument();
  });

  it('renders Kanban columns with issue cards', async () => {
    vi.mocked(projectApi.fetchProject).mockResolvedValue(mockProject);
    vi.mocked(projectApi.fetchSprints).mockResolvedValue([mockActiveSprint]);
    vi.mocked(projectApi.fetchBoard).mockResolvedValue({ 'In Progress': [mockIssue] });
    vi.mocked(projectApi.fetchBacklog).mockResolvedValue([]);
    renderPage();
    await waitFor(() => screen.getByText('Fix the login bug'));
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('PROJ-1')).toBeInTheDocument();
  });

  it('shows an error alert when fetch fails', async () => {
    vi.mocked(projectApi.fetchProject).mockRejectedValue(new Error('Server error'));
    vi.mocked(projectApi.fetchSprints).mockRejectedValue(new Error('Server error'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('opens Create Issue dialog on button click', async () => {
    vi.mocked(projectApi.fetchProject).mockResolvedValue(mockProject);
    vi.mocked(projectApi.fetchSprints).mockResolvedValue([mockActiveSprint]);
    vi.mocked(projectApi.fetchBoard).mockResolvedValue({});
    vi.mocked(projectApi.fetchBacklog).mockResolvedValue([]);
    renderPage();
    await waitFor(() => screen.getByText('Test Project'));
    fireEvent.click(screen.getByRole('button', { name: /create issue/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByLabelText(/summary/i)).toBeInTheDocument();
  });

  it('opens Create Sprint dialog on button click', async () => {
    vi.mocked(projectApi.fetchProject).mockResolvedValue(mockProject);
    vi.mocked(projectApi.fetchSprints).mockResolvedValue([]);
    vi.mocked(projectApi.fetchIssues).mockResolvedValue({ data: [], pagination: { total: 0, page: 1, limit: 200, pages: 0 } });
    vi.mocked(projectApi.fetchBacklog).mockResolvedValue([]);
    renderPage();
    await waitFor(() => screen.getByText('Test Project'));
    fireEvent.click(screen.getByRole('button', { name: /new sprint/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByLabelText(/sprint name/i)).toBeInTheDocument();
  });
});
