import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDefaultRoute, PERMISSIONS } from '../lib/permissions';
import ProtectedRoute from './ProtectedRoute';
import Dashboard from '../pages/Dashboard';

/**
 * Componente sem interface para redirecionamento inteligente da rota raiz '/'.
 * Avalia a role e matriz de permissões para jogar o usuário para a primeira página permitida.
 */
export default function HomeRedirect() {
  const { user, role, permissions, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const targetRoute = getDefaultRoute(role, permissions);

  // Se a rota padrão for o próprio Dashboard ('/'), renderiza o Dashboard protegido
  if (targetRoute === '/') {
    return (
      <ProtectedRoute requiredAction={PERMISSIONS.VIEW_DASHBOARD}>
        <Dashboard />
      </ProtectedRoute>
    );
  }

  // Caso contrário, redireciona para a primeira página permitida (ex: /consulta, /pedidos, etc.)
  return <Navigate to={targetRoute} replace />;
}
