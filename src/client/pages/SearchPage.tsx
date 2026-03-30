/**
 * REQ-009 AC-007 — Global search page with filters.
 */
import React, { useState, useCallback } from 'react';
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
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { searchIssues, SearchIssueResult } from '../api/projectApi';

const TYPES = ['', 'Epic', 'Story', 'Task', 'Bug'];
const STATUSES = ['', 'Backlog', 'Ready', 'In Progress', 'In Review', 'Done', 'Closed'];
const PRIORITIES = ['', 'Critical', 'High', 'Medium', 'Low'];

const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  Critical: 'error',
  High: 'warning',
  Medium: 'info',
  Low: 'default',
};

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [results, setResults] = useState<SearchIssueResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params: Record<string, string | number> = { limit: 50 };
      if (query.trim()) params.q = query.trim();
      if (typeFilter) params.issueType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await searchIssues(params);
      setResults(res.data.issues ?? []);
      setTotal(res.data.issueTotal ?? 0);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter, statusFilter, priorityFilter]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch();
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={3}>Search Issues</Typography>

      {/* Search bar */}
      <Box display="flex" gap={1} mb={2}>
        <TextField
          fullWidth
          placeholder="Search issues by summary..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          size="small"
        />
        <Button variant="contained" startIcon={<SearchIcon />} onClick={doSearch}>
          Search
        </Button>
      </Box>

      {/* Filters */}
      <Grid container spacing={1} mb={3}>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
              {TYPES.map((t) => <MenuItem key={t} value={t}>{t || 'All Types'}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s || 'All Statuses'}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select value={priorityFilter} label="Priority" onChange={(e) => setPriorityFilter(e.target.value)}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p || 'All Priorities'}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Results */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}

      {searched && !loading && (
        <Typography variant="body2" color="text.secondary" mb={2}>
          {total} result{total !== 1 ? 's' : ''} found
        </Typography>
      )}

      {results.map((issue) => (
        <Card key={issue.id} variant="outlined" sx={{ mb: 1 }}>
          <CardActionArea onClick={() => navigate(`/projects/${issue.projectId}/issues/${issue.id}`)}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle2" fontWeight={600}>{issue.key}</Typography>
                <Typography variant="body2" sx={{ flex: 1 }} noWrap>{issue.title}</Typography>
                <Chip label={issue.type} size="small" variant="outlined" />
                <Chip label={issue.status} size="small" color="primary" />
                <Chip label={issue.priority} size="small" color={PRIORITY_COLORS[issue.priority] ?? 'default'} />
              </Box>
              {issue.assignee && (
                <Typography variant="caption" color="text.secondary">
                  Assigned to {issue.assignee.firstName} {issue.assignee.lastName}
                </Typography>
              )}
            </CardContent>
          </CardActionArea>
        </Card>
      ))}

      {searched && !loading && results.length === 0 && (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No issues found. Try a different search or adjust filters.
        </Typography>
      )}
    </Box>
  );
};

export default SearchPage;
