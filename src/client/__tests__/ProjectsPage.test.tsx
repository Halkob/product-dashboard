/**
 * REQ-009 AC-002 — ProjectsPage component tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as projectApi from '../api/projectApi';
import ProjectsPage from '../pages/ProjectsPage';

vi.mock('../api/projectApi');

const mockProjects: projectApi.Project[] = [
  {
    id: 1,
    key: 'PROJ',
    name: 'Test Project',
    description: 'A test project',
    status: 'Active',
    workspaceId: 1,
    startDate: null,
    endDate: null,
    archivedAt: null,
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:00.000Z',
    createdBy: { id: 1, firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
    _count: { issues: 5, sprints: 2 },
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a loading spinner initially', () => {
    vi.mocked(projectApi.fetchProjects).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders project cards after load', async () => {
    vi.mocked(projectApi.fetchProjects).mockResolvedValue({
      data: mockProjects,
      pagination: { total: 1, page: 1, limit: 50, pages: 1 },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Test Project')).toBeInTheDocument());
    expect(screen.getByText('PROJ')).toBeInTheDocument();
    expect(screen.getByText('A test project')).toBeInTheDocument();
  });

  it('renders empty state when no projects exist', async () => {
    vi.mocked(projectApi.fetchProjects).mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 50, pages: 0 },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no projects/i)).toBeInTheDocument());
  });

  it('renders an error alert on fetch failure', async () => {
    vi.mocked(projectApi.fetchProjects).mockRejectedValue(
      new Error('Network error'),
    );
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('opens Create Project dialog when button is clicked', async () => {
    vi.mocked(projectApi.fetchProjects).mockResolvedValue({
      data: mockProjects,
      pagination: { total: 1, page: 1, limit: 50, pages: 1 },
    });
    renderPage();
    await waitFor(() => screen.getByText('Test Project'));
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/project key/i)).toBeInTheDocument();
  });
});
