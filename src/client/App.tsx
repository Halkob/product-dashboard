import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

const DashboardPage: React.FC = () => (
  <div>
    <h1>Product Dashboard</h1>
  </div>
);

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
