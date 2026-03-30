/**
 * REQ-009 — Dashboard landing page showing recent projects overview.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { useAppSelector } from '../store/hooks';
import { fetchProjects, Project } from '../api/projectApi';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.auth);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchProjects({ limit: 12 })
      .then((res) => setProjects(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Welcome, {user?.firstName}!
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        You are signed in as <strong>{user?.role}</strong>.
      </Typography>

      <Typography variant="h6" fontWeight={600} mb={2}>
        Recent Projects
      </Typography>

      {loading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && projects.length === 0 && (
        <Typography color="text.secondary">
          No projects yet. Go to <strong>Projects</strong> to create one.
        </Typography>
      )}

      <Grid container spacing={2}>
        {projects.map((p) => (
          <Grid item xs={12} sm={6} md={4} key={p.id}>
            <Card variant="outlined">
              <CardActionArea onClick={() => navigate(`/projects/${p.id}`)}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <FolderIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      {p.name}
                    </Typography>
                    <Chip label={p.key} size="small" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {p.description || 'No description'}
                  </Typography>
                  <Box display="flex" gap={1} mt={1}>
                    <Chip label={`${p._count.issues} issues`} size="small" variant="outlined" />
                    <Chip label={`${p._count.sprints} sprints`} size="small" variant="outlined" />
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default DashboardPage;
