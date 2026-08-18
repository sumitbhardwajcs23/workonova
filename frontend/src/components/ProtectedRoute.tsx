import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getUser } from '../utils/auth.js';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const user = getUser();

  if (!user || ('emailVerified' in user && user.emailVerified === 0)) {
    // If attempting to access admin route, redirect to dedicated admin login page
    if (allowedRoles && (allowedRoles.includes('admin') || allowedRoles.includes('qa_admin'))) {
      return <Navigate to="/admin" replace />;
    }
    const defaultRole = allowedRoles && allowedRoles.includes('freelancer') ? 'freelancer' : 'client';
    return <Navigate to={`/?modal=login&role=${defaultRole}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Role not allowed (e.g. freelancer trying to access client dashboard)
    if (user.role === 'admin' || user.role === 'qa_admin') {
      return <Navigate to="/admin-dashboard" replace />;
    }
    return <Navigate to={user.role === 'freelancer' ? '/freelancer-dashboard' : '/client-dashboard'} replace />;
  }

  return <>{children}</>;
}
