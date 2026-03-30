/**
 * REQ-009 AC-003 — Project detail page with Kanban sprint board.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BugReportIcon from '@mui/icons-material/BugReport';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import {
  fetchProject,
  fetchIssues,
  fetchSprints,
  fetchBacklog,
  fetchBoard,
  createIssue,
  createSprint,
  updateSprint,
  closeSprint,
  Project,
  Issue,
  Sprint,
} from '../api/projectApi';

/* ─── Constants ──────────────────────────────────────────────────── */

const STATUSES = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Done', 'Closed'];
const TYPES = ['Epic', 'Story', 'Task', 'Bug'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 21];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  Epic: <AccountTreeIcon fontSize="small" sx={{ color: '#7b1fa2' }} />,
  Story: <AutoStoriesIcon fontSize="small" sx={{ color: '#1565c0' }} />,
  Task: <TaskAltIcon fontSize="small" sx={{ color: '#2e7d32' }} />,
  Bug: <BugReportIcon fontSize="small" sx={{ color: '#c62828' }} />,
};

const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  Critical: 'error',
  High: 'warning',
  Medium: 'info',
  Low: 'default',
};

/* ─── IssueCard ──────────────────────────────────────────────────── */

const IssueCard: React.FC<{ issue: Issue; onClick: () => void }> = ({ issue, onClick }) => (
  <Card variant="outlined" sx={{ mb: 1 }}>
    <CardActionArea onClick={onClick}>
      <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
        <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
          {TYPE_ICONS[issue.type]}
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {issue.key}
          </Typography>
          <Chip label={issue.priority} size="small" color={PRIORITY_COLORS[issue.priority] ?? 'default'} sx={{ ml: 'auto', height: 20, fontSize: 11 }} />
        </Box>
        <Typography variant="body2" noWrap>
          {issue.title}
        </Typography>
        {issue.assignee && (
          <Typography variant="caption" color="text.secondary">
            {issue.assignee.firstName} {issue.assignee.lastName}
          </Typography>
        )}
        {issue.estimate != null && (
          <Chip label={`${issue.estimate} pts`} size="small" variant="outlined" sx={{ ml: 1, height: 18, fontSize: 10 }} />
        )}
      </CardContent>
    </CardActionArea>
  </Card>
);

/* ─── Main page ──────────────────────────────────────────────────── */

