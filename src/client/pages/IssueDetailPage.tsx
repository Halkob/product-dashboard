/**
 * REQ-009 AC-004/AC-005 — Issue detail page with comments, activity log, and edit form.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BugReportIcon from '@mui/icons-material/BugReport';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import {
  fetchIssue,
  updateIssue,
  deleteIssue,
  createComment,
  updateComment,
  deleteComment,
  fetchActivity,
  Issue,
  Comment as IComment,
  ActivityLog,
} from '../api/projectApi';
import { useAppSelector } from '../store/hooks';

const STATUSES = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Done', 'Closed'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 21];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  Epic: <AccountTreeIcon sx={{ color: '#7b1fa2' }} />,
  Story: <AutoStoriesIcon sx={{ color: '#1565c0' }} />,
  Task: <TaskAltIcon sx={{ color: '#2e7d32' }} />,
  Bug: <BugReportIcon sx={{ color: '#c62828' }} />,
};

const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  Critical: 'error',
  High: 'warning',
  Medium: 'info',
  Low: 'default',
};

const IssueDetailPage: React.FC = () => {
  const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>();
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.auth);
  const iid = Number(issueId);

  const [issue, setIssue] = useState<Issue | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editEstimate, setEditEstimate] = useState<number | ''>('');
  const [editSummary, setEditSummary] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Comments
  const [newComment, setNewComment] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [iss, act] = await Promise.all([
        fetchIssue(iid),
        fetchActivity(iid, { limit: 50 }),
      ]);
      setIssue(iss);
      setActivity(act.data);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to load issue');
    } finally {
      setLoading(false);
    }
  }, [iid]);

  useEffect(() => { load(); }, [load]);

  const openEditDialog = () => {
    if (!issue) return;
    setEditStatus(issue.status);
    setEditPriority(issue.priority);
    setEditEstimate(issue.estimate ?? '');
    setEditSummary(issue.summary);
    setEditDesc(issue.description ?? '');
    setEditError(null);
    setEditOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setEditError(null);
    try {
      await updateIssue(iid, {
        summary: editSummary,
        description: editDesc || null,
        status: editStatus,
        priority: editPriority,
        estimate: editEstimate === '' ? null : editEstimate,
      });
      setEditOpen(false);
      load();
    } catch (err: unknown) {
      setEditError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Archive this issue?')) return;
    try {
      await deleteIssue(iid);
      navigate(`/projects/${projectId}`);
    } catch { /* ignore */ }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setCommentPosting(true);
    try {
      await createComment(iid, newComment);
      setNewComment('');
      load();
    } catch { /* ignore */ }
    setCommentPosting(false);
  };

  const handleUpdateComment = async (cid: number) => {
    try {
      await updateComment(cid, editCommentText);
      setEditingCommentId(null);
      load();
    } catch { /* ignore */ }
  };

  const handleDeleteComment = async (cid: number) => {
    try {
      await deleteComment(cid);
      load();
    } catch { /* ignore */ }
  };

  if (loading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!issue) return <Alert severity="warning">Issue not found</Alert>;

  return (
    <Box>
      {/* Header */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/projects/${projectId}`)} sx={{ mb: 2 }}>
        Back to Board
      </Button>

      <Box display="flex" alignItems="center" gap={1} mb={1}>
        {TYPE_ICONS[issue.type]}
        <Typography variant="h5" fontWeight={700}>{issue.key}</Typography>
        <Chip label={issue.status} size="small" color="primary" />
        <Chip label={issue.priority} size="small" color={PRIORITY_COLORS[issue.priority] ?? 'default'} />
        <Box sx={{ ml: 'auto' }}>
          <IconButton onClick={openEditDialog}><EditIcon /></IconButton>
          <IconButton onClick={handleDelete} color="error"><DeleteIcon /></IconButton>
        </Box>
      </Box>
      <Typography variant="h6" mb={2}>{issue.summary}</Typography>

      {/* Detail grid */}
      <Box display="flex" gap={3} flexWrap="wrap" mb={3}>
        <Paper variant="outlined" sx={{ flex: '1 1 60%', minWidth: 300, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>Description</Typography>
          <Typography variant="body2" whiteSpace="pre-wrap">{issue.description || '—'}</Typography>
        </Paper>

        <Paper variant="outlined" sx={{ flex: '1 1 30%', minWidth: 200, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>Details</Typography>
          <Box display="flex" flexDirection="column" gap={0.5}>
            <DetailRow label="Type" value={issue.type} />
            <DetailRow label="Status" value={issue.status} />
            <DetailRow label="Priority" value={issue.priority} />
            <DetailRow label="Estimate" value={issue.estimate != null ? `${issue.estimate} pts` : '—'} />
            <DetailRow label="Assignee" value={issue.assignee ? `${issue.assignee.firstName} ${issue.assignee.lastName}` : 'Unassigned'} />
            <DetailRow label="Reporter" value={issue.reporter ? `${issue.reporter.firstName} ${issue.reporter.lastName}` : '—'} />
            <DetailRow label="Sprint" value={issue.sprint?.name ?? 'None'} />
            {issue.parent && <DetailRow label="Parent" value={`${issue.parent.key} — ${issue.parent.summary}`} />}
          </Box>
        </Paper>
      </Box>

      {/* Children */}
      {issue.children && issue.children.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>Child Issues</Typography>
          {issue.children.map((c) => (
            <Chip key={c.id} label={`${c.key} — ${c.summary}`} clickable onClick={() => navigate(`/projects/${projectId}/issues/${c.id}`)} sx={{ mr: 0.5, mb: 0.5 }} />
          ))}
        </Paper>
      )}

      {/* Linked issues */}
      {((issue.outgoingLinks?.length ?? 0) > 0 || (issue.incomingLinks?.length ?? 0) > 0) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>Linked Issues</Typography>
          {issue.outgoingLinks?.map((l) => (
            <Chip key={l.id} label={`${l.type} → ${l.targetIssue?.key}`} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
          ))}
          {issue.incomingLinks?.map((l) => (
            <Chip key={l.id} label={`${l.sourceIssue?.key} → ${l.type}`} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
          ))}
        </Paper>
      )}

      {/* Tabs: Comments / Activity */}
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Comments (${issue.comments?.length ?? 0})`} />
        <Tab label={`Activity (${activity.length})`} />
      </Tabs>

      {tab === 0 && (
        <Box>
          {/* Add comment */}
          <Box display="flex" gap={1} mb={2}>
            <TextField
              size="small"
              placeholder="Add a comment..."
              fullWidth
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
            />
            <Button variant="contained" size="small" onClick={handleAddComment} disabled={commentPosting}>
              Post
            </Button>
          </Box>

          {/* Comment list */}
          {(issue.comments ?? []).map((c: IComment) => (
            <Paper key={c.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" fontWeight={600}>
                  {c.author.firstName} {c.author.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(c.createdAt).toLocaleString()}
                </Typography>
              </Box>
              {editingCommentId === c.id ? (
                <Box display="flex" gap={1} mt={1}>
                  <TextField size="small" fullWidth value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} />
                  <Button size="small" onClick={() => handleUpdateComment(c.id)}>Save</Button>
                  <Button size="small" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                </Box>
              ) : (
                <>
                  <Typography variant="body2" mt={0.5}>{c.content}</Typography>
                  {user && user.id === c.author.id && (
                    <Box mt={0.5}>
                      <IconButton size="small" onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.content); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteComment(c.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          {activity.map((a) => (
            <Box key={a.id} display="flex" gap={1} mb={1} alignItems="flex-start">
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
                {new Date(a.createdAt).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                <strong>{a.user.firstName} {a.user.lastName}</strong>{' '}
                {a.action}{a.field ? ` ${a.field}` : ''}{' '}
                {a.oldValue ? <><s>{a.oldValue}</s> → </> : ''}
                {a.newValue && <strong>{a.newValue}</strong>}
              </Typography>
            </Box>
          ))}
          {activity.length === 0 && <Typography color="text.secondary">No activity yet.</Typography>}
        </Box>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Issue — {issue.key}</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          <TextField label="Summary" fullWidth margin="normal" value={editSummary} onChange={(e) => setEditSummary(e.target.value)} />
          <TextField label="Description" fullWidth margin="normal" multiline rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select value={editStatus} label="Status" onChange={(e) => setEditStatus(e.target.value)}>
              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Priority</InputLabel>
            <Select value={editPriority} label="Priority" onChange={(e) => setEditPriority(e.target.value)}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Estimate</InputLabel>
            <Select value={editEstimate} label="Estimate" onChange={(e) => setEditEstimate(e.target.value === '' ? '' : Number(e.target.value))}>
              <MenuItem value="">None</MenuItem>
              {FIBONACCI.map((f) => <MenuItem key={f} value={f}>{f} pts</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

/* ─── Helper ─────────────────────────────────────────────────────── */

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box display="flex" justifyContent="space-between">
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="caption" fontWeight={500}>{value}</Typography>
  </Box>
);

export default IssueDetailPage;
