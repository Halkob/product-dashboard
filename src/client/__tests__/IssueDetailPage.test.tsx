/**
 * REQ-009 AC-004/AC-005 — IssueDetailPage component tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/authSlice';
import * as projectApi from '../api/projectApi';
import IssueDetailPage from '../pages/IssueDetailPage';

vi.mock('../api/projectApi');

function makeStore(userId = 1) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        user: { id: userId, email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith', role: 'admin' },
        accessToken: 'test-token',
        loading: false,
        error: null,
      },
    },
  });
}

const mockIssue: projectApi.Issue = {
  id: 100,
  key: 'PROJ-1',
  issueNumber: 1,
  projectId: 1,
  type: 'Task',
  summary: 'Fix the login bug',
  description: 'Detailed description here',
  status: 'In Progress',
  priority: 'High',
  estimate: 5,
  sprintId: 10,
  parentId: null,
  archivedAt: null,
  createdAt: '2026-03-29T00:00:00.000Z',
  updatedAt: '2026-03-29T00:00:00.000Z',
  assignee: { id: 2, firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com' },
  reporter: { id: 1, firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
  sprint: { id: 10, name: 'Sprint 1' },
  comments: [
    {
      id: 1,
      issueId: 100,
      content: 'Looks good to me',
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
      author: { id: 1, firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
    },
  ],
  activityLogs: [],
};

const mockActivity: projectApi.ActivityLog[] = [
  {
    id: 1,
    issueId: 100,
    action: 'updated',
    field: 'status',
    oldValue: 'Backlog',
    newValue: 'In Progress',
    createdAt: '2026-03-29T00:00:00.000Z',
    user: { id: 1, firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
  },
];

function renderPage(userId = 1) {
  return render(
    <Provider store={makeStore(userId)}>
      <MemoryRouter initialEntries={['/projects/1/issues/100']}>
        <Routes>
          <Route path="/projects/:projectId/issues/:issueId" element={<IssueDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('IssueDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a loading spinner initially', () => {
    vi.mocked(projectApi.fetchIssue).mockReturnValue(new Promise(() => {}));
    vi.mocked(projectApi.fetchActivity).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders issue key, summary, and fields after load', async () => {
    vi.mocked(projectApi.fetchIssue).mockResolvedValue(mockIssue);
    vi.mocked(projectApi.fetchActivity).mockResolvedValue({
      data: mockActivity,
      pagination: { total: 1, page: 1, limit: 50, pages: 1 },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('PROJ-1')).toBeInTheDocument());
    expect(screen.getByText('Fix the login bug')).toBeInTheDocument();
    expect(screen.getByText('Detailed description here')).toBeInTheDocument();
    // "In Progress" appears in both the status chip and the Details panel — use getAllBy
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
  });

  it('renders comments tab with existing comments', async () => {
    vi.mocked(projectApi.fetchIssue).mockResolvedValue(mockIssue);
    vi.mocked(projectApi.fetchActivity).mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 50, pages: 0 },
    });
    renderPage();
    await waitFor(() => screen.getByText('PROJ-1'));
    expect(screen.getByText('Looks good to me')).toBeInTheDocument();
  });

  it('renders activity log when Activity tab is clicked', async () => {
    vi.mocked(projectApi.fetchIssue).mockResolvedValue(mockIssue);
    vi.mocked(projectApi.fetchActivity).mockResolvedValue({
      data: mockActivity,
      pagination: { total: 1, page: 1, limit: 50, pages: 1 },
    });
    renderPage();
    await waitFor(() => screen.getByText('PROJ-1'));
    fireEvent.click(screen.getByRole('tab', { name: /activity/i }));
    // The activity log renders "Backlog" as a strikethrough old value
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
  });

  it('opens the edit dialog when edit button is clicked', async () => {
    vi.mocked(projectApi.fetchIssue).mockResolvedValue(mockIssue);
    vi.mocked(projectApi.fetchActivity).mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 50, pages: 0 },
    });
    renderPage();
    await waitFor(() => screen.getByText('PROJ-1'));
    // The header row has two icon buttons: Edit (first) and Delete (second, color=error)
    // Trigger edit via the Back button area — simplest: click all icon-only buttons until dialog opens
    const allButtons = screen.getAllByRole('button');
    // Find the non-labelled icon buttons (Back to Board has text content)
    const iconOnlyButtons = allButtons.filter((b) => !b.textContent?.trim().match(/Back|Create|Post|Cancel|Save/i));
    fireEvent.click(iconOnlyButtons[0]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });

  it('renders an error alert when fetch fails', async () => {
    vi.mocked(projectApi.fetchIssue).mockRejectedValue(new Error('Not found'));
    vi.mocked(projectApi.fetchActivity).mockRejectedValue(new Error('Not found'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
