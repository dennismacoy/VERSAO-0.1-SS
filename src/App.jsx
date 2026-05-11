import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Consulta from './pages/Consulta';
import PreVenda from './pages/PreVenda';
import Separacao from './pages/Separacao';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Consulta /></PrivateRoute>} />
      <Route path="/pre-venda" element={<PrivateRoute><PreVenda /></PrivateRoute>} />
      <Route path="/separacao" element={<PrivateRoute><Separacao /></PrivateRoute>} />
      <Route path="/relatorios" element={<PrivateRoute><Relatorios /></PrivateRoute>} />
      <Route path="/configuracoes" element={<PrivateRoute><Configuracoes /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
