import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDefaultRoute, PERMISSIONS } from '../lib/permissions';
import ProtectedRoute from './ProtectedRoute';
import Dashboard from '../pages/Dashboard';

/**
 * Componente de Redirecionamento da Rota Raiz '/'.
 * Redireciona usuários deslogados para /login e usuários logados para a primeira página permitida.
 */
export default function HomeRedirect() {
  const { user, currentUser, role, permissions, loading } = useAuth();
  const activeUser = user || currentUser;

  if (loading) return null;

  if (!activeUser) {
    return <Navigate to="/login" replace />;
  }

  const targetRoute = getDefaultRoute(role, permissions);

  if (targetRoute === '/') {
    return (
      <ProtectedRoute requiredAction={PERMISSIONS.VIEW_DASHBOARD}>
        <Dashboard />
      </ProtectedRoute>
    );
  }

  return <Navigate to={targetRoute} replace />;
}
