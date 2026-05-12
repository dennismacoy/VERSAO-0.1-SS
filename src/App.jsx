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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
          <div className="bg-card p-8 rounded-xl shadow-lg border border-destructive/20 text-center max-w-lg">
            <h1 className="text-2xl font-bold text-destructive mb-4">Ocorreu um Erro Crítico</h1>
            <p className="text-muted-foreground mb-4">A aplicação encontrou um problema e não pôde continuar.</p>
            <pre className="text-left bg-muted p-4 rounded text-xs overflow-auto text-destructive">
              {this.state.error?.toString()}
            </pre>
            <button 
              onClick={() => window.location.href = '/'}
              className="mt-6 bg-primary text-primary-foreground px-6 py-2 rounded font-bold uppercase"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-primary font-bold">Carregando...</div>;
  }
  
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { ProductsProvider } from './context/ProductsContext';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProductsProvider>
          <Router>
            <AppRoutes />
          </Router>
        </ProductsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
