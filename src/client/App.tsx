import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Box, Button, Typography, AppBar, Toolbar, Chip } from '@mui/material';
import { store } from './store/store';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { logout } from './store/authSlice';

const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Product Dashboard
          </Typography>
          {user && (
            <Chip
              label={`${user.firstName} ${user.lastName} · ${user.role}`}
              color="default"
              variant="outlined"
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', mr: 2 }}
            />
          )}
          <Button color="inherit" onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 4 }}>
        <Typography variant="h5">Welcome, {user?.firstName}!</Typography>
        <Typography variant="body1" color="text.secondary" mt={1}>
          You are signed in as <strong>{user?.role}</strong>.
        </Typography>
      </Box>
    </Box>
  );
};

const UnauthorizedPage: React.FC = () => (
  <div>
    <h1>403 — Unauthorized</h1>
    <p>You do not have permission to access this page.</p>
  </div>
);

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          {/* Catch-all → redirect to dashboard (ProtectedRoute will redirect to login if needed) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
};

export default App;
