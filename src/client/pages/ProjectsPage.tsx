/**
 * REQ-009 AC-002 — Projects list page with create dialog.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import { fetchProjects, createProject, Project } from '../api/projectApi';

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [formKey, setFormKey] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchProjects({ limit: 50 })
      .then((res) => setProjects(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!formKey || !formName) {
      setFormError('Key and name are required');
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      // Use the user's workspaceId — fetch from first project or default to 1
      const workspaceId = projects.length > 0 ? projects[0].workspaceId : 1;
      await createProject({ key: formKey.toUpperCase(), name: formName, description: formDesc || undefined, workspaceId });
      setDialogOpen(false);
      setFormKey('');
      setFormName('');
      setFormDesc('');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Create failed';
      setFormError(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>
          Projects
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Create Project
        </Button>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && projects.length === 0 && (
        <Typography color="text.secondary">No projects yet. Click &ldquo;Create Project&rdquo; to get started.</Typography>
      )}

      <Grid container spacing={2}>
        {projects.map((p) => (
          <Grid item xs={12} sm={6} md={4} key={p.id}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardActionArea onClick={() => navigate(`/projects/${p.id}`)} sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <FolderIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      {p.name}
                    </Typography>
                    <Chip label={p.key} size="small" color="primary" variant="outlined" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, minHeight: 40 }}>
                    {p.description || 'No description'}
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip label={`${p._count.issues} issues`} size="small" variant="outlined" />
                    <Chip label={`${p._count.sprints} sprints`} size="small" variant="outlined" />
                    <Chip label={p.status ?? 'active'} size="small" color={p.archivedAt ? 'default' : 'success'} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" mt={1} display="block">
                    Created by {p.createdBy.firstName} {p.createdBy.lastName}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Project Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Project</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <TextField
            label="Project Key"
            placeholder="e.g. DASH"
            fullWidth
            margin="normal"
            value={formKey}
            onChange={(e) => setFormKey((e.target as HTMLInputElement).value.toUpperCase())}
            inputProps={{ maxLength: 10 }}
            helperText="1–10 uppercase letters/digits, starting with a letter"
          />
          <TextField
            label="Project Name"
            fullWidth
            margin="normal"
            value={formName}
            onChange={(e) => setFormName((e.target as HTMLInputElement).value)}
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={formDesc}
            onChange={(e) => setFormDesc((e.target as HTMLInputElement).value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            {creating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
