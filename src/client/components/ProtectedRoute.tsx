import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Minimum role required to access this route. Uses hierarchy: CEO > CTO > COO > PM > Team Member */
  requiredRole?: string;
}

const ROLE_HIERARCHY = ['CEO', 'CTO', 'COO', 'Project Manager', 'Team Member'];

function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userIdx = ROLE_HIERARCHY.indexOf(userRole);
  const reqIdx = ROLE_HIERARCHY.indexOf(requiredRole);
  if (userIdx === -1 || reqIdx === -1) return userRole === requiredRole;
  return userIdx <= reqIdx;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (!user) {
    // Not authenticated — redirect to login, preserve intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasMinimumRole(user.role, requiredRole)) {
    // Authenticated but insufficient role
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