const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const pid = Number(projectId);

  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [boardData, setBoardData] = useState<Record<string, Issue[]>>({});
  const [backlog, setBacklog] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [sprintDialogOpen, setSprintDialogOpen] = useState(false);
  const [showBacklog, setShowBacklog] = useState(false);

  // Issue form
  const [iType, setIType] = useState('Task');
  const [iTitle, setITitle] = useState('');
  const [iDesc, setIDesc] = useState('');
  const [iPriority, setIPriority] = useState('Medium');
  const [iEstimate, setIEstimate] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sprint form
  const [sName, setSName] = useState('');
  const [sGoal, setSGoal] = useState('');
  const [sStart, setSStart] = useState('');
  const [sEnd, setSEnd] = useState('');
  const [sprintCreating, setSprintCreating] = useState(false);
  const [sprintFormError, setSprintFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [proj, sprintList] = await Promise.all([fetchProject(pid), fetchSprints(pid)]);
      setProject(proj);
      setSprints(sprintList);

      const active = sprintList.find((s: Sprint) => s.status === 'active') ?? null;
      setActiveSprint(active);

      if (active) {
        const board = await fetchBoard(pid, active.id);
        setBoardData(board);
      } else {
        // No active sprint — show all issues in columns
        const issueRes = await fetchIssues(pid, { limit: 200 });
        const grouped: Record<string, Issue[]> = {};
        for (const s of STATUSES) grouped[s] = [];
        for (const i of issueRes.data) {
          (grouped[i.status] ??= []).push(i);
        }
        setBoardData(grouped);
      }

      const bl = await fetchBacklog(pid);
      setBacklog(bl);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { load(); }, [load]);

  const handleCreateIssue = async () => {
    if (!iTitle.trim()) { setFormError('Title is required'); return; }
    setCreating(true);
    setFormError(null);
    try {
      await createIssue(pid, {
        type: iType,
        title: iTitle,
        description: iDesc || undefined,
        priority: iPriority,
        estimate: iEstimate === '' ? undefined : iEstimate,
        sprintId: activeSprint?.id ?? undefined,
      });
      setIssueDialogOpen(false);
      setITitle('');
      setIDesc('');
      setIEstimate('');
      load();
    } catch (err: unknown) {
      setFormError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSprint = async () => {
    if (!sName.trim()) { setSprintFormError('Name is required'); return; }
    setSprintCreating(true);
    setSprintFormError(null);
    try {
      await createSprint(pid, {
        name: sName,
        goal: sGoal || undefined,
        startDate: sStart || undefined,
        endDate: sEnd || undefined,
      });
      setSprintDialogOpen(false);
      setSName('');
      setSGoal('');
      setSStart('');
      setSEnd('');
      load();
    } catch (err: unknown) {
      setSprintFormError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Create failed');
    } finally {
      setSprintCreating(false);
    }
  };

  const handleActivateSprint = async (sprint: Sprint) => {
    try {
      await updateSprint(pid, sprint.id, { status: 'active' });
      load();
    } catch { /* ignore */ }
  };

  const handleCloseSprint = async (sprint: Sprint) => {
    try {
      await closeSprint(pid, sprint.id);
      load();
    } catch { /* ignore */ }
  };

  if (loading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!project) return <Alert severity="warning">Project not found</Alert>;

  return (
    <Box>
      {/* Project header */}
      <Box mb={3}>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <Typography variant="h4" fontWeight={700}>{project.name}</Typography>
          <Chip label={project.key} color="primary" variant="outlined" />
        </Box>
        <Typography variant="body1" color="text.secondary">{project.description || 'No description'}</Typography>
      </Box>

      {/* Action bar */}
      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIssueDialogOpen(true)} size="small">
          Create Issue
        </Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setSprintDialogOpen(true)} size="small">
          New Sprint
        </Button>
        <Button variant={showBacklog ? 'contained' : 'outlined'} size="small" onClick={() => setShowBacklog(!showBacklog)}>
          Backlog ({backlog.length})
        </Button>

        {/* Sprint selector */}
        {sprints.length > 0 && (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {sprints.filter((s) => s.status !== 'closed').map((s) => (
              <Box key={s.id} display="flex" alignItems="center" gap={0.5}>
                <Chip
                  label={`${s.name} (${s.status})`}
                  color={s.status === 'active' ? 'primary' : 'default'}
                  variant={s.status === 'active' ? 'filled' : 'outlined'}
                />
                {s.status === 'planning' && (
                  <Button size="small" variant="outlined" color="success" onClick={() => handleActivateSprint(s)}>
                    Start Sprint
                  </Button>
                )}
                {s.status === 'active' && (
                  <Button size="small" variant="outlined" color="warning" onClick={() => handleCloseSprint(s)}>
                    Close Sprint
                  </Button>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Backlog panel */}
      {showBacklog && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, maxHeight: 300, overflow: 'auto' }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>Backlog — Issues not in any sprint</Typography>
          {backlog.length === 0 && <Typography variant="body2" color="text.secondary">Backlog is empty</Typography>}
          {backlog.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onClick={() => navigate(`/projects/${pid}/issues/${issue.id}`)} />
          ))}
        </Paper>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Kanban board */}
      <Typography variant="subtitle2" color="text.secondary" mb={1}>
        {activeSprint ? `Sprint: ${activeSprint.name}` : 'All Issues'}
      </Typography>

      <Box display="flex" gap={1.5} sx={{ overflowX: 'auto', pb: 2 }}>
        {STATUSES.map((status) => {
          const issues = boardData[status] ?? [];
          return (
            <Paper
              key={status}
              variant="outlined"
              sx={{ minWidth: 220, maxWidth: 280, flex: '1 0 220px', p: 1.5, bgcolor: 'grey.50' }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2" fontWeight={600}>{status}</Typography>
                <Chip label={issues.length} size="small" />
              </Box>
              {issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} onClick={() => navigate(`/projects/${pid}/issues/${issue.id}`)} />
              ))}
              {issues.length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>—</Typography>
              )}
            </Paper>
          );
        })}
      </Box>

      {/* Create Issue Dialog */}
      <Dialog open={issueDialogOpen} onClose={() => setIssueDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Issue</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select value={iType} label="Type" onChange={(e) => setIType(e.target.value)}>
              {TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Title" fullWidth margin="normal" value={iTitle} onChange={(e) => setITitle(e.target.value)} />
          <TextField label="Description" fullWidth margin="normal" multiline rows={3} value={iDesc} onChange={(e) => setIDesc(e.target.value)} />
          <FormControl fullWidth margin="normal">
            <InputLabel>Priority</InputLabel>
            <Select value={iPriority} label="Priority" onChange={(e) => setIPriority(e.target.value)}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Estimate</InputLabel>
            <Select value={iEstimate} label="Estimate" onChange={(e) => setIEstimate(e.target.value === '' ? '' : Number(e.target.value))}>
              <MenuItem value="">None</MenuItem>
              {FIBONACCI.map((f) => <MenuItem key={f} value={f}>{f} pts</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateIssue} disabled={creating}>
            {creating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Sprint Dialog */}
      <Dialog open={sprintDialogOpen} onClose={() => setSprintDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Sprint</DialogTitle>
        <DialogContent>
          {sprintFormError && <Alert severity="error" sx={{ mb: 2 }}>{sprintFormError}</Alert>}
          <TextField label="Sprint Name" fullWidth margin="normal" value={sName} onChange={(e) => setSName(e.target.value)} />
          <TextField label="Goal" fullWidth margin="normal" multiline rows={2} value={sGoal} onChange={(e) => setSGoal(e.target.value)} />
          <TextField label="Start Date" type="date" fullWidth margin="normal" InputLabelProps={{ shrink: true }} value={sStart} onChange={(e) => setSStart(e.target.value)} />
          <TextField label="End Date" type="date" fullWidth margin="normal" InputLabelProps={{ shrink: true }} value={sEnd} onChange={(e) => setSEnd(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSprintDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSprint} disabled={sprintCreating}>
            {sprintCreating ? <CircularProgress size={20} /> : 'Create Sprint'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectDetailPage;
